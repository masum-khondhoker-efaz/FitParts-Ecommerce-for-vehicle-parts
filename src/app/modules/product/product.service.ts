import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { CreateProductInput } from './product.interface';
import { deleteFileFromSpace } from '../../utils/deleteImage';

const createProductIntoDb = async (
  userId: string,
  data: CreateProductInput,
) => {
  return await prisma.$transaction(async tx => {
    // Step 1: Create the product
    const product = await tx.product.create({
      data: {
        sellerId: userId,
        productName: data.productName,
        productImages: data.productImages,
        description: data.description,
        price: data.price,
        stock: data.stock,
        isVisible: data.isVisible ?? true,
      },
    });

    // Step 2: Add sections & fields
    if (data.sections && data.sections.length > 0) {
      for (const section of data.sections) {
        const createdSection = await tx.productSection.create({
          data: {
            productId: product.id,
            name: section.name,
            parentId: section.parentId || null,
          },
        });

        if (section.fields && section.fields.length > 0) {
          await tx.productField.createMany({
            data: section.fields.map(field => ({
              sectionId: createdSection.id,
              name: field.name,
              valueString: field.valueString,
              valueInt: field.valueInt,
              valueFloat: field.valueFloat,
              valueDate: field.valueDate,
            })),
          });
        }
      }
    }

    // Step 3: Add references
    if (data.references && data.references.length > 0) {
      await tx.productReference.createMany({
        data: data.references.map(ref => ({
          productId: product.id,
          type: ref.type,
          number: ref.number,
        })),
      });
    }

    // Step 4: Add shipping options
    if (data.shipping && data.shipping.length > 0) {
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

    return product;
  });
};

const getProductListFromDb = async (userId: string) => {
  const result = await prisma.product.findMany({
    include: {
      seller: {
        select: {
          id: true,
          companyName: true,
          logo: true,
        },
      },
    },
  });

  if (!result || result.length === 0) {
    return { message: 'No product found' };
  }

  return result;
};

const getProductByIdFromDb = async (userId: string, productId: string) => {
  const result = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    include: {
      sections: {
        select: {
          id: true,
          name: true,
          parentId: true,
          fields: {
            select: {
              id: true,
              name: true,
              valueString: true,
              valueInt: true,
              valueFloat: true,
              valueDate: true,
            },
          },
        },
      },
      ProductReference: {
        select: {
          id: true,
          type: true,
          number: true,
        },
      },
      ProductShipping: {
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
      seller: {
        select: {
          id: true,
          companyName: true,
          logo: true,
        },
      },
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'product not found');
  }
  return result;
};

const updateProductIntoDb = async (
  userId: string,
  productId: string,
  data: any,
) => {
  // All fields optional — Prisma ignores `undefined` automatically
  const updated = await prisma.product.update({
    where: { id: productId, sellerId: userId },
    data: {
      ...data,
    },
  });

  if (!updated) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Product not updated');
  }

  return updated;
};

const deleteProductItemFromDb = async (userId: string, productId: string) => {
  // Step 1️⃣: Find product first to get image URLs
  const existingProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: { sellerId: true, productImages: true },
  });

  if (!existingProduct) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  // Step 2️⃣: Ensure the seller owns this product
  if (existingProduct.sellerId !== userId) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized to delete this product');
  }

  // Step 3️⃣: Delete product images from cloud (DigitalOcean Spaces)
  if (existingProduct.productImages && existingProduct.productImages.length > 0) {
    try {
      await Promise.all(
        existingProduct.productImages.map(async (url: string) => {
          await deleteFileFromSpace(url);
        }),
      );
      console.log('🧹 Product images deleted from DigitalOcean successfully');
    } catch (error) {
      console.error('⚠️ Error deleting one or more images from DigitalOcean:', error);
      // we still continue to delete the product itself to avoid dangling DB entries
    }
  }

  // Step 4️⃣: Delete the product from DB
  const deletedItem = await prisma.$transaction(async tx => {
    // Delete ProductFields (fields belong to sections)
    await tx.productField.deleteMany({
      where: {
        section: {
          productId: productId,
        },
      },
    });

    // Delete ProductSections
    await tx.productSection.deleteMany({
      where: {
        productId: productId,
      },
    });

    // Delete ProductReferences
    await tx.productReference.deleteMany({
      where: {
        productId: productId,
      },
    });

    // Delete ProductShipping
    await tx.productShipping.deleteMany({
      where: {
        productId: productId,
      },
    });

    // Finally, delete the product itself
    return await tx.product.delete({
      where: { id: productId, sellerId: userId },
    });
  });

  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Product not deleted');
  }

  console.log('✅ Product deleted successfully:', deletedItem.id);

  return deletedItem;
};

// Helper function to get course by ID
const getProductById = async (productId: string) => {
  return await prisma.product.findUnique({
    where: { id: productId },
    include: {
      sections: true,
      ProductReference: true,
      ProductShipping: true,
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
