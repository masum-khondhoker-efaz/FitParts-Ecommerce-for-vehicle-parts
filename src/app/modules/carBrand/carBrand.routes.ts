import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { carBrandController } from './carBrand.controller';
import { carBrandValidation } from './carBrand.validation';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(carBrandValidation.CarBrandCreateSchema),
  carBrandController.createCarBrand,
);

router.get('/', auth(), carBrandController.getCarBrandList);

router.get('/:id', auth(), carBrandController.getCarBrandById);

router.patch(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(carBrandValidation.updateSchema),
  carBrandController.updateCarBrand,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  carBrandController.deleteCarBrand,
);

export const carBrandRoutes = router;
