import { SellerProfile } from './../../../../node_modules/.prisma/client/index.d';
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

const getAllUsersFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields
  const searchFields = ['fullName', 'email', 'phoneNumber', 'address'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    ...(options.userStatus && { status: options.userStatus }),
    ...(options.fullName && {
      fullName: {
        contains: options.fullName,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.email && {
      email: {
        contains: options.email,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.phoneNumber && {
      phoneNumber: {
        contains: options.phoneNumber,
        mode: 'insensitive' as const,
      },
    }),
    ...(options.address && {
      address: {
        contains: options.address,
        mode: 'insensitive' as const,
      },
    }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.startDate,
    endDate: options.endDate,
    dateField: 'createdAt',
  });

  // Base query for BUYER role users
  const baseQuery = {
    roles: {
      some: {
        role: {
          is: {
            name: UserRoleEnum.BUYER,
          },
        },
      },
    },
    status: UserStatus.ACTIVE,
  };

  // Combine all queries
  const whereQuery = combineQueries(
    baseQuery,
    searchQuery,
    filterQuery,
    dateQuery,
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.user.count({ where: whereQuery });

  // Fetch paginated data
  const users = await prisma.user.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      address: true,
      createdAt: true,
    },
  });

  return formatPaginationResponse(users, total, page, limit);
};

const getAUsersFromDb = async (userId: string, targetUserId: string) => {
  const result = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      roles: {
        some: {
          role: {
            is: {
              name: UserRoleEnum.BUYER,
            },
          },
        },
      },
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      status: true,
      address: true,
      createdAt: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return result;
};

const getAllSellersFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields in sellerProfile
  const searchFields = [
    'sellerProfile.companyName',
    'sellerProfile.companyEmail',
    'sellerProfile.contactInfo',
    'sellerProfile.address',
  ];

  // For nested search, we need to handle it differently
  const searchQuery = options.searchTerm
    ? {
        OR: [
          {
            sellerProfile: {
              companyName: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            sellerProfile: {
              companyEmail: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            sellerProfile: {
              contactInfo: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
          {
            sellerProfile: {
              address: {
                contains: options.searchTerm,
                mode: 'insensitive' as const,
              },
            },
          },
        ],
      }
    : {};

  // Build filter query for seller-specific fields
  const filterQuery: Record<string, any> = {};

  if (options.companyName) {
    filterQuery.sellerProfile = {
      ...filterQuery.sellerProfile,
      companyName: {
        contains: options.companyName,
        mode: 'insensitive' as const,
      },
    };
  }

  if (options.companyEmail) {
    filterQuery.sellerProfile = {
      ...filterQuery.sellerProfile,
      companyEmail: {
        contains: options.companyEmail,
        mode: 'insensitive' as const,
      },
    };
  }

  if (options.contactInfo) {
    filterQuery.sellerProfile = {
      ...filterQuery.sellerProfile,
      contactInfo: {
        contains: options.contactInfo,
        mode: 'insensitive' as const,
      },
    };
  }

  // Date range filtering for seller profiles
  const dateQuery =
    options.startDate || options.endDate
      ? {
          sellerProfile: {
            createdAt: {
              ...(options.startDate && { gte: new Date(options.startDate) }),
              ...(options.endDate && { lte: new Date(options.endDate) }),
            },
          },
        }
      : {};

  // Base query for SELLER role users
  const baseQuery = {
    roles: {
      some: {
        role: {
          is: {
            name: UserRoleEnum.SELLER,
          },
        },
      },
    },
    status: UserStatus.ACTIVE,
    sellerProfile: {
      isNot: null, // Ensure seller profile exists
    },
  };

  // Combine all queries
  const whereQuery = combineQueries(
    baseQuery,
    searchQuery,
    filterQuery,
    dateQuery,
  );

  // For sorting, we need to handle nested fields
  let orderBy: any = {};
  if (
    sortBy === 'companyName' ||
    sortBy === 'companyEmail' ||
    sortBy === 'contactInfo' ||
    sortBy === 'address'
  ) {
    orderBy = {
      sellerProfile: {
        [sortBy]: sortOrder,
      },
    };
  } else if (sortBy === 'createdAt') {
    orderBy = {
      sellerProfile: {
        createdAt: sortOrder,
      },
    };
  } else {
    orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;
  }

  // Fetch total count for pagination
  const total = await prisma.user.count({ where: whereQuery });

  // Fetch paginated data
  const result = await prisma.user.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    select: {
      sellerProfile: {
        select: {
          userId: true,
          companyName: true,
          companyEmail: true,
          contactInfo: true,
          address: true,
          logo: true,
          createdAt: true,
        },
      },
    },
  });

  // Flatten the result to return only sellerProfile array
  const sellers = result
    .map(user => user.sellerProfile)
    .filter((profile): profile is SellerProfile => profile !== null);

  return formatPaginationResponse(sellers, total, page, limit);
};

const getASellerFromDb = async (userId: string, sellerId: string) => {
  const result = await prisma.sellerProfile.findUnique({
    where: {
      userId: sellerId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Seller not found');
  }
  return result;
};

const getAllOrdersFromDb = async (userId: string, adminId: string) => {
  const result = await prisma.order.findMany({
    include: {
      items: {
        include: {
          product: { select: { id: true, productName: true, price: true } },
        },
      },
      user: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
  if (result.length === 0) {
    return { message: 'No order found' };
  }
  return result;
};

const getAOrderFromDb = async (userId: string, orderId: string) => {
  const result = await prisma.order.findFirst({
    where: {
      id: orderId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Order not found');
  }
  return result;
};

const updateUserStatusIntoDb = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  const newStatus =
    user.status === UserStatus.ACTIVE ? UserStatus.BLOCKED : UserStatus.ACTIVE;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus },
  });
  if (!updatedUser) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Failed to update user status');
  }
  return updatedUser;
};

const deleteAdminItemFromDb = async (userId: string, adminId: string) => {
  const deletedItem = await prisma.admin.delete({
    where: {
      id: adminId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'adminId, not deleted');
  }

  return deletedItem;
};

export const adminService = {
  getAllUsersFromDb,
  getAUsersFromDb,
  getAllSellersFromDb,
  getASellerFromDb,
  getAllOrdersFromDb,
  getAOrderFromDb,
  updateUserStatusIntoDb,
  deleteAdminItemFromDb,
};
