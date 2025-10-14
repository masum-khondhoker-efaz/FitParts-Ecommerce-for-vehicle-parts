import prisma from '../../utils/prisma';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createFoundingTeamIntoDb = async (userId: string, data: any) => {

  //check existing member with same links
  if (data.linkedin || data.instagram || data.twitter) {
    const existingMember = await prisma.foundingTeam.findFirst({
      where: {
        OR: [
          { linkedin: data.linkedin },
          { instagram: data.instagram },
          { twitter: data.twitter },
        ],
      },
    });
    if (existingMember) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Team member with this linkedin/instagram/twitter already exists',
      );
    }
  }

  const result = await prisma.foundingTeam.create({
    data: {
      ...data,
      userId: userId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Founding team member not created');
  }
  return result;
};

const getFoundingTeamListFromDb = async () => {
  const result = await prisma.foundingTeam.findMany();
  if (result.length === 0) {
    return { message: 'No founding team member found' };
  }
  return result;
};

const getFoundingTeamByIdFromDb = async (
  userId: string,
  foundingTeamId: string,
) => {
  const result = await prisma.foundingTeam.findUnique({
    where: {
      id: foundingTeamId,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Founding team member not found');
  }
  return result;
};

const updateFoundingTeamIntoDb = async (
  userId: string,
  foundingTeamId: string,
  data: any,
) => {
  // check existing member with same name
  if (data.name) {
    const existingMember = await prisma.foundingTeam.findFirst({
      where: {
        id: { not: foundingTeamId },
      },
    });
    if (existingMember) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Team member with this name already exists',
      );
    }
  }

  const result = await prisma.foundingTeam.update({
    where: {
      id: foundingTeamId,
    },
    data: {
      ...data,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Founding TeamId, not updated');
  }
  return result;
};

const deleteFoundingTeamItemFromDb = async (
  userId: string,
  foundingTeamId: string,
) => {
  const deletedItem = await prisma.foundingTeam.delete({
    where: {
      id: foundingTeamId,
      userId: userId,
    },
  });
  if (!deletedItem) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Founding TeamId, not deleted');
  }

  return deletedItem;
};

export const foundingTeamService = {
  createFoundingTeamIntoDb,
  getFoundingTeamListFromDb,
  getFoundingTeamByIdFromDb,
  updateFoundingTeamIntoDb,
  deleteFoundingTeamItemFromDb,
};
