import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { carBrandService } from './carBrand.service';

const createCarBrand = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await carBrandService.createCarBrandIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'CarBrand created successfully',
    data: result,
  });
});

const getCarBrandList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await carBrandService.getCarBrandListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CarBrand list retrieved successfully',
    data: result,
  });
});

const getCarBrandById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await carBrandService.getCarBrandByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CarBrand details retrieved successfully',
    data: result,
  });
});

const updateCarBrand = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await carBrandService.updateCarBrandIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CarBrand updated successfully',
    data: result,
  });
});

const deleteCarBrand = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await carBrandService.deleteCarBrandItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CarBrand deleted successfully',
    data: result,
  });
});

export const carBrandController = {
  createCarBrand,
  getCarBrandList,
  getCarBrandById,
  updateCarBrand,
  deleteCarBrand,
};