import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { addressService } from './address.service';

const createAddress = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await addressService.createAddressIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Address created successfully',
    data: result,
  });
});

const getAddressList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await addressService.getAddressListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Address list retrieved successfully',
    data: result,
  });
});

const getAddressById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await addressService.getAddressByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Address details retrieved successfully',
    data: result,
  });
});

const updateAddress = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await addressService.updateAddressIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Address updated successfully',
    data: result,
  });
});

const deleteAddress = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await addressService.deleteAddressItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Address deleted successfully',
    data: result,
  });
});

export const addressController = {
  createAddress,
  getAddressList,
  getAddressById,
  updateAddress,
  deleteAddress,
};