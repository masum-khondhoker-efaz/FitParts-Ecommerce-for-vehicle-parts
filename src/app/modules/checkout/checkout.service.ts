import prisma from '../../utils/prisma';
import { CheckoutStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

// Create checkout for a user
const createCheckoutIntoDb = async (
  userId: string,
  data: { all?: boolean; productIds?: string[] }
) => {
  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Get user's cart and items
    const cart = await tx.cart.findFirst({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
    }

    // 2. Decide which items to checkout
    let selectedItems;
    if (data.all) {
      selectedItems = cart.items;
    } else if (data.productIds && data.productIds.length > 0) {
      selectedItems = cart.items.filter((item) =>
        data.productIds?.includes(item.productId)
      );
    } else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Provide either all=true or specific productIds'
      );
    }

    if (selectedItems.length === 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'No valid cart items selected');
    }

    // 3. Calculate total amount
    const totalAmount = selectedItems.reduce(
      (sum, item) => sum + (item.product.price || 0),
      0
    );

    // 4. Create checkout record
    const checkout = await tx.checkout.create({
      data: {
        userId,
        totalAmount,
        status: CheckoutStatus.PENDING,
      },
    });

    // 5. Create checkout items
    await tx.checkoutItem.createMany({
      data: selectedItems.map((item) => ({
        checkoutId: checkout.id,
        productId: item.productId,
      })),
    });

    // 6. Remove purchased items from cart
    await tx.cartItem.deleteMany({
      where: {
        id: { in: selectedItems.map((item) => item.id) },
      },
    });

    // 7. Return the checkout with items and product details
    return await tx.checkout.findUnique({
      where: { id: checkout.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                price: true,
                discount: true,
              },
            },
          },
        },
      },
    });
  });
};


// Mark checkout as PAID
const markCheckoutPaid = async (userId: string, checkoutId: string, paymentId?: string) => {
  const checkout = await prisma.checkout.findUnique({
    where: { id: checkoutId },
    include: { items: true },
  });

  if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  if (checkout.status === CheckoutStatus.PAID) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout already paid');
  }

  const updatedCheckout = await prisma.checkout.update({
    where: { id: checkoutId },
    data: {
      status: CheckoutStatus.PAID,
    },
  });

  return updatedCheckout;
};

// Get all checkouts for a user
const getCheckoutListFromDb = async (userId: string) => {
  const checkouts = await prisma.checkout.findMany({
    where: { userId },
    include: { items: { include: { product: true } }, payment: true },
  });

  if (!checkouts || checkouts.length === 0) {
    return { message: 'No checkouts found' };
  }

  return checkouts;
};

// Get checkout by ID
const getCheckoutByIdFromDb = async (userId: string, checkoutId: string) => {
  const checkout = await prisma.checkout.findUnique({
    where: { id: checkoutId },
    include: { items: { include: { product: true } }, payment: true },
  });

  if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');

  return checkout;
};

// Update checkout
const updateCheckoutIntoDb = async (
  userId: string, 
  checkoutId: string,
  data: Partial<{ status: CheckoutStatus; totalAmount: number }>
) => {
  const updatedCheckout = await prisma.checkout.update({
    where: { id: checkoutId },
    data,
  });

  if (!updatedCheckout) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout not updated');
  }

  return updatedCheckout;
};

// Delete checkout
const deleteCheckoutFromDb = async (userId: string, checkoutId: string) => {
  const deletedCheckout = await prisma.checkout.delete({
    where: { id: checkoutId },
  });

  if (!deletedCheckout) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout not deleted');
  }

  return { success: true, checkoutId };
};

export const checkoutService = {
  createCheckoutIntoDb,
  markCheckoutPaid,
  getCheckoutListFromDb,
  getCheckoutByIdFromDb,
  updateCheckoutIntoDb,
  deleteCheckoutFromDb,
};
