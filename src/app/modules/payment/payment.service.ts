import httpStatus from 'http-status';
import Stripe from 'stripe';
import config from '../../../config';
import { isValidAmount } from '../../utils/isValidAmount';
import { TStripeSaveWithCustomerInfo } from './payment.interface';
import prisma from '../../utils/prisma';
import { CheckoutStatus, PaymentStatus, UserRoleEnum } from '@prisma/client';
import AppError from '../../errors/AppError';
import { notificationServices } from '../notification/notification.services';

// Initialize Stripe with your secret API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Step 1: Create a Customer and Save the Card
const saveCardWithCustomerInfoIntoStripe = async (
  payload: TStripeSaveWithCustomerInfo,
  userId: string,
) => {
  try {
    const { user, paymentMethodId, address } = payload;

    // Create a new Stripe customer
    const customer = await stripe.customers.create({
      name: user.name,
      email: user.email,
      address: {
        city: address.city,
        postal_code: address.postal_code,
        country: address.country,
      },
    });

    // Attach PaymentMethod to the Customer
    const attach = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    // Set PaymentMethod as Default
    const updateCustomer = await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // update profile with customerId
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        stripeCustomerId: customer.id,
      },
    });

    return {
      customerId: customer.id,
      paymentMethodId: paymentMethodId,
    };
  } catch (error: any) {
    throw Error(error.message);
  }
};

// Step 2: Authorize the Payment Using Saved Card

const authorizePaymentWithStripeCheckout = async (
  userId: string,
  payload: {
    checkoutId: string;
    shippingId: string;
  },
) => {
  const { checkoutId } = payload;

  // Retrieve customer info
  const customerDetails = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      stripeCustomerId: true,
    },
  });

  if (!customerDetails) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Customer not found');
  }
  //checkout exists and belongs to user
  const findCheckout = await prisma.checkout.findFirst({
    where: {
      id: checkoutId,
      userId: userId,
      status: CheckoutStatus.PENDING,
    },
    include: {
      items: {
        select: {
          id: true,
          quantity: true,
          product: {
            select: { productName: true, id: true, price: true, discount: true, shippings: true},
          },
        },
      },
    },
  });

  if (!findCheckout) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Checkout not found or already paid',
    );
  }


  // get the shipping cost from the shippingId and add to total amount
  const shippingInfo = findCheckout.items[0].product.shippings.find(
    ship => ship.id === payload.shippingId,
  );

  if (!shippingInfo) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Invalid shipping option for the product',
    );
  }



  const totalQuantity = findCheckout.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  
  if (totalQuantity <= 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No items in the checkout to process payment',
    );
  }

  // total amount with shipping cost
  // let shippingCost = 0;
  // findCheckout.items.forEach(item => {
  //   const shippingInfo = item.product.shippings.find(
  //     ship => ship.countryCode === 'US', // assuming 'US' for this example
  //   );
  //   if (shippingInfo) {
  //     shippingCost += shippingInfo.cost;
  //   }
  // });
  // findCheckout.totalAmount += shippingCost;

  // Ensure Stripe Customer exists
  let customerId = customerDetails.stripeCustomerId;
  if (!customerId) {
    const stripeCustomer = await stripe.customers.create({
      email: customerDetails.email ?? undefined,
    });

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: stripeCustomer.id },
    });

    customerId = stripeCustomer.id;
  }

  // Calculate total amount (all items × their quantities) with discount applied
  const totalProductAmount = findCheckout.items.reduce(
    (sum, item) => {
      const originalPrice = item.product.price;
      const discountPercent = item.product.discount || 0;
      const discountedPrice = originalPrice - (originalPrice * discountPercent / 100);
      return sum + discountedPrice * item.quantity;
    },
    0,
  );

  // Create Stripe Checkout Session (supports Card)
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "dzd",
          product_data: {
            name: `Products: ${findCheckout.items.map(item => item.product.productName).join(", ")}`,
            description: `Purchased products: ${findCheckout.items
              .map(item => `${item.product.productName} (x${item.quantity})`)
              .join(", ")}`,
          },
          unit_amount: Math.round(totalProductAmount * 100), // Total price in cents
        },
        quantity: 1, // Since unit_amount already includes all items, quantity is 1
      },
    ],
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: {
            amount: Math.round(shippingInfo.cost * 100),
            currency: 'dzd',
          },
          display_name: shippingInfo.carrier,
          delivery_estimate: {
            minimum: { unit: 'business_day', value: shippingInfo.deliveryMin },
            maximum: { unit: 'business_day', value: shippingInfo.deliveryMax },
          },
        },
      },
    ],
    payment_method_types: ['card'], // Add available methods
    // Note: Older versions may not support 'apple_pay' and 'google_pay' directly
    customer: customerId,
    success_url: `${config.frontend_base_url}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.frontend_base_url}/payment-cancel`,
    metadata: {
      userId,
      checkoutId,
      productName: findCheckout.items.map(item => item.product.productName).join(", "),
    },
  });


  // existing payment intent
  // const existingPayment = await prisma.payment.findFirst({
  //   where: {
  //     userId,
  //     checkoutId,
  //     status: PaymentStatus.PENDING,
  //   },
  // });

  // if (existingPayment) {
  //   // update payment intent id
  //   await prisma.payment.update({
  //     where: {
  //       id: existingPayment.id,
  //     },
  //     data: {
  //       amountProvider: session.customer as string,
  //     },
  //   });
  //   return { redirectUrl: session.url };
  // }

  // //create payment record in db with pending status
  // const payment = await prisma.payment.create({
  //   data: {
  //     userId,
  //     checkoutId,
  //     paymentAmount: findCheckout.totalAmount,
  //     status: PaymentStatus.PENDING,
  //     amountProvider: session.customer as string,
  //   },
  // });
  // if(!payment) {
  //   throw new AppError(httpStatus.BAD_REQUEST, 'Payment creation failed');
  // }

  // Return URL to redirect user to Stripe-hosted payment page
  return { redirectUrl: session.url };
};

