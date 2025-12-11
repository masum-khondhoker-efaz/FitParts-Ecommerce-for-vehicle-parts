import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adminController } from './admin.controller';
import { adminValidation } from './admin.validation';

const router = express.Router();

router.get(
  '/dashboard-stats',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getDashboardStats,
);

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
  '/products',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllProducts,
)

router.patch(
  '/products/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(adminValidation.updateProductVisibilitySchema),
  adminController.updateProductVisibility,
)

router.patch(
  '/sellers/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  validateRequest(adminValidation.updateSellerStatusSchema),
  adminController.updateSellerStatus,
)
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
router.get(
  '/newsletter-subscribers',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllNewsletterSubscribers,
);

router.patch(
  '/users/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.updateUserStatus,
);

router.delete('/:id', auth(), adminController.deleteAdmin);

export const adminRoutes = router;
