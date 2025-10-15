import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { productService } from './product.service';
import AppError from '../../errors/AppError';
import { uploadFileToSpace } from '../../utils/multipleFile';
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
      uploadedFiles.map((file) => uploadFileToSpace(file, 'product-images')),
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
  const result = await productService.getProductListFromDb(req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product list retrieved successfully',
    data: result.data,
    meta: result.meta,
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
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Product images are required for update');
  }

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

  // 🧩 Upload new images
  const uploadedFiles = files as Express.Multer.File[];
  const newImageUrls = await Promise.all(
    uploadedFiles.map((file) => uploadFileToSpace(file, 'product-images')),
  );

  // 🧩 Delete old images from DigitalOcean
  if (existingProduct.productImages?.length) {
    await Promise.all(
      existingProduct.productImages.map((url: string) => deleteFileFromSpace(url)),
    );
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
  const result = await productService.deleteProductItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Product deleted successfully',
    data: result,
  });
});

export const productController = {
  createProduct,
  getProductList,
  getProductById,
  updateProduct,
  deleteProduct,
};