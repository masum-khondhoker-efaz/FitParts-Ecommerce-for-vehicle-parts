import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { categoryService } from './category.service';
import AppError from '../../errors/AppError';
import { uploadFileToS3 } from '../../utils/multipleFile';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createCategory = catchAsync(async (req, res) => {
  const user = req.user as any;
  const {file, body} = req;
  
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Category Image is required.');
  }

  // Upload to DigitalOcean
  const fileUrl = await uploadFileToS3(file, 'category-images');
  const categoryData = {
    ...body,
    iconUrl: fileUrl,
  };
  const result = await categoryService.createCategoryIntoDb(user.id, categoryData);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Category created successfully',
    data: result,
  });
});

const getCategoryList = catchAsync(async (req, res) => {
  const result = await categoryService.getCategoryListFromDb(req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getCategoryById = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await categoryService.getCategoryByIdFromDb( req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category details retrieved successfully',
    data: result,
  });
});

const updateCategory = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { file, body } = req;

  let categoryData = { ...body };

  if (file) {
    // Upload to DigitalOcean
    const fileUrl = await uploadFileToS3(file, 'category-images');
    categoryData.iconUrl = fileUrl;
  }
  const result = await categoryService.updateCategoryIntoDb(user.id, req.params.id, categoryData);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category updated successfully',
    data: result,
  });
});

const deleteCategory = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await categoryService.deleteCategoryItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category deleted successfully',
    data: result,
  });
});

export const categoryController = {
  createCategory,
  getCategoryList,
  getCategoryById,
  updateCategory,
  deleteCategory,
};