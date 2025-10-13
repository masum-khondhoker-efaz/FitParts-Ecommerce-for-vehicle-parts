import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    productId: z.string(),
    cartId: z.string().optional(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    productId: z.string().optional(),
    cartId: z.string().optional(),
    }),
});

export const cartValidation = {
createSchema,
updateSchema,
};