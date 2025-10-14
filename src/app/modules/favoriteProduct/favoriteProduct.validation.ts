import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'ProductId is required'),
  }),
});

const updateSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'ProductId is required').optional(),
  }),
});

export const favoriteProductValidation = {
  createSchema,
  updateSchema,
};
