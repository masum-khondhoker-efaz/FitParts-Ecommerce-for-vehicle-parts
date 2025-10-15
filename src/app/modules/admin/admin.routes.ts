import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adminController } from './admin.controller';
import { adminValidation } from './admin.validation';

const router = express.Router();

router.get(
  '/users',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllUsers,
);
router.get(
  '/users/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAUser,
);

router.get(
  '/sellers',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllSellers,
);
router.get(
  '/sellers/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getASeller,
);
router.get(
  '/orders',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllOrders,
);
router.get(
  '/orders/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAOrder,
);

router.patch(
  '/users/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.updateUserStatus,
);

router.delete('/:id', auth(), adminController.deleteAdmin);

export const adminRoutes = router;