// Step 3: Capture the Payment
const capturePaymentRequestToStripe = async (payload: {
  paymentIntentId: string;
}) => {
  try {
    const { paymentIntentId } = payload;

    // Capture the authorized payment using the PaymentIntent ID
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    return paymentIntent;
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

// New Route: Save a New Card for Existing Customer
const saveNewCardWithExistingCustomerIntoStripe = async (payload: {
  customerId: string;
  paymentMethodId: string;
}) => {
  try {
    const { customerId, paymentMethodId } = payload;

    // Attach the new PaymentMethod to the existing Customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Optionally, set the new PaymentMethod as the default
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return {
      customerId: customerId,
      paymentMethodId: paymentMethodId,
    };
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

const getCustomerSavedCardsFromStripe = async (customerId: string) => {
  try {
    // List all payment methods for the customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return { paymentMethods: paymentMethods.data };
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

// Delete a card from a customer in the stripe
const deleteCardFromCustomer = async (paymentMethodId: string) => {
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    return { message: 'Card deleted successfully' };
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

// Refund amount to customer in the stripe
const refundPaymentToCustomer = async (payload: {
  paymentIntentId: string;
}) => {
  try {
    // Refund the payment intent
    const refund = await stripe.refunds.create({
      payment_intent: payload?.paymentIntentId,
    });

    return refund;
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

// Service function for creating a PaymentIntent
const createPaymentIntentService = async (payload: { amount: number }) => {
  if (!payload.amount) {
    throw new AppError(httpStatus.CONFLICT, 'Amount is required');
  }

  if (!isValidAmount(payload.amount)) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Amount '${payload.amount}' is not a valid amount`,
    );
  }

  // Create a PaymentIntent with Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: payload?.amount,
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true, // Enable automatic payment methods like cards, Apple Pay, Google Pay
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    dpmCheckerLink: `https://dashboard.stripe.com/settings/payment_methods/review?transaction_id=${paymentIntent.id}`,
  };
};

const getCustomerDetailsFromStripe = async (customerId: string) => {
  try {
    // Retrieve the customer details from Stripe
    const customer = await stripe.customers.retrieve(customerId);

    return customer;
  } catch (error: any) {
    throw new AppError(httpStatus.NOT_FOUND, error.message);
  }
};

const getAllCustomersFromStripe = async () => {
  try {
    // Retrieve all customers from Stripe
    const customers = await stripe.customers.list({
      limit: 2,
    });

    return customers;
  } catch (error: any) {
    throw new AppError(httpStatus.CONFLICT, error.message);
  }
};

export const StripeServices = {
  saveCardWithCustomerInfoIntoStripe,
  authorizePaymentWithStripeCheckout,
  capturePaymentRequestToStripe,
  saveNewCardWithExistingCustomerIntoStripe,
  getCustomerSavedCardsFromStripe,
  deleteCardFromCustomer,
  refundPaymentToCustomer,
  createPaymentIntentService,
  getCustomerDetailsFromStripe,
  getAllCustomersFromStripe,
};
