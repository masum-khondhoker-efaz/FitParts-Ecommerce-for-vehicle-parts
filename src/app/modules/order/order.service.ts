import prisma from '../../utils/prisma';
import { OrderStatus, PaymentStatus, UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';
import {
  buildSearchQuery,
  buildFilterQuery,
  combineQueries,
  buildDateRangeQuery,
  buildNumericRangeQuery,
} from '../../utils/searchFilter';
import { formatPaginationResponse, getPaginationQuery } from '../../utils/pagination';

const createOrderIntoDb = async (userId: string, data: any) => {
  const result = await prisma.order.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'order not created');
  }
  return result;
};

const getDashboardSummaryFromDb = async (userId: string) => {

  const sellerName = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });
  if (!sellerName) {
    throw new AppError(httpStatus.NOT_FOUND, 'Seller user not found');
  }

  // Total Orders
  const totalOrders = await prisma.order.count({
    where: {
      sellerId: userId,
      status: OrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });

  // Total Sales Amount
  const totalSalesResult = await prisma.order.aggregate({
    where: {
      sellerId: userId,
      paymentStatus: 'COMPLETED',
    },
    _sum: {
      totalAmount: true,
    },
  });
  const totalSalesAmount = totalSalesResult._sum.totalAmount || 0;

  // Pending Orders
  const currentOrders = await prisma.order.count({
    where: {
      sellerId: userId,
      status: OrderStatus.PROCESSING,
      paymentStatus: PaymentStatus.COMPLETED || PaymentStatus.CASH,
    },
  });

  return {
    sellerName: sellerName.fullName,
    totalOrders,
    totalSalesAmount,
    currentOrders,
  };
}

const getOrderListFromDb = async (
  userId: string,
  options: ISearchAndFilterOptions,
) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields
  const searchFields = ['transactionId', 'notes'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    userId: userId, // Always filter by current user
    ...(options.status && { status: options.status }),
    ...(options.paymentMethod && { paymentStatus: options.paymentMethod }),
    ...(options.transactionId && {
      transactionId: {
        contains: options.transactionId,
        mode: 'insensitive' as const,
      },
    }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Total amount range filtering
  const totalAmountQuery = buildNumericRangeQuery(
    'totalAmount',
    options.priceMin,
    options.priceMax,
  );

  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.orderDateStart || options.startDate,
    endDate: options.orderDateEnd || options.endDate,
    dateField: 'createdAt',
  });

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery,
    totalAmountQuery,
    dateQuery,
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.order.count({ where: whereQuery });

  // Fetch paginated data
  const orders = await prisma.order.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      items: {
        select: {
          product: {
            select: {
              id: true,
              productName: true,
              price: true,
              discount: true,
              productImages: true,
            },
          },
        },
      },
      shipping: {
        select: {
          id: true,
          userId: true,
          addressLine: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          type: true,
        },  
      },
      billing: {
        select: {
          id: true,
          userId: true,
          addressLine: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          type: true,
        },  
      },
      // payment: true,
      // user: {
      //   select: {
      //     id: true,
      //     fullName: true,
      //     email: true,
      //     phoneNumber: true,
      //   },
      // },
    },
  });

  // Flatten the response - extract only product details from items
  const flattenedOrders = orders.map(order => ({
    orderId: order.id,
    userId: order.userId,
    paymentId: order.paymentId,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    notes: order.notes,
    invoice: order.invoice,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map(item => item.product),
    quantity: order.items.length,
    shipping: order.shipping ? { ...order.shipping } : null,
    billing: order.billing ? { ...order.billing } : null,
  }));

  return formatPaginationResponse(flattenedOrders, total, page, limit);

 
};

