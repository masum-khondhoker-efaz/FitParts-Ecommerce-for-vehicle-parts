import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { BrandInput } from './carBrand.interface';


const createCarBrandIntoDb = async (userId: string, data: BrandInput) => {
  try {
    if (!data.brandName || !data.iconName) {
      throw new AppError(httpStatus.BAD_REQUEST, 'brandName and iconName are required');
    }

    const brandData = {
      userId,
      brandName: data.brandName,
      iconName: data.iconName,
      models: {
        create: data.models?.map((model) => ({
          modelName: model.modelName ?? '',
          generations: {
            create: model.generations?.map((gen) => ({
              generationName: gen.generationName ?? '',
              body: gen.body ?? '',
              productionStart: gen.productionStart ? new Date(gen.productionStart) : undefined,
              productionEnd: gen.productionEnd ? new Date(gen.productionEnd) : undefined,
              engines: {
                create: gen.engines?.map((engine) => ({
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
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, (error as Error).message);
  }
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
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'carBrand not found');
  }
    return result;
  };



const updateCarBrandIntoDb = async (
  userId: string,
  carBrandId: string,
  data: BrandInput
) => {
  try {
    const brandData: any = {};
    if (data.brandName) brandData.brandName = data.brandName;

    if (data.models) {
      brandData.models = {
        upsert: data.models.map((model) => ({
          where: model.id ? { id: model.id } : { id: 'non-existent-id' }, // dummy if no id
          update: {
            modelName: model.modelName,
            generations: model.generations?.map((gen) => ({
              upsert: {
                where: gen.id ? { id: gen.id } : { id: 'non-existent-id' },
                update: {
                  generationName: gen.generationName,
                  body: gen.body,
                  productionStart: gen.productionStart ? new Date(gen.productionStart) : undefined,
                  productionEnd: gen.productionEnd ? new Date(gen.productionEnd) : undefined,
                  engines: gen.engines?.map((engine) => ({
                    upsert: {
                      where: engine.id ? { id: engine.id } : { id: 'non-existent-id' },
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
                  productionStart: gen.productionStart ? new Date(gen.productionStart) : undefined,
                  productionEnd: gen.productionEnd ? new Date(gen.productionEnd) : undefined,
                  engines: gen.engines?.map((engine) => ({
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
            generations: model.generations?.map((gen) => ({
              generationName: gen.generationName,
              body: gen.body,
              productionStart: gen.productionStart ? new Date(gen.productionStart) : undefined,
              productionEnd: gen.productionEnd ? new Date(gen.productionEnd) : undefined,
              engines: gen.engines?.map((engine) => ({
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
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, (error as Error).message);
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

export const carBrandService = {
createCarBrandIntoDb,
getCarBrandListFromDb,
getCarBrandByIdFromDb,
updateCarBrandIntoDb,
deleteCarBrandItemFromDb,
};