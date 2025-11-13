import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { productService } from './product.service';
import AppError from '../../errors/AppError';
import { uploadFileToS3 } from '../../utils/multipleFile';
import { UserRoleEnum } from '@prisma/client';
import { deleteFileFromSpace } from '../../utils/deleteImage';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { files, body } = req;

  if (!files || (Array.isArray(files) && files.length === 0)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'No files uploaded');
  }

  const uploads: { productImages: string[] } = { productImages: [] };

  // files is an array since we used .array()
  const uploadedFiles = files as Express.Multer.File[];

  if (uploadedFiles.length) {
    const imageUploads = await Promise.all(
      uploadedFiles.map(file => uploadFileToS3(file, 'product-images')),
    );
    uploads.productImages.push(...imageUploads);
  }

  const productData = {
    ...body,
    productImages: uploads.productImages,
    sellerId: user.id, // ensure sellerId is included
  };

  // console.log('Product Data:', productData);

  const result = await productService.createProductIntoDb(user.id, productData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Product created successfully',
    data: result,
  });
});

const getProductList = catchAsync(async (req, res) => {
  const result = await productService.getProductListFromDb(
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getProductsBySellerId = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.getProductsBySellerIdFromDb(
    user.id,
    req.query as ISearchAndFilterOptions,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Products for seller retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getProductBySellerAndProductId = catchAsync(async (req, res) => {
  const user = req.user as any;
  const productId = req.params.id;

  const result = await productService.getProductBySellerAndProductIdFromDb(
    user.id,
    productId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product details for seller retrieved successfully',
    data: result,
  });
});

const getAllCategoryWiseProducts = catchAsync(async (req, res) => {
  const { id } = req.params; // categoryId

  const result = await productService.getAllProductsByCategoryFromDb(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category wise products retrieved successfully',
    data: result,
  });
});

const getCategoriesByVehicle = catchAsync(async (req, res) => {
  const { id } = req.params; // engineId or generationId
  const rawType = req.query.type as string | undefined;
  const allowedTypes = ['engine', 'generation'] as const;
  const type = allowedTypes.includes(rawType as any)
    ? (rawType as 'engine' | 'generation')
    : 'engine';

  const result = await productService.getCategoriesWithProductsForVehicle({
    id,
    type,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Categories with related products retrieved successfully',
    data: result,
  });
});

const getProductById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.getProductByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product details retrieved successfully',
    data: result,
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { files, body } = req;

  const productId = req.params.id;

  // 🧩 Ensure images are provided
  // if (!files || !Array.isArray(files) || files.length === 0) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'Product images are required for update',
  //   );
  // }

  // 🧩 Fetch product
  const existingProduct = await productService.getProductById(productId);
  if (!existingProduct) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  // 🧩 Ensure seller owns the product (unless admin)
  if (
    user.role === UserRoleEnum.SELLER &&
    existingProduct.sellerId !== user.id
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You are not authorized to update this product',
    );
  }

  // 🧩 Handle images: if new files provided -> upload them and remove old ones from storage.
  let newImageUrls: string[] = existingProduct.productImages ?? [];

  if (files && Array.isArray(files) && files.length > 0) {
    const uploadedFiles = files as Express.Multer.File[];
    newImageUrls = await Promise.all(
      uploadedFiles.map(file => uploadFileToS3(file, 'product-images')),
    );

    // Delete old images from DigitalOcean / Spaces only when replaced
    if (existingProduct.productImages?.length) {
      await Promise.all(
        existingProduct.productImages.map((url: string) => deleteFileFromSpace(url)),
      );
      console.log('Old product images deleted from storage');
    }
  }

  // 🧩 Merge data
  const productData = {
    ...body,
    productImages: newImageUrls,
    sellerId: existingProduct.sellerId, // preserve seller link
  };

  const updatedProduct = await productService.updateProductIntoDb(
    user.id,
    productId,
    productData,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product updated successfully',
    data: updatedProduct,
  });
});

const deleteProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await productService.deleteProductItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product deleted successfully',
    data: result,
  });
});

export const productController = {
  createProduct,
  getAllCategoryWiseProducts,
  getProductBySellerAndProductId,
  getProductsBySellerId,
  getProductList,
  getCategoriesByVehicle,
  getProductById,
  updateProduct,
  deleteProduct,
};
