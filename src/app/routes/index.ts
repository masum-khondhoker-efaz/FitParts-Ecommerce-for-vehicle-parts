import express from 'express';
import { UserRouters } from '../modules/user/user.routes';
import { AuthRouters } from '../modules/auth/auth.routes';
import { termAndConditionRoutes } from '../modules/termAndCondition/termAndCondition.routes';
import { privacyPolicyRoutes } from '../modules/privacyPolicy/privacyPolicy.routes';
import { reviewRoutes } from '../modules/review/review.routes';
import { categoryRoutes } from '../modules/category/category.routes';

import { aboutUsRoutes } from '../modules/aboutUs/aboutUs.routes';
import { helpAndSupportRoutes } from '../modules/helpAndSupport/helpAndSupport.routes';
import { faqRoutes } from '../modules/faq/faq.routes';
import { productRoutes } from '../modules/product/product.routes';


const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRouters,
  },
  {
    path: '/users',
    route: UserRouters,
  },
  // {
  //   path: '/notifications',
  //   route: NotificationRoutes,
  // },
  {
    path: '/products',
    route: productRoutes,
  },
  {
    path: '/terms-&-conditions',
    route: termAndConditionRoutes,
  },
  {
    path: '/privacy-policy',
    route: privacyPolicyRoutes,
  },
  {
    path: '/about-us',
    route: aboutUsRoutes,
  },
  {
    path: '/help-and-support',
    route: helpAndSupportRoutes,
  },
  {
    path: '/faqs',
    route: faqRoutes,
  },
  {
    path: '/reviews',
    route: reviewRoutes,
  },
  {
    path: '/categories',
    route: categoryRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
