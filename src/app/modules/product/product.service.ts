import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { CreateProductInput, UpdateProductInput } from './product.interface';
import { deleteFileFromSpace } from '../../utils/deleteImage';

// -----------------------------
// CREATE PRODUCT
// -----------------------------
const createProductIntoDb = async (userId: string, data: CreateProductInput) => {
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

// -----------------------------
// GET PRODUCT LIST
// -----------------------------
const getProductListFromDb = async () => {
  const result = await prisma.product.findMany({
    select: {
      id: true,
      productName: true,
      price: true,
      seller: {
        select: {
          userId: true,
          companyName: true,
          logo: true,
        },
      },
    },
  });

  return result.length
    ? result
    : { message: 'No products found' };
};


// -----------------------------
// GET PRODUCT BY ID
// -----------------------------
const getProductByIdFromDb = async (productId: string) => {
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
      references: { // ✅ Updated relation name
        select: {
          id: true,
          type: true,
          number: true,
        },
      },
      shippings: { // ✅ Updated relation name
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
      fitVehicles: { // ✅ New relation (optional)
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
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  return result;
};

// -----------------------------
// UPDATE PRODUCT
// -----------------------------
const updateProductIntoDb = async (userId: string, productId: string, data: UpdateProductInput) => {
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
          engineId: f.engineId,
        })),
      });
    }

    return product;
  });
};


// -----------------------------
// DELETE PRODUCT
// -----------------------------
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
    throw new AppError(httpStatus.FORBIDDEN, 'Not authorized to delete this product');
  }

  // Delete from DigitalOcean
  if (existingProduct.productImages?.length) {
    try {
      await Promise.all(existingProduct.productImages.map(url => deleteFileFromSpace(url)));
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

// -----------------------------
// HELPER: Get by ID with details
// -----------------------------
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
  getProductListFromDb,
  getProductByIdFromDb,
  updateProductIntoDb,
  deleteProductItemFromDb,
  getProductById,
};
