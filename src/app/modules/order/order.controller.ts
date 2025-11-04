import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { orderService } from './order.service';
import { IPaginationOptions, ISearchAndFilterOptions } from '../../interface/pagination.type';

const createOrder = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await orderService.createOrderIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Order created successfully',
    data: result,
  });
});

const getDashboardSummary = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await orderService.getDashboardSummaryFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Dashboard summary retrieved successfully',
    data: result,
  });
});

const getOrderList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await orderService.getOrderListFromDb(user.id, req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getAllOrders = catchAsync(async (req, res) => {
   const user = req.user as any;
  const result = await orderService.getAllOrdersFromDb(user.id, req.query as IPaginationOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All orders retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getAOrderById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await orderService.getAOrderByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order details retrieved successfully',
    data: result,
  });
});

const updateOrderStatus = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await orderService.updateOrderStatusIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order status updated successfully',
    data: result,
  });
});

const getSalesReport = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await orderService.getSalesReportFromDb(user.id, req.query as IPaginationOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Sales report retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getOrderById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await orderService.getOrderByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order details retrieved successfully',
    data: result,
  });
});

const updateOrder = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await orderService.updateOrderIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order updated successfully',
    data: result,
  });
});

const deleteOrder = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await orderService.deleteOrderItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Order deleted successfully',
    data: result,
  });
});

export const orderController = {
  createOrder,
  getDashboardSummary,
  getOrderList,
  getAOrderById,
  getAllOrders,
  updateOrderStatus,
  getSalesReport,
  getOrderById,
  updateOrder,
  deleteOrder,
};