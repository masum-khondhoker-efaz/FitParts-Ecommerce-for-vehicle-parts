import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { adminService } from './admin.service';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const getAllUsers = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAllUsersFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getAUser = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAUsersFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User details retrieved successfully',
    data: result,
  });
});

const getAllSellers = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAllSellersFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Seller list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getASeller  = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getASellerFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Seller details retrieved successfully',
    data: result,
  });
});

const getAllOrders = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAllOrdersFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order list retrieved successfully',
    data: result,
  });
});

const getAOrder  = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.getAOrderFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order details retrieved successfully',
    data: result,
  });
});


const updateUserStatus = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.updateUserStatusIntoDb(
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin updated successfully',
    data: result,
  });
});

const deleteAdmin = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await adminService.deleteAdminItemFromDb(
    user.id,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin deleted successfully',
    data: result,
  });
});

export const adminController = {
  getAllUsers,
  getAUser,
  getAllSellers,
  getASeller,
  getAllOrders,
  getAOrder,
  updateUserStatus,
  deleteAdmin,
};
