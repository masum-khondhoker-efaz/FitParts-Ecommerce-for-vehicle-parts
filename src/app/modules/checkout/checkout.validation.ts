import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    all: z.boolean().optional(), // checkout all items if true
    productIds: z.array(z.string()).optional(), // specific courseIds for partial checkout
  }),
});

const markCheckoutSchema = z.object({
  params: z.object({
    checkoutId: z.string(),
    paymentId: z.string(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
    all: z.boolean().optional(), // checkout all items if true
    productIds: z.array(z.string()).optional(), // specific courseIds for partial checkout
  }),
});

export const checkoutValidation = {
  createSchema,
  updateSchema,
  markCheckoutSchema,
};
