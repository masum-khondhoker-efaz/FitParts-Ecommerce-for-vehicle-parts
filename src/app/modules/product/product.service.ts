import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { CreateProductInput, UpdateProductInput } from './product.interface';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';
import {
  buildSearchQuery,
  buildFilterQuery,
  combineQueries,
  buildDateRangeQuery,
  buildNumericRangeQuery,
} from '../../utils/searchFilter';
import {
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';


const createProductIntoDb = async (
  userId: string,
  data: CreateProductInput,
) => {
  return await prisma.$transaction(async tx => {
    // Step 1️⃣: Create the base product
    const product = await tx.product.create({
      data: {
        sellerId: userId,
        categoryId: data.categoryId,
        brandId: data.brandId,
        productName: data.productName,
        productImages: data.productImages,
        description: data.description,
        price: data.price,
        stock: data.stock,
        isVisible: data.isVisible ?? true,
      },
    });

    // Step 2️⃣: Add dynamic sections & fields
    if (data.sections?.length) {
      for (const section of data.sections) {
        const createdSection = await tx.productSection.create({
          data: {
            productId: product.id,
            sectionName: section.sectionName,
            parentId: section.parentId || null,
          },
        });

        if (section.fields?.length) {
          await tx.productField.createMany({
            data: section.fields
              .filter(field => typeof field.fieldName === 'string')
              .map(field => ({
                sectionId: createdSection.id,
                fieldName: field.fieldName as string,
                valueString: field.valueString,
                valueInt: field.valueInt,
                valueFloat: field.valueFloat,
                valueDate: field.valueDate,
              })),
          });
        }
      }
    }

    // Step 3️⃣: Add references (OE / SUPPLIER / INTERNAL)
    if (data.references?.length) {
      await tx.productReference.createMany({
        data: data.references.map(ref => ({
          productId: product.id,
          type: ref.type, // must be one of enum ReferenceType
          number: ref.number,
        })),
      });
    }

    // Step 4️⃣: Add shipping details
    if (data.shipping?.length) {
      await tx.productShipping.createMany({
        data: data.shipping.map(ship => ({
          productId: product.id,
          countryName: ship.countryName,
          countryCode: ship.countryCode,
          carrier: ship.carrier,
          cost: ship.cost,
          deliveryMin: ship.deliveryMin,
          deliveryMax: ship.deliveryMax,
          isDefault: ship.isDefault ?? false,
        })),
      });
    }

    // ✅ Step 5️⃣ (optional): Add fit vehicles
    if (data.fitVehicles?.length) {
      await tx.productFitment.createMany({
        data: data.fitVehicles.map(engineId => ({
          productId: product.id,
          engineId: engineId,
        })),
      });
    }

    return product;
  });
};

const getProductListFromDb = async (options: ISearchAndFilterOptions) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields
  const searchFields = ['productName', 'description'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    ...(options.productName && {
      productName: {
        contains: options.productName,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.description && {
      description: {
        contains: options.description,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.sellerId && { sellerId: options.sellerId }),
    ...(options.categoryName && {
      category: {
        name: {
          contains: options.categoryName,
          mode: 'insensitive' as const,
        },
      },
    }),
    ...(options.brandName && {
      brand: {
        brandName: {
          contains: options.brandName,
          mode: 'insensitive' as const,
        },
      },
    }),
    ...(options.isVisible !== undefined && { isVisible: options.isVisible }),
  };

  // Handle seller company name filtering (nested relation)
  if (options.sellerCompanyName) {
    filterFields.seller = {
      companyName: {
        contains: options.sellerCompanyName,
        mode: 'insensitive' as const,
      },
    };
  }

  const filterQuery = buildFilterQuery(filterFields);

  // Price range filtering
  const priceQuery = buildNumericRangeQuery(
    'price',
    options.priceMin,
    options.priceMax,
  );

  // Stock range filtering
  const stockQuery = buildNumericRangeQuery(
    'stock',
    options.stockMin,
    options.stockMax,
  );

  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.startDate,
    endDate: options.endDate,
    dateField: 'createdAt',
  });

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery,
    priceQuery,
    stockQuery,
    dateQuery,
  );

  // Sorting - handle nested fields for seller and category
  let orderBy: any = {};
  if (sortBy === 'companyName') {
    orderBy = {
      seller: {
        companyName: sortOrder,
      },
    };
  } else if (sortBy === 'categoryName') {
    orderBy = {
      category: {
        name: sortOrder,
      },
    };
  } else if (sortBy === 'brandName') {
    orderBy = {
      brand: {
        brandName: sortOrder,
      },
    };
  } else {
    orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;
  }

  // Fetch total count for pagination
  const total = await prisma.product.count({ where: whereQuery });

  // Fetch paginated data
  const products = await prisma.product.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      productName: true,
      description: true,
      price: true,
      discount: true,
      stock: true,
      avgRating: true,
      totalRating: true,
      productImages: true,
      isVisible: true,
      createdAt: true,
      updatedAt: true,
      seller: {
        select: {
          userId: true,
          companyName: true,
          logo: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      brand: {
        select: {
          id: true,
          brandName: true,
          brandImage: true,
        },
      },
      _count: {
        select: {
          review: true, // Count of reviews for each product
        },
      },
    },
  });

  // flatten the response in a more usable format
  const flattenResponse = products.map(p => ({
    id: p.id,
    productName: p.productName,
    description: p.description,
    price: p.price,
    discount: p.discount,
    stock: p.stock,
    productImages: p.productImages,
    isVisible: p.isVisible,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    categoryName: p.category?.name,
    brandName: p.brand?.brandName,
    avgRating: p.avgRating,
    reviewCount: p._count.review,
    sellerName: p.seller?.companyName,
    sellerLogo: p.seller?.logo,
    sellerId: p.seller?.userId,
  }));

  return formatPaginationResponse(flattenResponse, total, page, limit);
};

