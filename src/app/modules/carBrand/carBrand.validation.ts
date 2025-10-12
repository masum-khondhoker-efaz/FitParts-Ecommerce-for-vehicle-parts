import { z } from 'zod';

// Engine schema
const CarEngineSchema = z.object({
  engineCode: z.string().optional(),
  kw: z.number().int().optional(),
  hp: z.number().int().optional(),
  ccm: z.number().int().optional(),
  fuelType: z.string().optional(),
});

// Generation schema
const CarGenerationSchema = z.object({
  generationName: z.string().min(1, 'Generation name is required'),
  body: z.string().optional(),
  productionStart: z.string().datetime().optional(),
  productionEnd: z.string().datetime().optional(),
  engines: z.array(CarEngineSchema).optional(),
});

// Model schema
const CarModelSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  generations: z.array(CarGenerationSchema).optional(),
});

// Brand schema
const CarBrandCreateSchema = z.object({
  body: z.object({
    // userId: z.string().min(1, 'User ID is required'),
    brandName: z.string().min(1, 'Brand name is required'),
    iconName: z.string(),
    models: z.array(CarModelSchema).optional(),
  }),
});

const updateSchema = z.object({
  body: z.object({
    brandName: z.string().min(1, 'Brand name is required').optional(),
    iconName: z.string().optional(),
    models: z.array(CarModelSchema).optional(),
  }),
});

export const carBrandValidation = {
  CarBrandCreateSchema,
  updateSchema,
};
