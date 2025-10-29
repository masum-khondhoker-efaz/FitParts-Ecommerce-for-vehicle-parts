import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    }),
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    }),
});

const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'PROCESSING', 'DELIVERED', 'CANCELLED'], {
      required_error: 'Status is required',
    }),
  }),
});

export const orderValidation = {
createSchema,
updateSchema,
updateOrderStatusSchema,
};