const getProductsBySellerIdFromDb = async ( sellerId: string, options: ISearchAndFilterOptions) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);
  // Build search query for searchable fields
  const searchFields = ['productName', 'description'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });
  // Build filter query
  const filterFields: Record<string, any> = {
    sellerId: sellerId,
    ...(options.productName && {
      productName: {
        contains: options.productName,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.description && {
      description: {
        contains: options.description,
        mode: 'insensitive' as const,
      },
    }),
  };
  const filterQuery = buildFilterQuery(filterFields);
  // Price range filtering
  const priceQuery = buildNumericRangeQuery(
    'price',
    options.priceMin,
    options.priceMax,
  );
  // Stock range filtering
  const stockQuery = buildNumericRangeQuery(
    'stock',
    options.stockMin,
    options.stockMax,
  );
  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.startDate,
    endDate: options.endDate,
    dateField: 'createdAt',
  });
  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery,
    priceQuery,
    stockQuery,
    dateQuery,
  );
  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;
  // Fetch total count for pagination
  const total = await prisma.product.count({ where: whereQuery });
  // Fetch paginated data
  const products = await prisma.product.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      productName: true,
      description: true,
      price: true,
      discount: true,
      stock: true,
      productImages: true,

      isVisible: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          review: true, // Count of reviews for each product
        },
      },
    },
  });
  // flatten the response in a more usable format

  const flattenResponse = products.map(p => ({
    id: p.id,
    productName: p.productName,
    description: p.description,
    price: p.price,
    discount: p.discount,
    stock: p.stock,
    productImages: p.productImages,
    isVisible: p.isVisible,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    reviewCount: p._count.review,
  }));
  return formatPaginationResponse(flattenResponse, total, page, limit);
};

