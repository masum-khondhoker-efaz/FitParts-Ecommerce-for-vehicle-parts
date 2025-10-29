import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { checkoutController } from './checkout.controller';
import { checkoutValidation } from './checkout.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(UserRoleEnum.BUYER),
  validateRequest(checkoutValidation.createSchema),
  checkoutController.createCheckout,
);

router.post(
  '/purchase-with-cash-on-delivery/:id',
  auth(UserRoleEnum.BUYER),
  validateRequest(checkoutValidation.markCheckoutSchema),
  checkoutController.markCheckoutPaid,
);

router.get('/', auth(), checkoutController.getCheckoutList);

router.get('/:id', auth(), checkoutController.getCheckoutById);

router.put(
  '/:id',
  auth(),
  validateRequest(checkoutValidation.updateSchema),
  checkoutController.updateCheckout,
);

router.delete(
  '/:id',
  auth(UserRoleEnum.BUYER),
  checkoutController.deleteCheckout,
);

export const checkoutRoutes = router;
