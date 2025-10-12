import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { CreateProductInput } from './product.interface';
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
            data: section.fields.map(field => ({
              sectionId: createdSection.id,
              fieldName: field.fieldName,
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
          engineId,
        })),
      });
    }

    return product;
  });
};

// -----------------------------
// GET PRODUCT LIST
// -----------------------------
const getProductListFromDb = async (userId: string) => {
  const result = await prisma.product.findMany({
    include: {
      seller: {
        select: {
          userId: true,
          companyName: true,
          logo: true,
        },
      },
    },
  });

  if (!result.length) {
    return { message: 'No products found' };
  }

  return result;
};

// -----------------------------
// GET PRODUCT BY ID
// -----------------------------
const getProductByIdFromDb = async (userId: string, productId: string) => {
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
      // references: { // ✅ Updated relation name
      //   select: {
      //     id: true,
      //     type: true,
      //     number: true,
      //   },
      // },
      // shippings: { // ✅ Updated relation name
      //   select: {
      //     id: true,
      //     countryName: true,
      //     countryCode: true,
      //     carrier: true,
      //     cost: true,
      //     deliveryMin: true,
      //     deliveryMax: true,
      //     isDefault: true,
      //   },
      // },
      // fitVehicles: { // ✅ New relation (optional)
      //   include: {
      //     engine: {
      //       include: {
      //         generation: {
      //           include: {
      //             model: {
      //               include: {
      //                 brand: true,
      //               },
      //             },
      //           },
      //         },
      //       },
      //     },
      //   },
      // },
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
const updateProductIntoDb = async (userId: string, productId: string, data: any) => {
  const updated = await prisma.product.update({
    where: { id: productId, sellerId: userId },
    data,
  });

  if (!updated) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Product not updated');
  }

  return updated;
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
