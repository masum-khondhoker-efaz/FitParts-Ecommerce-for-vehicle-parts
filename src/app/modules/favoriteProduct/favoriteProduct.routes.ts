import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { favoriteProductController } from './favoriteProduct.controller';
import { favoriteProductValidation } from './favoriteProduct.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.BUYER),
  validateRequest(favoriteProductValidation.createSchema),
  favoriteProductController.createFavoriteProduct,
);

router.get(
  '/',
  auth(UserRoleEnum.BUYER),
  favoriteProductController.getFavoriteProductList,
);

router.get(
  '/:id',
  auth(UserRoleEnum.BUYER),
  favoriteProductController.getFavoriteProductById,
);

router.put(
  '/:id',
  auth(UserRoleEnum.BUYER),
  validateRequest(favoriteProductValidation.updateSchema),
  favoriteProductController.updateFavoriteProduct,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.BUYER),
  favoriteProductController.deleteFavoriteProduct,
);

export const favoriteProductRoutes = router;
