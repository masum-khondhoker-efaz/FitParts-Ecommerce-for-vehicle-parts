import { AddressType } from '@prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    addressLine: z.string().min(1, 'Address line is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    apartmentNo: z.string().optional(),
    name: z.string().optional(),
    phoneNumber: z.string().optional(),
    email: z.string().optional(),
    type: z.nativeEnum(AddressType),
  }),
});

const updateSchema = z.object({
  body: z.object({
    addressLine: z.string().min(1, 'Address line is required').optional(),
    city: z.string().min(1, 'City is required').optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    // type: z.nativeEnum(AddressType).optional(),
  }),
});

export const addressValidation = {
  createSchema,
  updateSchema,
};
