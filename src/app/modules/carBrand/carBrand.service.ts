import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { BrandInput } from './carBrand.interface';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';
import { buildSearchQuery, buildFilterQuery, combineQueries, buildDateRangeQuery } from '../../utils/searchFilter';
import { formatPaginationResponse, getPaginationQuery } from '../../utils/pagination';

const createCarBrandIntoDb = async (userId: string, data: BrandInput) => {
  try {
    if (!data.brandName || !data.brandImage) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'brandName and brandImage are required',
      );
    }

    // Check if brandName exists
    const existingBrand = await prisma.carBrand.findUnique({
      where: { brandName: data.brandName },
      include: { models: true },
    });

    if (existingBrand) {
      // Check if any modelName exists in the existing brand
      const existingModelNames = existingBrand.models.map(m => m.modelName);
      const newModels = data.models?.filter(
        model => !existingModelNames.includes(model.modelName!),
      );

      if (!newModels || newModels.length === 0) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'All provided modelNames already exist for this brand',
        );
      }

      // Create only new models for the existing brand
      const createdModels = await prisma.carModel.createMany({
        data: newModels.map(model => ({
          modelName: model.modelName!,
          brandId: existingBrand.id,
        })),
      });

      return {
        message: 'Brand already exists. New models added.',
        brand: existingBrand,
        createdModels,
      };
    }

    // Brand does not exist, create brand with models
    const brandData = {
      userId,
      brandName: data.brandName,
      brandImage: data.brandImage,
      models: {
        create: data.models?.map(model => ({
          modelName: model.modelName ?? '',
          generations: {
            create: model.generations?.map(gen => ({
              generationName: gen.generationName ?? '',
              body: gen.body ?? '',
              productionStart: gen.productionStart
                ? new Date(gen.productionStart)
                : undefined,
              productionEnd: gen.productionEnd
                ? new Date(gen.productionEnd)
                : undefined,
              engines: {
                create: gen.engines?.map(engine => ({
                  engineCode: engine.engineCode ?? '',
                  kw: engine.kw ?? 0,
                  hp: engine.hp ?? 0,
                  ccm: engine.ccm ?? 0,
                  fuelType: engine.fuelType ?? '',
                })),
              },
            })),
          },
        })),
      },
    };

    const result = await prisma.carBrand.create({
      data: brandData,
      include: {
        models: {
          include: {
            generations: {
              include: {
                engines: true,
              },
            },
          },
        },
      },
    });

    if (!result) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Car brand not created');
    }

    return result;
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      (error as Error).message,
    );
  }
};

const bulkCreateCarBrandsIntoDb1 = async (userId: string, brands: any[]) => {
  return await prisma.$transaction(async tx => {
    const results = [];

    for (const brand of brands) {
      const createdBrand = await tx.carBrand.create({
        data: {
          userId,
          brandName: brand.brandName,
          brandImage: brand.iconName,
          models: {
            create: brand.models.map((model: any) => ({
              name: model.modelName,
              generations: {
                create: model.generations.map((gen: any) => ({
                  name: gen.generationName,
                  body: gen.body,
                  productionStart: new Date(gen.productionStart),
                  productionEnd: new Date(gen.productionEnd),
                  engines: {
                    create: gen.engines.map((eng: any) => ({
                      engineCode: eng.engineCode,
                      kw: eng.kw,
                      hp: eng.hp,
                      ccm: eng.ccm,
                      fuelType: eng.fuelType,
                    })),
                  },
                })),
              },
            })),
          },
        },
      });

      results.push(createdBrand);
    }

    return results;
  });
};

const bulkCreateCarBrandsIntoDb = async (userId: string, brandData: any) => {
  if (!brandData || !brandData.brandName) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Brand data is invalid');
  }

  // Convert models array
  const models = (brandData.models || []).map((model: any) => ({
    modelName: model.modelName,
    generations: {
      create: (model.generations || []).map((gen: any) => ({
        generationName: gen.generationName,
        body: gen.body,
        productionStart: gen.productionStart
          ? new Date(gen.productionStart)
          : null,
        productionEnd: gen.productionEnd ? new Date(gen.productionEnd) : null,
        engines: {
          create: (gen.engines || []).map((engine: any) => ({
            engineCode: engine.engineCode,
            kw: engine.kw,
            hp: engine.hp,
            ccm: engine.ccm,
            fuelType: engine.fuelType,
          })),
        },
      })),
    },
  }));

  const createdBrand = await prisma.carBrand.create({
    data: {
      userId,
      brandName: brandData.brandName,
      brandImage: brandData.iconName,
      models: {
        create: models,
      },
    },
  });

  return createdBrand;
};

