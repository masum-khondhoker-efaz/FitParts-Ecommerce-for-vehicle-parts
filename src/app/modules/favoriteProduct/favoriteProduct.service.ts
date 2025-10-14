import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';


const createFavoriteProductIntoDb = async (userId: string, data: any) => {
  
    const result = await prisma.favoriteProduct.create({ 
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Favorite Product not added');
  }
    return result;
};

const getFavoriteProductListFromDb = async (userId: string) => {
  
    const result = await prisma.favoriteProduct.findMany({
      where: { userId: userId }
    });
    if (result.length === 0) {
    return { message: 'No favorite Product found' };
  }
    return result;
};

const getFavoriteProductByIdFromDb = async (userId: string, favoriteProductId: string) => {
  
    const result = await prisma.favoriteProduct.findUnique({ 
    where: {
      id: favoriteProductId,
    }
   });
    if (!result) {
    throw new AppError(httpStatus.NOT_FOUND,'favoriteProduct not found');
  }
    return result;
  };



const updateFavoriteProductIntoDb = async (userId: string, favoriteProductId: string, data: any) => {
  
    const result = await prisma.favoriteProduct.update({
      where:  {
        id: favoriteProductId,
        userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteProductId, not updated');
  }
    return result;
  };

const deleteFavoriteProductItemFromDb = async (userId: string, favoriteProductId: string) => {
    const deletedItem = await prisma.favoriteProduct.delete({
      where: {
      id: favoriteProductId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'favoriteProductId, not deleted');
  }

    return deletedItem;
  };

export const favoriteProductService = {
createFavoriteProductIntoDb,
getFavoriteProductListFromDb,
getFavoriteProductByIdFromDb,
updateFavoriteProductIntoDb,
deleteFavoriteProductItemFromDb,
};