import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { BrandInput } from './carBrand.interface';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';
import { calculatePagination } from '../../utils/pagination';
import {
  buildSearchQuery,
  buildFilterQuery,
  combineQueries,
  buildDateRangeQuery,
} from '../../utils/searchFilter';
import {
  formatPaginationResponse,
  getPaginationQuery,
} from '../../utils/pagination';
import { get } from 'node:http';

const createCarBrandIntoDb = async (userId: string, data: BrandInput) => {
  try {
    if (!data.brandName || !data.brandImage) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'brandName and brandImage are required',
      );
    }

    return await prisma.$transaction(async tx => {
      // Check if brandName exists
      const existingBrand = await tx.carBrand.findUnique({
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

        // Create only new models for the existing brand within transaction
        const createdModels = await tx.carModel.createMany({
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

      // Brand does not exist, create brand with models (transactional)
      const brandData = {
        userId,
        brandName: data.brandName!,
        brandImage: data.brandImage!,
        models: {
          create: data.models?.map(model => ({
            modelName: model.modelName ?? '',
            generations: {
              create: model.generations?.map(gen => ({
                generationName: gen.generationName ?? '',
                body: gen.body ?? '',
                productionStart: gen.productionStart
                  ? new Date(gen.productionStart)
                  : null,
                productionEnd: gen.productionEnd
                  ? new Date(gen.productionEnd)
                  : null,
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

      const result = await tx.carBrand.create({
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
    });
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

const getAllCarBrandsFromDb = async (year: string) => {
  // If year is provided, only return brands that have at least one generation
  // whose production range intersects the given year.
  const where = year
    ? {
        models: {
          some: {
            generations: {
              some: {
                AND: [
                  { productionStart: { lte: new Date(Number(year), 11, 31) } },
                  {
                    OR: [
                      { productionEnd: null },
                      { productionEnd: { gte: new Date(Number(year), 0, 1) } },
                    ],
                  },
                ],
              },
            },
          },
        },
      }
    : {};

  const brands = await prisma.carBrand.findMany({
    where,
    select: {
      id: true,
      brandName: true,
    },
  });

  return brands.map(brand => ({
    brandId: brand.id,
    brandName: brand.brandName,
  }));
};

const getAllCarModelsFromDb = async (brandId: string, year: string) => {
  const models = await prisma.carModel.findMany({
    where: {
      brandId,
    },
    include: {
      generations: {
        where: year
          ? {
              AND: [
                { productionStart: { lte: new Date(Number(year), 11, 31) } },
                {
                  OR: [
                    { productionEnd: null },
                    { productionEnd: { gte: new Date(Number(year), 0, 1) } },
                  ],
                },
              ],
            }
          : undefined,
      },
    },
  });

  //flatten the response
  const flatResponse = models.flatMap(model =>
    model.generations.map(gen => ({
      modelId: model.id,
      modelName: model.modelName,
      // generationId: gen.id,
      // generationName: gen.generationName,
      // productionStart: gen.productionStart,
      // productionEnd: gen.productionEnd,
    })),
  );
  return flatResponse;
};

const getAllCarEnginesFromDb = async (modelId: string, year: string) => {
  const generations = await prisma.carGeneration.findMany({
    where: {
      modelId,
      ...(year
        ? {
            AND: [
              { productionStart: { lte: new Date(Number(year), 11, 31) } },
              {
                OR: [
                  { productionEnd: null },
                  { productionEnd: { gte: new Date(Number(year), 0, 1) } },
                ],
              },
            ],
          }
        : {}),
    },
    include: {
      engines: true,
    },
  });

  const engines = generations.flatMap(gen =>
    gen.engines.map(engine => ({
      // generationId: gen.id,
      // generationName: gen.generationName,
      // productionStart: gen.productionStart,
      // productionEnd: gen.productionEnd,
      engineId: engine.id,
      engineCode: engine.engineCode,
      hp: engine.hp,
      kw: engine.kw,
      ccm: engine.ccm,
      fuelType: engine.fuelType,
    })),
  );

  return engines;

};

const getCarBrandListFromDb = async (
  // userId: string,
  options: ISearchAndFilterOptions,
) => {
  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(options);

  // Extract and normalize params
  const brandName = options.brandName?.trim();
  const modelName = options.modelName?.trim();
  const year = options.year ? Number(options.year) : undefined;
  const kw = options.kw ? Number(options.kw) : undefined;

  // Build filter conditions dynamically
  const andClauses: any[] = [];

  // Brand name filter
  if (brandName) {
    andClauses.push({
      brandName: { contains: brandName, mode: 'insensitive' as const },
    });
  }

  // Model filter
  if (modelName) {
    andClauses.push({
      models: {
        some: {
          modelName: { contains: modelName, mode: 'insensitive' as const },
        },
      },
    });
  }

  // Year + kw nested generation filtering
  if (year || kw) {
    const genConditions: any[] = [];

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);

      genConditions.push({
        AND: [
          { productionStart: { lte: endOfYear } },
          {
            OR: [
              { productionEnd: null },
              { productionEnd: { gte: startOfYear } },
            ],
          },
        ],
      });
    }

    if (kw) {
      genConditions.push({ engines: { some: { kw } } });
    }

    andClauses.push({
      models: {
        some: {
          generations: {
            some: {
              AND: genConditions,
            },
          },
        },
      },
    });
  }

  // Combine where query
  const whereQuery = andClauses.length > 0 ? { AND: andClauses } : {};

  // NOTE:
  // We cannot reliably paginate at the brand level when we need a flat list of
  // brand+model+generation+engine "vehicles". The previous approach applied skip/take
  // to brands which allowed the first page to contain more than `limit` vehicles.
  // To enforce a limit on the flattened vehicle list we fetch the matching brands,
  // flatten into vehicles, then apply client-side sort + pagination.

  const carBrands = await prisma.carBrand.findMany({
    where: whereQuery,
    include: {
      models: {
        where: modelName
          ? { modelName: { contains: modelName, mode: 'insensitive' as const } }
          : undefined,
        select: {
          id: true,
          modelName: true,
          generations: {
            where:
              year || kw
                ? {
                    AND: [
                      year
                        ? {
                            productionStart: { lte: new Date(year, 11, 31) },
                            OR: [
                              { productionEnd: null },
                              { productionEnd: { gte: new Date(year, 0, 1) } },
                            ],
                          }
                        : {},
                      kw ? { engines: { some: { kw } } } : {},
                    ],
                  }
                : undefined,
            select: {
              id: true,
              generationName: true,
              productionStart: true,
              productionEnd: true,
              engines: {
                where: kw ? { kw } : undefined,
                select: {
                  id: true,
                  engineCode: true,
                  hp: true,
                  kw: true,
                  ccm: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // flatten the nested response structure
  const vehicles = carBrands.flatMap(brand =>
    brand.models.flatMap(model =>
      model.generations.flatMap(gen =>
        (gen.engines.length ? gen.engines : [null]).map(engine => ({
          brandId: brand.id,
          brandImage: brand.brandImage,
          brandName: brand.brandName,
          modelId: model.id,
          modelName: model.modelName,
          generationId: gen.id,
          generationName: gen.generationName,
          productionStart: gen.productionStart,
          productionEnd: gen.productionEnd,
          engineId: engine?.id ?? null,
          engineCode: engine?.engineCode ?? null,
          hp: engine?.hp ?? null,
          kw: engine?.kw ?? null,
          ccm: engine?.ccm ?? null,
        })),
      ),
    ),
  );

  // Total vehicles count (after flattening)
  const total = vehicles.length;

  // Client-side sorting (if requested)
  if (sortBy) {
    const key = sortBy as keyof typeof vehicles[0];
    const dir = sortOrder === 'desc' ? -1 : 1;
    vehicles.sort((a: any, b: any) => {
      const va = a[key];
      const vb = b[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1 * dir;
      if (vb == null) return -1 * dir;
      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb) * dir;
      }
      if (va > vb) return 1 * dir;
      if (va < vb) return -1 * dir;
      return 0;
    });
  }

  // Apply pagination to flattened vehicles
  const paginated = vehicles.slice(skip, skip + limit);

  return formatPaginationResponse(paginated, total, page, limit);
};

const getCarBrandByIdFromDb = async ( carBrandId: string) => {
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
  getAllCarBrandsFromDb,
  getAllCarModelsFromDb,
  getAllCarEnginesFromDb,
  getCarBrandListFromDb,
  getCarBrandByIdFromDb,
  updateCarBrandIntoDb,
  deleteCarBrandItemFromDb,
  findBrandByName,
  findModelByName,
};
