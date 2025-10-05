import { z } from 'zod';

// Product Field
const productFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  valueString: z.string().optional(),
  valueInt: z.number().int().optional(),
  valueFloat: z.number().optional(),
  valueDate: z.string().datetime().optional(), // ISO Date string
});

// Recursive Section Schema
const productSectionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    name: z.string().min(1, 'Section name is required'),
    parentId: z.string().optional(),
    fields: z.array(productFieldSchema).optional(),
    subSections: z.array(productSectionSchema).optional(),
  }),
);

// Product Reference
const productReferenceSchema = z.object({
  type: z.enum(['OE', 'SUPPLIER', 'INTERNAL']), // your enum ReferenceType
  number: z.string().min(1, 'Reference number is required'),
});

// Product Shipping
const productShippingSchema = z.object({
  countryName: z.string().min(1, 'Country name is required'),
  countryCode: z.string().length(2, 'Country code must be ISO Alpha-2'),
  carrier: z.string(),
  cost: z.number().min(0),
  deliveryMin: z.number().int().min(1),
  deliveryMax: z.number().int().min(1),
  isDefault: z.boolean().optional(),
});

// Main Product Schema
const productSchema = z.object({
  body: z.object({
    // sellerId: z.string().min(1, "SellerId is required"),
    productName: z.string().min(1, 'Product name is required'),
    description: z.string().optional(),
    price: z.number().min(0),
    discount: z.number().min(0).max(100).optional(),
    stock: z.number().int().min(0),
    isVisible: z.boolean().optional(),

    sections: z.array(productSectionSchema).optional(),
    references: z.array(productReferenceSchema).optional(),
    shipping: z.array(productShippingSchema).optional(),
  }),
});

const updateProductSchema = z.object({
  body: z.object({
    productName: z.string().min(1, 'Product name is required').optional(),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    discount: z.number().min(0).max(100).optional(),
    stock: z.number().int().min(0).optional(),
    isVisible: z.boolean().optional(),

    sections: z.array(productSectionSchema).optional(),
    references: z.array(productReferenceSchema).optional(),
    shipping: z.array(productShippingSchema).optional(),
  }),
});

export const productValidation = {
  productSchema,
  updateProductSchema,
};
