import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { BrandInput } from './carBrand.interface';

const createCarBrandIntoDb = async (userId: string, data: BrandInput) => {
  try {
    if (!data.brandName || !data.iconName) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'brandName and iconName are required',
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
      iconName: data.iconName,
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
          iconName: brand.iconName,
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
      iconName: brandData.iconName,
      models: {
        create: models,
      },
    },
  });

  return createdBrand;
};

const getCarBrandListFromDb = async (userId: string) => {
  const result = await prisma.carBrand.findMany();
  if (result.length === 0) {
    return { message: 'No carBrand found' };
  }
  return result;
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
