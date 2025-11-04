import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { carBrandService } from './carBrand.service';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import AppError from '../../errors/AppError';
import prisma from '../../utils/prisma';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { uploadFileToS3 } from '../../utils/multipleFile';


const createCarBrand = catchAsync(async (req, res) => {
  const user = req.user as any;
  const {file, body} = req;
  
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Brand Image is required.');
  }

  // Upload to DigitalOcean
  const fileUrl = await uploadFileToS3(file, 'brand-images');
  const brandData = {
    ...body,
    brandImage: fileUrl,
  };
  const result = await carBrandService.createCarBrandIntoDb(user.id, brandData);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'CarBrand created successfully',
    data: result,
  });
});



/** Helper to parse safe dates */
const safeDate = (value?: string): Date | null => {
  if (!value || value.trim() === '' || value.toLowerCase() === 'n/a') return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

interface EngineInput {
  engineCode?: string;
  kw?: number | null;
  hp?: number | null;
  ccm?: number | null;
  fuelType?: string | null;
}

interface GenerationInput {
  generationName: string;
  body?: string | null;
  productionStart?: Date | null;
  productionEnd?: Date | null;
  engines: EngineInput[];
}

interface ModelInput {
  modelName: string;
  generations: GenerationInput[];
}

interface BrandInput {
  brandName: string;
  iconName?: string;
  models: ModelInput[];
}

/**
 * Bulk Create Car Brands from CSV
 */
const bulkCreateCarBrand = catchAsync(async (req, res) => {
  const user = req.user as any;
  const file = req.file;

  if (!file) throw new AppError(httpStatus.BAD_REQUEST, 'CSV file is required');
  const filePath = file.path;
  if (!fs.existsSync(filePath)) throw new AppError(httpStatus.BAD_REQUEST, 'Uploaded file not found');

  // Map to accumulate data
  const brandMap: Record<string, any> = {};

  console.log('Processing CSV file:', filePath);

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: any) => {
        try {
          const brandName = row['brandName']?.trim();
          const iconName = row['iconName']?.trim();
          const modelName = row['modelName']?.trim();
          const generationName = row['generationName']?.trim();
          const body = row['body']?.trim();
          const productionStart = safeDate(row['productionStart']);
          const productionEnd = safeDate(row['productionEnd']);
          const engineCode = row['engineCode']?.trim();
          const kw = Number(row['kw']) || null;
          const hp = Number(row['hp']) || null;
          const ccm = Number(row['ccm']) || null;
          const fuelType = row['fuelType']?.trim() || null;

          if (!brandName || !modelName) return;

          if (!brandMap[brandName]) {
            brandMap[brandName] = {
              brandName,
              iconName,
              models: {},
            };
          }

          const brand = brandMap[brandName];

          if (!brand.models[modelName]) {
            brand.models[modelName] = {
              modelName,
              generations: {},
            };
          }

          const model = brand.models[modelName];

          if (generationName) {
            if (!model.generations[generationName]) {
              model.generations[generationName] = {
                generationName,
                body,
                productionStart,
                productionEnd,
                engines: [],
              };
            }

            if (engineCode) {
              model.generations[generationName].engines.push({
                engineCode,
                kw,
                hp,
                ccm,
                fuelType,
              });
            }
          }
        } catch (err) {
          console.error('Error parsing row:', err);
        }
      })
      .on('end', () => resolve())
      .on('error', err => reject(err));
  });

  const results: any[] = [];

  // Convert brandMap to array of BrandInput
  const brandsArray: BrandInput[] = Object.values(brandMap).map((brand: any) => {
    brand.models = Object.values(brand.models).map((model: any) => {
      model.generations = Object.values(model.generations ?? {}).map((gen: any) => ({
        ...gen,
      }));
      return model;
    });
    return brand;
  });

  // Process each brand
  for (const brand of brandsArray) {
    // 1️⃣ Check if brand exists
    let existingBrand = await carBrandService.findBrandByName(brand.brandName);

    if (!existingBrand) {
      // Brand doesn't exist, create brand + all models
      const createdBrand = await carBrandService.bulkCreateCarBrandsIntoDb(user.id, brand);
      results.push(createdBrand);
      continue;
    }

    // Brand exists, check models
    for (const model of brand.models) {
      const existingModel = await carBrandService.findModelByName(model.modelName);

      if (existingModel) {
        console.log(`Skipping duplicate model: ${model.modelName}`);
        continue; // skip this model
      }

      // Convert generations to array for Prisma
      const generationsArray: GenerationInput[] = model.generations ?? [];

      // Create model under existing brand
      const newModel = await prisma.carModel.create({
        data: {
          brandId: existingBrand.id,
          modelName: model.modelName,
          generations: {
            create: generationsArray.map(gen => ({
              generationName: gen.generationName,
              body: gen.body,
              productionStart: gen.productionStart,
              productionEnd: gen.productionEnd,
              engines: {
                create: gen.engines.map(engine => ({
                  engineCode: engine.engineCode,
                  kw: engine.kw,
                  hp: engine.hp,
                  ccm: engine.ccm,
                  fuelType: engine.fuelType,
                })),
              },
            })),
          },
        },
      });

      results.push(newModel);
    }
  }

  fs.unlinkSync(filePath);

  if (!results.length) {
    throw new AppError(httpStatus.BAD_REQUEST, 'No new brands/models created. All duplicates.');
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Car brands and models created successfully from CSV',
    data: results,
  });
});

const getAllCarBrands = catchAsync(async (req, res) => {
  const result = await carBrandService.getAllCarBrandsFromDb(req.params.year);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All Car Brands retrieved successfully',
    data: result,
  });
});

const getAllCarModels = catchAsync(async (req, res) => {
  const result = await carBrandService.getAllCarModelsFromDb(req.params.brandId, req.params.year);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All Car Models retrieved successfully',
    data: result,
  });
});

const getAllCarEngines = catchAsync(async (req, res) => {
  const result = await carBrandService.getAllCarEnginesFromDb(req.params.modelId, req.params.year);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'All Car Engines retrieved successfully',
    data: result,
  });
});

const getCarBrandList = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await carBrandService.getCarBrandListFromDb( req.query as ISearchAndFilterOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CarBrand list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getCarBrandById = catchAsync(async (req, res) => {
  // const user = req.user as any;
  const result = await carBrandService.getCarBrandByIdFromDb( req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CarBrand details retrieved successfully',
    data: result,
  });
});

const updateCarBrand = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { file, body } = req;

  let brandData = { ...body };

  if (file) {
    // Upload to DigitalOcean
    const fileUrl = await uploadFileToS3(file, 'brand-images');
    brandData.brandImage = fileUrl;
  }
  const result = await carBrandService.updateCarBrandIntoDb(user.id, req.params.id, brandData);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CarBrand updated successfully',
    data: result,
  });
});

const deleteCarBrand = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await carBrandService.deleteCarBrandItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'CarBrand deleted successfully',
    data: result,
  });
});

export const carBrandController = {
  createCarBrand,
  bulkCreateCarBrand,
  getAllCarBrands,
  getAllCarModels,
  getAllCarEngines,
  getCarBrandList,
  getCarBrandById,
  updateCarBrand,
  deleteCarBrand,
};