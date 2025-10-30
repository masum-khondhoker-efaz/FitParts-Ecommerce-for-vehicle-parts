import { z } from 'zod';

// Engine schema
const CarEngineSchema = z.object({
  engineCode: z.string().optional(),
  kw: z.string().transform((val) => Number(val) || undefined),
  hp: z.string().transform((val) => Number(val) || undefined),
  ccm: z.string().transform((val) => Number(val) || undefined),
  fuelType: z.string().min(1,"Fuel type is required"),
});

// Generation schema
const CarGenerationSchema = z.object({
  generationName: z.string().min(1, 'Generation name is required'),
  body: z.string().optional(),
  productionStart: z
    .string()
    .transform((val) => {
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    })
    .optional(),
  productionEnd: z
    .string()
    .transform((val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) return undefined;
      // set to end of day in UTC: 23:59:59.999+00:00
      d.setUTCHours(23, 59, 59, 999);
      return d;
    })
    .optional(),
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
    // brandImage: z.string(),
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
