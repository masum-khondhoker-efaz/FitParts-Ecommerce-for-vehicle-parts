import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { favoriteProductService } from './favoriteProduct.service';

const createFavoriteProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteProductService.createFavoriteProductIntoDb(
    user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'FavoriteProduct created successfully',
    data: result,
  });
});

const getFavoriteProductList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteProductService.getFavoriteProductListFromDb(
    user.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteProduct list retrieved successfully',
    data: result,
  });
});

const getFavoriteProductById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteProductService.getFavoriteProductByIdFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteProduct details retrieved successfully',
    data: result,
  });
});

const updateFavoriteProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteProductService.updateFavoriteProductIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteProduct updated successfully',
    data: result,
  });
});

const deleteFavoriteProduct = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteProductService.deleteFavoriteProductItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteProduct deleted successfully',
    data: result,
  });
});

export const favoriteProductController = {
  createFavoriteProduct,
  getFavoriteProductList,
  getFavoriteProductById,
  updateFavoriteProduct,
  deleteFavoriteProduct,
};
