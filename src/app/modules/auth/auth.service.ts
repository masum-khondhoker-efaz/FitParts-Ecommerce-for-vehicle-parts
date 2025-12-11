import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import { generateToken, refreshToken } from '../../utils/generateToken';
import prisma from '../../utils/prisma';
import { verifyToken } from '../../utils/verifyToken';
import { UserRoleEnum, UserStatus } from '@prisma/client';

const loginUserFromDB = async (payload: {
  email: string;
  password: string;
}) => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
    include: {
      roles: {
        select: {
          role: {
            select: { name: true },
          },
        },
      },
    },
  });
  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (userData.password === null) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password is not set');
  }

  const isCorrectPassword: Boolean = await bcrypt.compare(
    payload.password,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');
  }
  // if (
  //   userData.isProfileComplete === false ||
  //   userData.isProfileComplete === null
  // ) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'Please complete your profile before logging in',
  //   );
  // }

  if (userData.status === UserStatus.BLOCKED) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Your account is blocked. Please contact support.',
    );
  }

  if (userData.status === UserStatus.PENDING) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Your account is inactive. Please verify your email.',
    );
  }

  if (userData.isLoggedIn === false) {
    const updateUser = await prisma.user.update({
      where: { id: userData.id },
      data: { isLoggedIn: true },
    });
    if (!updateUser) {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'User login failed');
    }
  }

  // check the user has seller role or not
  let isSeller = false;
  const hasSellerRole = userData.roles.some(
    role => role.role.name === UserRoleEnum.SELLER,
  );
  if (!hasSellerRole) {
    isSeller = false;
  } else {
    isSeller = true;
  }

  const accessToken = await generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.roles[0]?.role.name as UserRoleEnum,
      purpose: 'access',
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshedToken = await refreshToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.roles[0]?.role.name as UserRoleEnum,
    },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );
  return {
    id: userData.id,
    name: userData.fullName,
    email: userData.email,
    role: userData.roles[0]?.role.name as UserRoleEnum,
    isSeller: isSeller,
    image: userData.image,
    accessToken: accessToken,
    refreshToken: refreshedToken,
  };
};

const refreshTokenFromDB = async (refreshedToken: string) => {
  if (!refreshedToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Refresh token is required');
  }

  const decoded = await verifyToken(
    refreshedToken,
    config.jwt.refresh_secret as Secret,
  );
  if (!decoded) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid refresh token');
  }

  const userData = await prisma.user.findUnique({
    where: {
      id: (decoded as any).id,
      status: UserStatus.ACTIVE,
    },
    include: {
      roles: {
        select: { role: { select: { name: true } } },
      },
    },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const newAccessToken = await generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.roles[0]?.role.name as UserRoleEnum,
      purpose: 'access',
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const newRefreshToken = await refreshToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.roles[0]?.role.name as UserRoleEnum,
    },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const logoutUserFromDB = async (userId: string) => {
  await prisma.user.update({
    where: { id: userId },
    data: { isLoggedIn: false },
  });
};
export const AuthServices = {
  loginUserFromDB,
  logoutUserFromDB,
  refreshTokenFromDB,
};
