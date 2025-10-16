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
import { carBrandRoutes } from '../modules/carBrand/carBrand.routes';
import { cartRoutes } from '../modules/cart/cart.routes';
import path from 'path';
import { checkoutRoutes } from '../modules/checkout/checkout.routes';
import { favoriteProductRoutes } from '../modules/favoriteProduct/favoriteProduct.routes';
import { foundingTeamRoutes } from '../modules/foundingTeam/foundingTeam.routes';
import { adminRoutes } from '../modules/admin/admin.routes';
import { contactUsInfoRoutes } from '../modules/contactUsInfo/contactUsInfo.routes';
import { newsletterSubscriberRoutes } from '../modules/newsletterSubscriber/newsletterSubscriber.routes';
import { supportRoutes } from '../modules/support/support.routes';


const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRouters,
  },
  {
    path: '/admin',
    route: adminRoutes,
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
  {
    path: '/car-brands',
    route: carBrandRoutes,
  },
  {
    path: '/carts',
    route: cartRoutes,
  },
  {
    path: '/checkouts',
    route: checkoutRoutes,
  },
  {
    path: '/favorite-products',
    route: favoriteProductRoutes,
  },
  {
    path: '/founding-teams',
    route: foundingTeamRoutes,
  },
  {
    path: '/contact-us-info',
    route: contactUsInfoRoutes,
  },
  {
    path: '/newsletter-subscriber',
    route: newsletterSubscriberRoutes,
  },
   {
    path: '/support',
    route: supportRoutes
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
