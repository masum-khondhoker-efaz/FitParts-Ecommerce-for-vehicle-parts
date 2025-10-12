import prisma from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const getOrCreateCart = async (userId: string) => {
  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  let cart = await prisma.cart.findFirst({
    where: { userId },
    include: { items: { include: { product: true } } },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: { items: { include: { product: true } } },
    });
  }

  return cart;
};

const createCartIntoDb = async (data: { productId: string }, userId: string) => {
  const cart = await getOrCreateCart(userId);

  // check if product already in cart
  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: data.productId } },
  });

  if (existingItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Product already in cart');
  }

  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: data.productId,
    },
  });

  // return updated cart
  return await getOrCreateCart(userId);
};

const getCartListFromDb = async (cartId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { product: true } } },
  });

  if (!cart) {
    throw new AppError(httpStatus.NOT_FOUND, 'Cart not found');
  }

  return cart.items;
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

const updateCartIntoDb = async (userId: string, cartId: string, data: Partial<{ userId: string }>) => {
  const cart = await prisma.cart.update({
    where: { id: cartId },
    data,
  });

  if (!cart) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Cart not updated');
  }

  return cart;
};

const deleteCartItemFromDb = async (cartId: string, productId: string) => {
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found in cart');
  }

  await prisma.cartItem.delete({
    where: { cartId_productId: { cartId, productId } },
  });

  return { message: 'Product removed from cart' };
};

// Get the current cart for user
const getCart = async (userId: string) => {
  return await getOrCreateCart(userId);
};

export const cartService = {
  createCartIntoDb,
  getCartListFromDb,
  getCartByIdFromDb,
  updateCartIntoDb,
  deleteCartItemFromDb,
  getCart,
};
