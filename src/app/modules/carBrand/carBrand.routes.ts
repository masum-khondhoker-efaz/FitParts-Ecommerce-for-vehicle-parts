import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { carBrandController } from './carBrand.controller';
import { carBrandValidation } from './carBrand.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parse } from 'path';
import { parseBody } from '../../middlewares/parseBody';
import { multerUploadCSV } from '../../utils/multerDisk';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.single('brandImage'),
  parseBody,
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(carBrandValidation.CarBrandCreateSchema),
  carBrandController.createCarBrand,
);

router.post(
  '/bulk',
  multerUploadCSV.single('csvFile'),
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  carBrandController.bulkCreateCarBrand,
);

router.get('/brands/:year', carBrandController.getAllCarBrands);

router.get('/models/:brandId/:year', carBrandController.getAllCarModels);

router.get('/engines/:modelId', carBrandController.getAllCarEngines);

router.get('/', carBrandController.getCarBrandList);

router.get('/:id', carBrandController.getCarBrandById);

router.patch(
  '/:id',
  multerUploadMultiple.single('brandImage'),
  parseBody,
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
