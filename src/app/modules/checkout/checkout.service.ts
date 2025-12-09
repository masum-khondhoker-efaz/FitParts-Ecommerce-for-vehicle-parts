import prisma from '../../utils/prisma';
import { CheckoutStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

// Create checkout for a user
const createCheckoutIntoDb = async (
  userId: string,
  data: { all?: boolean; productIds?: string[] },
) => {
  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  // check the products are own or not if own then throw error
  const userProducts = await prisma.product.findMany({
    where: { seller: { userId: userId } },
    select: { id: true },
  });
  const userProductIds = new Set(userProducts.map(prod => prod.id));

  // If specific productIds provided, validate those
  if (data.productIds && data.productIds.length > 0) {
    for (const pid of data.productIds) {
      if (userProductIds.has(pid)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Cannot add your own product to cart: ${pid}`,
        );
      }
    }
  } else if (data.all) {
    // If 'all' was requested, fetch the cart and validate its items
    const cartForCheck = await prisma.cart.findFirst({
      where: { userId },
      include: { items: { select: { productId: true } } },
    });
    const cartItemProductIds = cartForCheck?.items.map(i => i.productId) ?? [];
    for (const pid of cartItemProductIds) {
      if (userProductIds.has(pid)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Cannot add your own product to cart: ${pid}`,
        );
      }
    }
  }

  return await prisma.$transaction(async tx => {
    // delete existing checkout and items if any
    await tx.checkoutItem.deleteMany({
      where: { checkout: { userId } },
    });
    await tx.checkout.deleteMany({
      where: { userId },
    });

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
      selectedItems = cart.items.filter(item =>
        data.productIds?.includes(item.productId),
      );
    } else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Provide either all=true or specific productIds',
      );
    }

    if (selectedItems.length === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No valid cart items selected',
      );
    }

    // 3. Validate stock for each item and calculate total amount with discount
    let totalAmount = 0;
    for (const item of selectedItems as any[]) {
      const qty = item.quantity ?? 1;
      if (qty < 1) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid quantity in cart');
      }
      if (qty > item.product.stock) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Insufficient stock for product ${item.productId}`,
        );
      }
      // Calculate discounted price
      const originalPrice = item.product.price || 0;
      const discountPercent = item.product.discount || 0;
      const discountedPrice =
        originalPrice - (originalPrice * discountPercent) / 100;
      totalAmount += discountedPrice * qty;
    }

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
      data: selectedItems.map((item: any) => ({
        checkoutId: checkout.id,
        productId: item.productId,
        quantity: item.quantity,
      })),
    });

    // 6. Remove purchased items from cart
    await tx.cartItem.deleteMany({
      where: {
        id: { in: selectedItems.map(item => item.id) },
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
const markCheckoutPaid = async (
  userId: string,
  checkoutId: string,
  paymentId?: string,
  paymentAmount?: number,
) => {
  // 1) Fetch checkout and its items (lookup by id only; validate ownership/status after)
  const checkout = await prisma.checkout.findUnique({
    where: { id: checkoutId },
    include: {
      items: { include: { product: true } },
      user: true,
    },
  });

  if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  // validate ownership
  if (checkout.userId !== userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  }
  // validate status
  if (checkout.status === CheckoutStatus.PAID) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout already paid');
  }
  if (checkout.status !== CheckoutStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Checkout is not in a payable state',
    );
  }

  // Sanity check: must have items
  if (!checkout.items || checkout.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout has no items');
  }

  // 2) Individual student checkout
  const findStudent = await prisma.user.findUnique({
    where: { id: checkout.userId },
  });
  if (!findStudent) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Student not found for checkout',
    );
  }
  const findProductsCreator = await prisma.product.findFirst({
    where: { id: checkout.items[0].productId },
  });
  if (!findProductsCreator) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Course not found for checkout');
  }
  const productCreator = await prisma.user.findUnique({
    where: { id: findProductsCreator.sellerId },
  });
  if (!productCreator) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Course creator not found for checkout',
    );
  }

  const shippingAddress = await prisma.address.findFirst({
    where: {
      userId: userId,
      type: 'SHIPPING',
    },
  });

  if (!shippingAddress) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Shipping address not found for checkout',
    );
  }
  let billingAddress = await prisma.address.findFirst({
    where: {
      userId: userId,
      type: 'BILLING',
    },
  });

  if (!billingAddress) {
    billingAddress = shippingAddress;
  }

  const invoiceData = {
    Seller: productCreator.fullName,
    Email: productCreator.email,
    // NIP: courseCreator.vatId,
    'Contact Number': productCreator.phoneNumber,
    Address: productCreator.address,
    Buyer: findStudent.fullName,
    'Buyer Email': findStudent.email,
    // 'Buyer NIP': findStudent.vatId,
    'Buyer Contact Number': findStudent.phoneNumber,
    'Buyer Address': findStudent.address,
    'Invoice Number': paymentId || 'Cash Payment',
    'Invoice Date': new Date().toLocaleDateString(),
    'Product(s) Purchased': checkout.items
      .map(item => item.product.productName)
      .join(', '),
    'Product ID(s)': checkout.items.map(item => item.productId).join(', '),
    'Product Price(s)': checkout.items
      .map(item => {
        const price = item.product?.price ?? 0;
        const discount = item.product?.price ?? null;
        const effectivePrice =
          typeof discount === 'number' && discount > 0 && discount < 100
            ? Number((price * (1 - discount / 100)).toFixed(2))
            : price;
        return effectivePrice.toFixed(2);
      })
      .join(', '),
    // 'Product vat rate(s) included ': checkout.items.map(_ => '23%').join(', '),
    'Total Amount': checkout.totalAmount?.toFixed(2),
    'Payment Method': paymentId ? 'Online Payment' : 'Cash on Delivery',
    'Shipping Address': `${shippingAddress.addressLine}, ${shippingAddress.city}, ${
      shippingAddress.state || ''
    } ${shippingAddress.postalCode || ''}, ${shippingAddress.country || ''}`,
    'Billing Address': `${billingAddress.addressLine}, ${billingAddress.city}, ${
      billingAddress.state || ''
    } ${billingAddress.postalCode || ''}, ${billingAddress.country || ''}`,
  };

  return await prisma.$transaction(async tx => {
    // enroll for each course if not already
    for (const item of checkout.items) {
      // compute effective price considering possible discount
      const price = item.product?.price ?? 0;
      const discount = item.product?.discount ?? null;
      const effectivePrice =
        typeof discount === 'number' && discount > 0 && discount < 100
          ? Number((price * (1 - discount / 100)).toFixed(2))
          : price;

      // const exists = await tx.order.findFirst({
      //   where: { userId: checkout.userId,
      //     // paymentId: paymentId
      //   },
      // });

      // if (exists) {
      //   // Use existing order
      //   await tx.orderItem.createMany({
      //     data: {
      //       orderId: exists.id,
      //       productId: item.productId,
      //       quantity: item.quantity,
      //       price: effectivePrice,
      //     },
      //   });
      // } else {
      // Create a new order and attach the item to it
      const order = await tx.order.create({
        data: {
          userId: checkout.userId,
          sellerId: item.product.sellerId,
          paymentId: paymentId || null,
          paymentStatus: paymentId
            ? PaymentStatus.COMPLETED
            : PaymentStatus.CASH,
          invoice: invoiceData,
          totalAmount: paymentAmount ? paymentAmount : checkout.totalAmount,
          shippingId: shippingAddress.id,
          billingId: billingAddress.id,
          status: OrderStatus.PENDING,
          shippingSnapshot: shippingAddress,
          billingSnapshot: billingAddress,
        },
      });

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: effectivePrice,
        },
      });
      // }

      await tx.product.updateMany({
        where: { id: item.productId },
        data: {
          totalSold: { increment: item.quantity },
          stock: { decrement: item.quantity },
        },
      });
    }
    // delete the checkout - delete by id only
    await tx.checkoutItem.deleteMany({
      where: { checkoutId: checkoutId },
    });
    await tx.checkout.delete({
      where: { id: checkoutId },
    });

    return { success: true, type: 'individual', checkoutId };
  });
};

// Get all checkouts for a user
const getCheckoutListFromDb = async (userId: string) => {
  const checkouts = await prisma.checkout.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              brandId: true,
              sellerId: true,
              categoryId: true,
              productImages: true,
              productName: true,
              price: true,
              discount: true,
              shippings: {
                select: {
                  id: true,
                  cost: true,
                  countryCode: true,
                  countryName: true,
                  carrier: true,
                  deliveryMin: true,
                  deliveryMax: true,
                },
              },
            },
          },
        },
      },
    },
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
    include: { items: { include: { product: true } } },
  });

  if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');

  return checkout;
};

// Update checkout
const updateCheckoutIntoDb = async (
  userId: string,
  checkoutId: string,
  data: Partial<{ status: CheckoutStatus; totalAmount: number }>,
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
