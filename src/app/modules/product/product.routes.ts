import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { productController } from './product.controller';
import { productValidation } from './product.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parse } from 'path';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.array('productImages', 5),
  parseBody,
  auth(UserRoleEnum.SELLER, UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(productValidation.productSchema),
  productController.createProduct,
);

router.get('/', productController.getProductList);

router.get('/category-wise/:id', productController.getAllCategoryWiseProducts);

router.get('/vehicles/:id', productController.getCategoriesByVehicle);


router.get('/:id', productController.getProductById);

router.patch(
  '/:id',
  multerUploadMultiple.array('productImages', 5),
  parseBody,
  auth(),
  validateRequest(productValidation.updateProductSchema),
  productController.updateProduct,
);

router.delete('/:id', auth(), productController.deleteProduct);

export const productRoutes = router;
