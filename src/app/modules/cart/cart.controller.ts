import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { cartService } from './cart.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createCart = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.createCartIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Cart created successfully',
    data: result,
  });
});

const bulkCreateCart = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.bulkCreateCartIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Cart items created successfully',
    data: result,
  });
});

const getCartList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.getCartListFromDb(
    user.id,
    req.query as ISearchAndFilterOptions
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getCartById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.getCartByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart details retrieved successfully',
    data: result,
  });
});

const updateCart = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.updateCartIntoDb(
    user.id,
    req.params.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart item updated successfully',
    data: result,
  });
});

const deleteAllCarts = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.deleteAllCartsFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All carts deleted successfully',
    data: result,
  });
});

const deleteCart = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await cartService.deleteCartItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Cart deleted successfully',
    data: result,
  });
});

export const cartController = {
  createCart,
  bulkCreateCart,
  getCartList,
  getCartById,
  updateCart,
  deleteAllCarts,
  deleteCart,
};
