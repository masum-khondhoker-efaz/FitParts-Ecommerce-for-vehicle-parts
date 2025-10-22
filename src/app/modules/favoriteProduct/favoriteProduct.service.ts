import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';
import {
  buildSearchQuery,
  buildFilterQuery,
  combineQueries,
  buildDateRangeQuery,
} from '../../utils/searchFilter';
import {
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';

const createFavoriteProductIntoDb = async (userId: string, data: any) => {
  // find Existing
  const existingFavorite = await prisma.favoriteProduct.findFirst({
    where: {
      userId: userId,
      productId: data.productId,
    },
  });
  if (existingFavorite) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Product already in favorite list',
    );
  }

  const result = await prisma.favoriteProduct.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Favorite Product not added');
  }
  return result;
};

const getFavoriteProductListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields in related product
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            product: {
              productName: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            product: {
              description: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
        ],
      }
    : {};

  // Build filter query
  const filterFields: Record<string, any> = {
    userId: userId, // Always filter by current user
    // ...(options.productId && { productId: options.productId }),
  };

  // Handle nested product filters
  if (options.productName) {
    filterFields.product = {
      ...filterFields.product,
      productName: {
        contains: options.productName,
        mode: 'insensitive' as const,
      },
    };
  }

  if (options.categoryName) {
    filterFields.product = {
      ...filterFields.product,
      category: {
        name: {
          contains: options.categoryName,
          mode: 'insensitive' as const,
        },
      },
    };
  }

  if (options.brandName) {
    filterFields.product = {
      ...filterFields.product,
      brand: {
        brandName: {
          contains: options.brandName,
          mode: 'insensitive' as const,
        },
      },
    };
  }

  if (options.sellerCompanyName) {
    filterFields.product = {
      ...filterFields.product,
      seller: {
        companyName: {
          contains: options.sellerCompanyName,
          mode: 'insensitive' as const,
        },
      },
    };
  }

  const filterQuery = buildFilterQuery(filterFields);

  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.startDate,
    endDate: options.endDate,
    dateField: 'createdAt',
  });

  // Combine all queries
  const whereQuery = combineQueries(searchQuery, filterQuery, dateQuery);

  // Sorting - handle nested fields for product
  let orderBy: any = {};
  if (sortBy === 'productName') {
    orderBy = {
      product: {
        productName: sortOrder,
      },
    };
  } else if (sortBy === 'price') {
    orderBy = {
      product: {
        price: sortOrder,
      },
    };
  } else if (sortBy === 'companyName') {
    orderBy = {
      product: {
        seller: {
          companyName: sortOrder,
        },
      },
    };
  } else {
    orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;
  }

  // Fetch total count for pagination
  const total = await prisma.favoriteProduct.count({ where: whereQuery });

  // Fetch paginated data
  const favoriteProducts = await prisma.favoriteProduct.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          description: true,
          price: true,
          discount: true,
          stock: true,
          productImages: true,
          isVisible: true,
          createdAt: true,
          seller: {
            select: {
              userId: true,
              companyName: true,
              logo: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          brand: {
            select: {
              id: true,
              brandName: true,
              brandImage: true,
            },
          },
          _count: {
            select: {
              review: true, // Count of reviews for each product
            },
          },
        },
      },
    },
  });

  return formatPaginationResponse(favoriteProducts, total, page, limit);
};

const getFavoriteProductByIdFromDb = async (
  userId: string,
  favoriteProductId: string,
) => {
  const result = await prisma.favoriteProduct.findUnique({
    where: {
      id: favoriteProductId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'favoriteProduct not found');
  }
  return result;
};

const updateFavoriteProductIntoDb = async (
  userId: string,
  favoriteProductId: string,
  data: any,
) => {
  const result = await prisma.favoriteProduct.update({
    where: {
      id: favoriteProductId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'favoriteProductId, not updated',
    );
  }
  return result;
};

const deleteAllFavoriteProductsFromDb = async (userId: string) => {
  const deletedItems = await prisma.favoriteProduct.deleteMany({
    where: {
      userId: userId,
    },
  });
  if (!deletedItems) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Favorite products not deleted');
  }
  return deletedItems;
};

const deleteFavoriteProductItemFromDb = async (
  userId: string,
  productId: string,
) => {
  //find existing favorite
  const existingFavorite = await prisma.favoriteProduct.findFirst({
    where: {
      userId: userId,
      productId: productId,
    },
  });
  if (!existingFavorite) {
    throw new AppError(httpStatus.NOT_FOUND, 'Favorite product not found');
  }

  const deletedItem = await prisma.favoriteProduct.deleteMany({
    where: {
      productId: productId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'favoriteProductId, not deleted',
    );
  }

  return deletedItem;
};

export const favoriteProductService = {
  createFavoriteProductIntoDb,
  getFavoriteProductListFromDb,
  getFavoriteProductByIdFromDb,
  updateFavoriteProductIntoDb,
  deleteAllFavoriteProductsFromDb,
  deleteFavoriteProductItemFromDb,
};
