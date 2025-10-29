import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { addressController } from './address.controller';
import { addressValidation } from './address.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(addressValidation.createSchema),
  addressController.createAddress,
);

router.get('/', auth(), addressController.getAddressList);

router.get('/:id', auth(), addressController.getAddressById);

router.patch(
  '/:id',
  auth(),
  validateRequest(addressValidation.updateSchema),
  addressController.updateAddress,
);

router.delete('/:id', auth(), addressController.deleteAddress);

export const addressRoutes = router;
