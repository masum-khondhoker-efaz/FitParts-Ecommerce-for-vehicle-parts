import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    productId: z.string(),
    cartId: z.string().optional(),
    quantity: z.number().int().min(1).optional(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    quantity: z.number().int().min(1),
  }),
});

const bulkCreateSchema = z.object({
  body: z.array(
    z.object({
      productId: z.string(),
      cartId: z.string().optional(),
      quantity: z.number().int().min(1).optional(),
    }),
  ),
});

export const cartValidation = {
createSchema,
updateSchema,
bulkCreateSchema,
};