import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { cartController } from './cart.controller';
import { cartValidation } from './cart.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(cartValidation.createSchema),
  cartController.createCart,
);

router.post(
  '/bulk',
  auth(),
  validateRequest(cartValidation.bulkCreateSchema),
  cartController.bulkCreateCart,
);

router.get('/', auth(), cartController.getCartList);

router.get('/:id', auth(), cartController.getCartById);

// Update quantity of a cart item (id = productId)
router.put(
  '/:id',
  auth(),
  validateRequest(cartValidation.updateSchema),
  cartController.updateCart,
);

router.delete('/', auth(), cartController.deleteAllCarts);

router.delete('/:id', auth(), cartController.deleteCart);

export const cartRoutes = router;