const getCarBrandListFromDb = async (userId: string, options: ISearchAndFilterOptions) => {
  // Normalize pagination
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  console.log(options)

  // Normalize incoming string fields (they may be provided as strings)
  const searchTerm = options.searchTerm?.toString().trim();
  const brandNameInput = options.brandName?.toString().trim();
  const modelNameInput = options.modelName?.toString().trim();
  const yearInput = options.year?.toString().trim();
  const hpInput = options.hp?.toString().trim();

  // Parse numeric values if valid
  const yearNum = yearInput ? parseInt(yearInput, 10) : undefined;
  const hpNum = hpInput ? Number(hpInput) : undefined;

  // Build search condition (brandName + modelName in nested relation)
  const searchCondition = searchTerm
    ? {
        OR: [
          { brandName: { contains: searchTerm, mode: 'insensitive' as const } },
          {
            models: {
              some: {
                modelName: { contains: searchTerm, mode: 'insensitive' as const },
              },
            },
          },
        ],
      }
    : undefined;

  // Top-level brand filter
  const brandFilter = brandNameInput
    ? { brandName: { contains: brandNameInput, mode: 'insensitive' as const } }
    : undefined;

  // Model name filter (ensures at least one model matches)
  const modelFilter = modelNameInput
    ? {
        models: {
          some: {
            modelName: { contains: modelNameInput, mode: 'insensitive' as const },
          },
        },
      }
    : undefined;

  // Year and hp filtering must examine nested generations and engines.
  // For year: check that the provided year intersects the generation production range.
  // For hp: check engines.some.hp equals provided hp.
  let generationEngineFilter: any = undefined;
  if ((yearInput && !isNaN(Number(yearInput))) || (hpInput && !isNaN(Number(hpInput)))) {
    const andConditions: any[] = [];

    if (yearInput && !isNaN(yearNum as number)) {
      const y = yearNum as number;
      const startOfYear = new Date(y, 0, 1, 0, 0, 0, 0);
      const endOfYear = new Date(y, 11, 31, 23, 59, 59, 999);

      // generation.productionStart <= endOfYear AND (generation.productionEnd IS NULL OR generation.productionEnd >= startOfYear)
      andConditions.push({ productionStart: { lte: endOfYear } });
      andConditions.push({
        OR: [{ productionEnd: null }, { productionEnd: { gte: startOfYear } }],
      });
    }

    if (hpInput && !isNaN(hpNum as number)) {
      // an engine with matching hp must exist in the generation
      andConditions.push({ engines: { some: { hp: Number(hpNum) } } });
    }

    // Wrap generation conditions under models.some.generations.some
    generationEngineFilter = {
      models: {
        some: {
          generations: {
            some: {
              AND: andConditions,
            },
          },
        },
      },
    };
  }

  // Date range filtering on carBrand.createdAt if provided
  let createdAtFilter: any = undefined;
  if (options.startDate || options.endDate) {
    const createdAtCond: any = {};
    if (options.startDate) createdAtCond.gte = new Date(options.startDate);
    if (options.endDate) createdAtCond.lte = new Date(options.endDate);
    createdAtFilter = { createdAt: createdAtCond };
  }

  // Combine all conditions using AND
  const andClauses: any[] = [];
  if (searchCondition) andClauses.push(searchCondition);
  if (brandFilter) andClauses.push(brandFilter);
  if (modelFilter) andClauses.push(modelFilter);
  if (generationEngineFilter) andClauses.push(generationEngineFilter);
  if (createdAtFilter) andClauses.push(createdAtFilter);

  const whereQuery = andClauses.length > 0 ? { AND: andClauses } : {};

  // Sorting
  const orderBy = getPaginationQuery(sortBy, sortOrder).orderBy;

  // Total count
  const total = await prisma.carBrand.count({ where: whereQuery });

  // Fetch paginated data (include models and minimal generation/engine info if helpful)
  const carBrands = await prisma.carBrand.findMany({
    where: whereQuery,
    skip,
    take: limit,
    orderBy,
    include: {
      models: {
        select: {
          id: true,
          modelName: true,
          createdAt: true,
          generations: {
            select: {
              id: true,
              generationName: true,
              productionStart: true,
              productionEnd: true,
              engines: {
                select: {
                  id: true,
                  engineCode: true,
                  hp: true,
                  kw: true,
                  ccm: true,
                },
                take: 10, // limit nested engines returned per generation to avoid huge payloads
              },
            },
            take: 10, // limit nested generations returned per model
          },
        },
      },
    },
  });

  return formatPaginationResponse(carBrands, total, page, limit);
};

