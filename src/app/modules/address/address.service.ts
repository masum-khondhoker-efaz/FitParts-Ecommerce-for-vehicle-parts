import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createAddressIntoDb = async (userId: string, data: any) => {
  const findExisting = await prisma.address.findFirst({
    where: {
      userId: userId,
      type: data.type,
    },
  });
  if (findExisting) {
    throw new AppError(httpStatus.CONFLICT, 'You have already added a address');
  }

  const result = await prisma.address.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'address not created');
  }
  return result;
};

const getAddressListFromDb = async (userId: string) => {
  const result = await prisma.address.findMany({
    where: {
      userId: userId,
    },
  });
  if (!result) {
    return { message: 'No address found' };
  }
  return result;
};

const getAddressByIdFromDb = async (userId: string, addressId: string) => {
  const result = await prisma.address.findUnique({
    where: {
      id: addressId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'address not found');
  }
  return result;
};

const updateAddressIntoDb = async (
  userId: string,
  addressId: string,
  data: any,
) => {

  const findExisting = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId: userId,
    },
  });
  if (!findExisting) {
    throw new AppError(httpStatus.NOT_FOUND, 'Address not found');
  }

  const result = await prisma.address.updateMany({
    where: {
      id: addressId,
      userId: userId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'addressId, not updated');
  }
  return result;
};

const deleteAddressItemFromDb = async (userId: string, addressId: string) => {
  const deletedItem = await prisma.address.delete({
    where: {
      id: addressId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'addressId, not deleted');
  }

  return deletedItem;
};

export const addressService = {
  createAddressIntoDb,
  getAddressListFromDb,
  getAddressByIdFromDb,
  updateAddressIntoDb,
  deleteAddressItemFromDb,
};