const getProductBySellerAndProductIdFromDb  = async ( sellerId: string, productId: string) => {
  const result =  await prisma.product.findFirst({
    where: {
      id: productId,
      sellerId: sellerId,
    },
    select: {
      id: true,
      productName: true,
      description: true,
      price: true,
      discount: true,
      stock: true,
      productImages: true,
      createdAt: true,
      updatedAt: true,
      brand: {
        select: {
          id: true,
          brandName: true,
          brandImage: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      sections: {
        select: {
          id: true,
          sectionName: true,
          parentId: true,
          fields: true,
        },
      },
      references: {
        select: {
          id: true,
          type: true,
          number: true,
        },
      },
    }

  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found for this seller');
  }
  return result;
};

const getAllProductsByCategoryFromDb = async (categoryId: string) => {
  const products = await prisma.product.findMany({
    where: {
      categoryId,
      isVisible: true,
    },
    select: {
      id: true,
      productName: true,
      productImages: true,
      price: true,
      discount: true,
      stock: true,
      avgRating: true,
      totalSold: true,
      createdAt: true,
      updatedAt: true,
      brand: {
        select: {
          id: true,
          brandName: true,
          brandImage: true,
        },
      },
      seller: {
        select: {
          userId: true,
          companyName: true,
          logo: true,
        },
      }
    },
    orderBy: { productName: 'asc' },
  });

  return products;
};


type VehicleRequest = {
  id: string; // engineId or generationId
  type?: 'engine' | 'generation';
};

/**
 * Returns:
 * {
 *   vehicle: { engineId?, generationId?, model: { id, modelName }, brand: {...}, hp?, kw?, ccm? },
 *   categories: [ { id, name, iconUrl, products: [...] }, ... ]
 * }
 */
const getCategoriesWithProductsForVehicle = async ({
  id,
  type = 'engine',
}: VehicleRequest) => {
  let engineIds: string[] = [];
  let vehicleInfo: any = null;

  if (type === 'engine') {
    const engine = await prisma.carEngine.findUnique({
      where: { id },
      include: {
        generation: {
          include: {
            model: {
              include: { brand: true },
            },
          },
        },
      },
    });

    if (!engine)
      throw new AppError(httpStatus.NOT_FOUND, 'Engine (vehicle) not found');

    engineIds = [engine.id];

    vehicleInfo = {
      engineId: engine.id,
      hp: engine.hp,
      kw: engine.kw,
      ccm: engine.ccm,
      engineCode: engine.engineCode,
      generationId: engine.generation.id,
      generationName: engine.generation.generationName,
      modelId: engine.generation.model.id,
      modelName: engine.generation.model.modelName,
      brandId: engine.generation.model.brand.id,
      brandName: engine.generation.model.brand.brandName,
    };
  } else {
    // type === 'generation'
    const generation = await prisma.carGeneration.findUnique({
      where: { id },
      include: {
        model: { include: { brand: true } },
        engines: true,
      },
    });

    if (!generation)
      throw new AppError(
        httpStatus.NOT_FOUND,
        'Generation (vehicle) not found',
      );

    engineIds = generation.engines.map(e => e.id);

    vehicleInfo = {
      generationId: generation.id,
      generationName: generation.generationName,
      modelId: generation.model.id,
      modelName: generation.model.modelName,
      brandId: generation.model.brand.id,
      brandName: generation.model.brand.brandName,
    };
  }

  // If no engine IDs found — return empty
  if (!engineIds.length) {
    return { vehicle: vehicleInfo, categories: [] };
  }

  // ───────────────────────────────
  // 2️⃣ Fetch Categories + Products
  // ───────────────────────────────
  const categories = await prisma.category.findMany({
    where: {
      product: {
        some: {
          isVisible: true,
          fitVehicles: {
            some: {
              engineId: { in: engineIds },
            },
          },
        },
      },
    },
    include: {
      product: {
        where: {
          isVisible: true,
          fitVehicles: {
            some: {
              engineId: { in: engineIds },
            },
          },
        },
        select: {
          id: true,
          productName: true,
          productImages: true,
          price: true,
          discount: true,
          stock: true,
          avgRating: true,
          totalSold: true,
          createdAt: true,
          updatedAt: true,
          brand: {
            select: {
              id: true,
              brandName: true,
              brandImage: true,
            },
          },
          seller: {
            select: {
              userId: true,
              companyName: true,
              logo: true,
            },
          },
          fitVehicles: {
            where: { engineId: { in: engineIds } },
            include: {
              engine: {
                select: {
                  id: true,
                  engineCode: true,
                  hp: true,
                  kw: true,
                  ccm: true,
                  generation: {
                    select: {
                      id: true,
                      generationName: true,
                      model: {
                        select: {
                          id: true,
                          modelName: true,
                          brand: {
                            select: {
                              id: true,
                              brandName: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          _count: { select: { review: true } },
        },
        orderBy: { productName: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  // ───────────────────────────────
  // 3️⃣ Format Result
  // ───────────────────────────────
  const formatted = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    iconUrl: cat.iconUrl,
    products: cat.product.map(p => ({
      id: p.id,
      productName: p.productName,
      productImages: p.productImages,
      price: p.price,
      discount: p.discount,
      stock: p.stock,
      avgRating: p.avgRating,
      totalSold: p.totalSold,
      brandId: p.brand?.id,
      brandName: p.brand?.brandName,
      reviewCount: p._count?.review,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      sellerName: p.seller?.companyName,
      sellerLogo: p.seller?.logo,
      sellerId: p.seller?.userId,
      // fitVehicles: p.fitVehicles.map(f => ({
      //   engine: f.engine,
      // })),
    })),
  }));

  return { vehicle: vehicleInfo, categories: formatted };
};

const getProductByIdFromDb = async (productId: string) => {
  // fetch the full product with related details (also grabs categoryId and brandId)
  const result = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      sections: {
        select: {
          id: true,
          sectionName: true,
          parentId: true,
          fields: true,
        },
      },
      references: {
        select: {
          id: true,
          type: true,
          number: true,
        },
      },
      shippings: {
        select: {
          id: true,
          countryName: true,
          countryCode: true,
          carrier: true,
          cost: true,
          deliveryMin: true,
          deliveryMax: true,
          isDefault: true,
        },
      },
      fitVehicles: {
        include: {
          engine: {
            include: {
              generation: {
                include: {
                  model: {
                    include: {
                      brand: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      seller: {
        select: {
          userId: true,
          companyName: true,
          logo: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      brand: {
        select: {
          id: true,
          brandName: true,
          brandImage: true,
        },
      },
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  // Find similar products (same category OR same brand), exclude the current product
  const similarRaw = await prisma.product.findMany({
    where: {
      id: { not: productId },
      OR: [
        { categoryId: result.category?.id ?? result.categoryId ?? undefined },
        { brandId: result.brand?.id ?? result.brandId ?? undefined },
      ].filter(Boolean) as any[],
      isVisible: true,
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      productName: true,
      productImages: true,
      price: true,
      stock: true,
      seller: { select: { companyName: true } },
    },
  });

  const similarProducts = similarRaw.map(p => ({
    id: p.id,
    companyName: p.seller?.companyName ?? null,
    productName: p.productName,
    image: p.productImages?.[0] ?? null,
    price: p.price,
    inStock: (p.stock ?? 0) > 0,
  }));

  // Return original product object extended with similarProducts array
  return {
    ...result,
    similarProducts,
  };
};

const updateProductIntoDb = async (
  userId: string,
  productId: string,
  data: UpdateProductInput,
) => {
  return await prisma.$transaction(async tx => {
    // Step 1️⃣: Update the base product (only provided fields)
    const product = await tx.product.update({
      where: { id: productId },
      data: {
        ...(data.productName && { productName: data.productName }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.brandId && { brandId: data.brandId }),
        ...(data.description && { description: data.description }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.discount !== undefined && { discount: data.discount }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.isVisible !== undefined && { isVisible: data.isVisible }),
        ...(data.productImages && { productImages: data.productImages }),
      },
    });

    // Step 2️⃣: Update Sections (optional)
    if (data.sections?.length) {
      // Delete old sections and fields before recreating
      const oldSections = await tx.productSection.findMany({
        where: { productId },
        select: { id: true },
      });
      const sectionIds = oldSections.map(s => s.id);

      if (sectionIds.length) {
        await tx.productField.deleteMany({
          where: { sectionId: { in: sectionIds } },
        });
        await tx.productSection.deleteMany({
          where: { id: { in: sectionIds } },
        });
      }

      // Create new sections and fields
      for (const section of data.sections) {
        const createdSection = await tx.productSection.create({
          data: {
            productId,
            sectionName: section.sectionName!,
            parentId: section.parentId || null,
          },
        });

        if (section.fields?.length) {
          await tx.productField.createMany({
            data: section.fields
              .filter(field => typeof field.fieldName === 'string')
              .map(field => ({
                sectionId: createdSection.id,
                fieldName: field.fieldName as string,
                valueString: field.valueString,
                valueInt: field.valueInt,
                valueFloat: field.valueFloat,
                valueDate: field.valueDate,
              })),
          });
        }
      }
    }

    // Step 3️⃣: Update References
    if (data.references?.length) {
      await tx.productReference.deleteMany({ where: { productId } });
      await tx.productReference.createMany({
        data: data.references.map(ref => ({
          productId,
          type: ref.type,
          number: ref.number,
        })),
      });
    }

    // Step 4️⃣: Update Shipping
    if (data.shipping?.length) {
      await tx.productShipping.deleteMany({ where: { productId } });
      await tx.productShipping.createMany({
        data: data.shipping.map(ship => ({
          productId,
          countryName: ship.countryName,
          countryCode: ship.countryCode,
          carrier: ship.carrier,
          cost: ship.cost,
          deliveryMin: ship.deliveryMin,
          deliveryMax: ship.deliveryMax,
          isDefault: ship.isDefault ?? false,
        })),
      });
    }

    // Step 5️⃣: Update Fit Vehicles (ProductFitment)
    if (data.fitVehicles?.length) {
      await tx.productFitment.deleteMany({ where: { productId } });
      await tx.productFitment.createMany({
        data: data.fitVehicles.map(f => ({
          productId,
          engineId: f,
        })),
      });
    }

    return product;
  });
};

const deleteProductItemFromDb = async (userId: string, productId: string) => {
  // Find product first to fetch image URLs
  const existingProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: { sellerId: true, productImages: true },
  });

  if (!existingProduct) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  if (existingProduct.sellerId !== userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Not authorized to delete this product',
    );
  }

  // Delete from DigitalOcean
  if (existingProduct.productImages?.length) {
    try {
      await Promise.all(
        existingProduct.productImages.map(url => deleteFileFromSpace(url)),
      );
    } catch (error) {
      console.error('⚠️ Failed to delete one or more images:', error);
    }
  }

  // Delete from DB (Cascade handles most relations)
  const deletedItem = await prisma.product.delete({
    where: { id: productId, sellerId: userId },
  });

  return deletedItem;
};

const getProductById = async (productId: string) => {
  return await prisma.product.findUnique({
    where: { id: productId },
    include: {
      sections: true,
      // references: true, // ✅ Updated relation
      // shippings: true, // ✅ Updated relation
      // fitVehicles: true, // ✅ Optional
    },
  });
};

export const productService = {
  createProductIntoDb,
  getAllProductsByCategoryFromDb,
  getProductBySellerAndProductIdFromDb,
  getProductsBySellerIdFromDb,
  getProductListFromDb,
  getCategoriesWithProductsForVehicle,
  getProductByIdFromDb,
  updateProductIntoDb,
  deleteProductItemFromDb,
  getProductById,
};
