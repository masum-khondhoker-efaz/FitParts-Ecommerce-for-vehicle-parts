import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';
import { buildSearchQuery, buildFilterQuery, combineQueries, buildDateRangeQuery, buildNumericRangeQuery } from '../../utils/searchFilter';
import { formatPaginationResponse, getPaginationQuery } from '../../utils/pagination';

const getOrCreateCart = async (userId: string) => {
  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  let cart = await prisma.cart.findUnique({
    where: { userId: userId },
    include: { items: { include: { product: true } } },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId: userId },
      include: { items: { include: { product: true } } },
    });
  }

  return cart;
};

const createCartIntoDb = async (
  userId: string,
  data: { productId: string; quantity?: number },
) => {
  const cart = await getOrCreateCart(userId);

  // check if product already in cart
  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: data.productId } },
  });

  // fetch product to validate stock
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: { stock: true },
  });
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  if (existingItem) {
    // If already exists, update quantity instead of erroring
    const newQty = (existingItem as any).quantity + (data.quantity ?? 1);
    if (newQty > product.stock) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Insufficient stock');
    }
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQty },
    });
    return await getOrCreateCart(userId);
  }

  const initialQty = data.quantity ?? 1;
  if (initialQty > product.stock) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Insufficient stock');
  }
  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: data.productId,
      quantity: initialQty,
    },
  });

  // return updated cart
  return await getOrCreateCart(userId);
};

const bulkCreateCartIntoDb = async (
  userId: string,
  items: Array<{ productId: string; quantity?: number }>,
) => {

  // check the products are own or not if own then throw error
  const userProducts = await prisma.product.findMany({
    where: { seller: { userId: userId } },
    select: { id: true },
  });
  const userProductIds = userProducts.map((prod) => prod.id);
  for (const item of items) {
    if (userProductIds.includes(item.productId)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Cannot add your own product to cart: ${item.productId}`,
      );
    }
  }

  const cart = await getOrCreateCart(userId);

  for (const item of items) {
    // check if product already in cart
    const existingItem = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
    });

    // fetch product to validate stock
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { stock: true },
    });
    if (!product) {
      throw new AppError(httpStatus.NOT_FOUND, `Product not found: ${item.productId}`);
    }

    if (existingItem) {
      // If already exists, update quantity instead of erroring
      const newQty = (existingItem as any).quantity + (item.quantity ?? 1); 
      if (newQty > product.stock) {
        throw new AppError(httpStatus.BAD_REQUEST, `Insufficient stock for product: ${item.productId}`);
      }
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      const initialQty = item.quantity ?? 1;
      if (initialQty > product.stock) {
        throw new AppError(httpStatus.BAD_REQUEST, `Insufficient stock for product: ${item.productId}`);
      }
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: item.productId,
          quantity: initialQty,
        },
      });
    }
  }

  // return updated cart
  return await getOrCreateCart(userId);
};

const getCartListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  // First ensure cart exists for the user
  const cart = await getOrCreateCart(userId);

  // Calculate pagination values
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Build search query for searchable fields in related product
  const searchQuery = options.searchTerm ? {
    OR: [
      {
        product: {
          productName: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          }
        }
      },
      {
        product: {
          description: {
            contains: options.searchTerm,
            mode: 'insensitive' as const,
          }
        }
      }
    ]
  } : {};

  // Build filter query
  const filterFields: Record<string, any> = {
    cartId: cart.id, // Always filter by current user's cart
    ...(options.productId && { productId: options.productId }),
  };

  // Handle nested product filters
  if (options.productName) {
    filterFields.product = {
      ...filterFields.product,
      productName: {
        contains: options.productName,
        mode: 'insensitive' as const,
      }
    };
  }

  if (options.categoryName) {
    filterFields.product = {
      ...filterFields.product,
      category: {
        name: {
          contains: options.categoryName,
          mode: 'insensitive' as const,
        }
      }
    };
  }

  if (options.brandName) {
    filterFields.product = {
      ...filterFields.product,
      brand: {
        brandName: {
          contains: options.brandName,
          mode: 'insensitive' as const,
        }
      }
    };
  }

  if (options.sellerCompanyName) {
    filterFields.product = {
      ...filterFields.product,
      seller: {
        companyName: {
          contains: options.sellerCompanyName,
          mode: 'insensitive' as const,
        }
      }
    };
  }

  const filterQuery = buildFilterQuery(filterFields);

  // Quantity range filtering on the CartItem
  const quantityQuery = buildNumericRangeQuery(
    'quantity',
    options.quantityMin,
    options.quantityMax,
  );

  // Price range filtering (through product)
  const priceQuery = options.priceMin || options.priceMax ? {
    product: {
      price: {
        ...(options.priceMin && { gte: options.priceMin }),
        ...(options.priceMax && { lte: options.priceMax }),
      }
    }
  } : {};

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
    quantityQuery,
    priceQuery,
    dateQuery
  );

  // Sorting - handle nested fields for product
  let orderBy: any = {};
  if (sortBy === 'productName') {
    orderBy = {
      product: {
        productName: sortOrder,
      }
    };
  } else if (sortBy === 'price') {
    orderBy = {
      product: {
        price: sortOrder,
      }
    };
  } else if (sortBy === 'companyName') {
    orderBy = {
      product: {
        seller: {
          companyName: sortOrder,
        }
      }
    };
  } else {
    orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;
  }

  // Fetch total count for pagination
  const total = await prisma.cartItem.count({ where: whereQuery });

  // Fetch paginated data
  const cartItems = await prisma.cartItem.findMany({
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
            }
          },
          brand: {
            select: {
              id: true,
              brandName: true,
              brandImage: true,
            }
          },
          _count: {
            select: {
              review: true, // Count of reviews for each product
            }
          },
        }
      },
    },
  });

  return formatPaginationResponse(cartItems, total, page, limit);
};

const getCartByIdFromDb = async (userId: string, cartId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { product: true } } },
  });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  return cart;
};

const updateCartIntoDb = async (
  userId: string,
  productId: string,
  data: Partial<{ quantity: number }>,
) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  const item = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });

  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart item not found');
  }

  const qty = data.quantity ?? (item as any).quantity;
  if (qty < 1) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Quantity must be at least 1');
  }

  // validate stock against product
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true },
  });
  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }
  if (qty > product.stock) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Insufficient stock');
  }

  const updated = await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: qty } as any,
  });

  return updated;
};

const deleteAllCartsFromDb  = async (userId: string) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  // Delete all cart items associated with the cart
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  return { message: 'All cart items deleted successfully' };
}

const deleteCartItemFromDb = async (userId: string, productId: string) => {
  // Check if cart item exists
  const cart = await prisma.cart.findUnique({
    where: { userId: userId },
  });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart item not found');
  }

  // Delete the cart item
  const deletedItem = await prisma.cartItem.delete({
    where: { cartId_productId: { cartId: cart.id, productId: productId } },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cart item not deleted');
  }

  return deletedItem;
};

// Get the current cart for user
const getCart = async (userId: string) => {
  return await getOrCreateCart(userId);
};

export const cartService = {
  createCartIntoDb,
  bulkCreateCartIntoDb,
  getCartListFromDb,
  getCartByIdFromDb,
  updateCartIntoDb,
  deleteAllCartsFromDb,
  deleteCartItemFromDb,
  getCart,
};