const getAllOrdersFromDb = async (sellerId: string, options: ISearchAndFilterOptions) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields
  const searchFields = ['transactionId', 'notes'];
  const searchQuery = buildSearchQuery({
    searchTerm: options.searchTerm,
    searchFields,
  });

  // Build filter query
  const filterFields: Record<string, any> = {
    sellerId: sellerId, // Always filter by current seller
    ...(options.status && { status: options.status }),
    ...(options.paymentMethod && { paymentStatus: options.paymentMethod }),
    ...(options.transactionId && {
      transactionId: {
        contains: options.transactionId,
        mode: 'insensitive' as const,
      },
    }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Total amount range filtering
  const totalAmountQuery = buildNumericRangeQuery(
    'totalAmount',
    options.priceMin,
    options.priceMax,
  );

  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.orderDateStart || options.startDate, 
    endDate: options.orderDateEnd || options.endDate,
    dateField: 'createdAt',
  });

  // Combine all queries
  const whereQuery = combineQueries(
    searchQuery,
    filterQuery,
    totalAmountQuery,
    dateQuery,
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.order.count({ where: whereQuery });

  // Fetch paginated data
  const orders = await prisma.order.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      items: {
        select: {
          product: {
            select: {
              id: true,
              productName: true,
              price: true,
              discount: true,
              productImages: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          image: true,
        },
      },
    }
  });

  // Flatten the response - extract only product details from items
  const flattenedOrders = orders.map(order => ({
    orderId: order.id,
    userId: order.userId,
    totalAmount: order.totalAmount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    notes: order.notes,
    invoice: order.invoice,
    createdAt: order.createdAt,
    items: order.items.map(item => item.product),
    quantity: order.items.length,
    customerName: order.user ? order.user.fullName : null,
    // customerEmail: order.user ? order.user.email : null,
    // customerPhoneNumber: order.user ? order.user.phoneNumber : null,
    customerImage: order.user ? order.user.image : null,
  }));

  return formatPaginationResponse(flattenedOrders, total, page, limit);
};

const updateOrderStatusIntoDb = async (
  userId: string,
  orderId: string,
  data: any,
) => {

  const result = await prisma.order.updateMany({
    where: {
      id: orderId,
      sellerId: userId,
    },
    data: {
      ...data,
    },
  });
  if (result.count === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'orderId, not updated');
  }
  const updatedOrder = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
  return updatedOrder;
}

const getSalesReportFromDb = async (sellerId: string, options: ISearchAndFilterOptions) => {
  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build filter query - enforce delivered & completed only
  const filterFields: Record<string, any> = {
    sellerId: sellerId, // Always filter by current seller
    status: 'DELIVERED', // only delivered orders
    paymentStatus: 'COMPLETED', // only completed payments
    ...(options.transactionId && {
      transactionId: {
        contains: options.transactionId,
        mode: 'insensitive' as const,
      },
    }),
  };
  const filterQuery = buildFilterQuery(filterFields);

  // Date range filtering
  const dateQuery = buildDateRangeQuery({
    startDate: options.orderDateStart || options.startDate,
    endDate: options.orderDateEnd || options.endDate,
    dateField: 'createdAt',
  });

  // Combine all queries
  const whereQuery = combineQueries(
    filterQuery,
    dateQuery,
  );

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Fetch total count for pagination
  const total = await prisma.order.count({ where: whereQuery });

  // Fetch paginated data
  const orders = await prisma.order.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      payment:{
        select: {
          id: true,
          paymentDate: true,
          paymentAmount: true,
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            }
          }
        }
      }
    }
  });

  // Format the sales report data
  const formattedOrders = orders.map(order => ({
    orderId: order.id,
    totalAmount: order.totalAmount,
    orderDate: order.createdAt,
    paymentMethod: order.paymentStatus,
    orderStatus: order.status,
    paymentDate: order.payment ? order.payment.paymentDate : null,
    paymentAmount: order.payment ? order.payment.paymentAmount : null,
    customerName: order.payment && order.payment.user ? order.payment.user.fullName : null,
    customerEmail: order.payment && order.payment.user ? order.payment.user.email : null,
  }));



  return formatPaginationResponse(formattedOrders, total, page, limit);
};

const getOrderByIdFromDb = async (userId: string, orderId: string) => {
  const result = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'order not found');
  }
  return result;
};

const updateOrderIntoDb = async (
  userId: string,
  orderId: string,
  data: any,
) => {
  const result = await prisma.order.update({
    where: {
      id: orderId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'orderId, not updated');
  }
  return result;
};

const deleteOrderItemFromDb = async (userId: string, orderId: string) => {
  const deletedItem = await prisma.order.delete({
    where: {
      id: orderId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'orderId, not deleted');
  }

  return deletedItem;
};

export const orderService = {
  createOrderIntoDb,
  getDashboardSummaryFromDb,
  getOrderListFromDb,
  getAllOrdersFromDb,
  updateOrderStatusIntoDb,
  getSalesReportFromDb,
  getOrderByIdFromDb,
  updateOrderIntoDb,
  deleteOrderItemFromDb,
};
