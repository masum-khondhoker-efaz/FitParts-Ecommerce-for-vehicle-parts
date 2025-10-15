import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';
import { buildSearchQuery, buildFilterQuery, combineQueries, buildDateRangeQuery } from '../../utils/searchFilter';
import { formatPaginationResponse, getPaginationQuery } from '../../utils/pagination';


const createCategoryIntoDb = async (userId: string, data: any) => {

  const existingCategory = await prisma.category.findFirst({
    where: {
      name: data.name,
    },
  });
  if (existingCategory) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Category with this name already exists');
  }
  
    const result = await prisma.category.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'category not created');
  }
    return result;
};

const getCategoryListFromDb = async (options: ISearchAndFilterOptions) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields
  const searchFields = [
    'name',
    'description',
  ];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    ...(options.categoryName && { 
      name: {
        contains: options.categoryName,
        mode: 'insensitive' as const,
      }
    }),
    // ...(options.categoryDescription && { 
    //   description: {
    //     contains: options.categoryDescription,
    //     mode: 'insensitive' as const,
    //   }
    // }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.startDate,
    endDate: options.endDate,
    dateField: 'createdAt',
  });

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery,
    dateQuery
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.category.count({ where: whereQuery });

  // Fetch paginated data
  const categories = await prisma.category.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      _count: {
        select: {
          product: true, // Count of products in each category
        }
      },
    },
  });

  return formatPaginationResponse(categories, total, page, limit);
};

const getCategoryByIdFromDb = async (categoryId: string) => {
  
    const result = await prisma.category.findUnique({ 
    where: {
      id: categoryId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'category not found');
  }
    return result;
  };



const updateCategoryIntoDb = async (userId: string, categoryId: string, data: Partial<any>) => {

  if (data.name) {
    const existingCategory = await prisma.category.findFirst({
      where: {
        id: { not: categoryId },
        name: data.name,
      },
    });
    if (existingCategory) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Category with this name already exists');
    }
  }

  const result = await prisma.category.update({
    where: {
      id: categoryId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'categoryId, not updated');
  }
  return result;
};

const deleteCategoryItemFromDb = async (userId: string, categoryId: string) => {


  const existingCategory = await prisma.category.findUnique({
    where: {
      id: categoryId,
    },
  });
  if (!existingCategory) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }

  const findCoursesWithCategory = await prisma.product.findFirst({
    where: {
      categoryId: categoryId,
    },
  });
  if (findCoursesWithCategory) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cannot delete category with associated courses');
  }

    const deletedItem = await prisma.category.delete({
      where: {
      id: categoryId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'categoryId, not deleted');
  }

    return deletedItem;
  };

export const categoryService = {
createCategoryIntoDb,
getCategoryListFromDb,
getCategoryByIdFromDb,
updateCategoryIntoDb,
deleteCategoryItemFromDb,
};