import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { orderController } from './order.controller';
import { orderValidation } from './order.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(orderValidation.createSchema),
  orderController.createOrder,
);

router.get(
  '/dashboard-summary',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN, UserRoleEnum.SELLER),
  orderController.getDashboardSummary,
);

router.get(
  '/my-orders',
  auth(UserRoleEnum.BUYER),
  orderController.getOrderList,
);

router.get(
  '/current-orders',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN, UserRoleEnum.SELLER),
  orderController.getAllOrders,
);
router.get(
  '/current-orders/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN, UserRoleEnum.SELLER),
  orderController.getAOrderById,
);

router.patch(
  '/update-order-status/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN, UserRoleEnum.SELLER),
  validateRequest(orderValidation.updateOrderStatusSchema),
  orderController.updateOrderStatus,
);

router.get(
  '/sales-report',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN, UserRoleEnum.SELLER),
  orderController.getSalesReport,
);

router.get('/:id', auth(), orderController.getOrderById);

router.put(
  '/:id',
  auth(),
  validateRequest(orderValidation.updateSchema),
  orderController.updateOrder,
);

router.delete('/:id', auth(), orderController.deleteOrder);

export const orderRoutes = router;