const getCarBrandByIdFromDb = async (userId: string, carBrandId: string) => {
  const result = await prisma.carBrand.findUnique({
    where: {
      id: carBrandId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'carBrand not found');
  }
  return result;
};

const updateCarBrandIntoDb = async (
  userId: string,
  carBrandId: string,
  data: BrandInput,
) => {
  try {
    const brandData: any = {};
    if (data.brandName) brandData.brandName = data.brandName;

    if (data.models) {
      brandData.models = {
        upsert: data.models.map(model => ({
          where: model.id ? { id: model.id } : { id: 'non-existent-id' }, // dummy if no id
          update: {
            modelName: model.modelName,
            generations: model.generations?.map(gen => ({
              upsert: {
                where: gen.id ? { id: gen.id } : { id: 'non-existent-id' },
                update: {
                  generationName: gen.generationName,
                  body: gen.body,
                  productionStart: gen.productionStart
                    ? new Date(gen.productionStart)
                    : undefined,
                  productionEnd: gen.productionEnd
                    ? new Date(gen.productionEnd)
                    : undefined,
                  engines: gen.engines?.map(engine => ({
                    upsert: {
                      where: engine.id
                        ? { id: engine.id }
                        : { id: 'non-existent-id' },
                      update: {
                        engineCode: engine.engineCode,
                        kw: engine.kw,
                        hp: engine.hp,
                        ccm: engine.ccm,
                        fuelType: engine.fuelType,
                      },
                      create: {
                        engineCode: engine.engineCode,
                        kw: engine.kw,
                        hp: engine.hp,
                        ccm: engine.ccm,
                        fuelType: engine.fuelType,
                      },
                    },
                  })),
                },
                create: {
                  generationName: gen.generationName,
                  body: gen.body,
                  productionStart: gen.productionStart
                    ? new Date(gen.productionStart)
                    : undefined,
                  productionEnd: gen.productionEnd
                    ? new Date(gen.productionEnd)
                    : undefined,
                  engines: gen.engines?.map(engine => ({
                    engineCode: engine.engineCode,
                    kw: engine.kw,
                    hp: engine.hp,
                    ccm: engine.ccm,
                    fuelType: engine.fuelType,
                  })),
                },
              },
            })),
          },
          create: {
            modelName: model.modelName,
            generations: model.generations?.map(gen => ({
              generationName: gen.generationName,
              body: gen.body,
              productionStart: gen.productionStart
                ? new Date(gen.productionStart)
                : undefined,
              productionEnd: gen.productionEnd
                ? new Date(gen.productionEnd)
                : undefined,
              engines: gen.engines?.map(engine => ({
                engineCode: engine.engineCode,
                kw: engine.kw,
                hp: engine.hp,
                ccm: engine.ccm,
                fuelType: engine.fuelType,
              })),
            })),
          },
        })),
      };
    }

    const result = await prisma.carBrand.update({
      where: { id: carBrandId },
      data: brandData,
      include: {
        models: {
          include: {
            generations: {
              include: { engines: true },
            },
          },
        },
      },
    });

    if (!result) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Car brand not updated');
    }

    return result;
  } catch (error) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      (error as Error).message,
    );
  }
};

const deleteCarBrandItemFromDb = async (userId: string, carBrandId: string) => {
  // Check if the car brand exists
  const existingBrand = await prisma.carBrand.findUnique({
    where: { id: carBrandId },
  });

  if (!existingBrand) {
    throw new AppError(httpStatus.NOT_FOUND, 'Car brand not found');
  }

  // Proceed to delete the car brand
  const deletedItem = await prisma.carBrand.delete({
    where: {
      id: carBrandId,
      // userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'carBrandId, not deleted');
  }

  return deletedItem;
};

const findBrandByName = async (brandName: string) => {
  return await prisma.carBrand.findUnique({ where: { brandName } });
};

const findModelByName = async (modelName: string) => {
  return await prisma.carModel.findUnique({ where: { modelName } });
};

export const carBrandService = {
  createCarBrandIntoDb,
  bulkCreateCarBrandsIntoDb,
  getCarBrandListFromDb,
  getCarBrandByIdFromDb,
  updateCarBrandIntoDb,
  deleteCarBrandItemFromDb,
  findBrandByName,
  findModelByName,
};
