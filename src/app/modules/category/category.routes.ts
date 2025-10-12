import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { categoryController } from './category.controller';
import { categoryValidation } from './category.validation';
import { UserRoleEnum } from '@prisma/client';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parse } from 'path';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.single('categoryImage'),
  parseBody,
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(categoryValidation.createSchema),
  categoryController.createCategory,
);

router.get('/',categoryController.getCategoryList);

router.get('/:id', categoryController.getCategoryById);

router.patch(
  '/:id',
  multerUploadMultiple.single('categoryImage'),
  parseBody,
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(categoryValidation.updateSchema),
  categoryController.updateCategory,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  categoryController.deleteCategory,
);

export const categoryRoutes = router;
