import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import router from './app/routes';
import { logger, loggerConsole } from './app/middlewares/logger';
import path from 'path';
import bodyParser from 'body-parser';
import { PaymentController } from './app/modules/payment/payment.controller';

const app: Application = express();

app.use(logger);
app.use(loggerConsole);

app.use(
  cors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://13.62.189.94:5173',
      'http://13.62.189.94:5174',
      'http://13.62.189.94:3000',
      'http://13.62.189.94',
      'http://10.10.20.60:3000',
      'https://ecommerce-website-rho-lemon.vercel.app',
      'https://hatem-dashboard.vercel.app',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }),
);
// app.use(
//   cors({
//     origin: true,
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   }),
// );
// app.use(
//   cors(
//     {
//     origin: "*", // Allow all origins for development
//     credentials: true, // Allow credentials
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   }
// )
// );

app.use(
  '/api/v1/stripe/payment-webhook',
  express.raw({ type: 'application/json' }),
  PaymentController.handleWebHook,
);

//parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
  res.send({
    Message: 'SpareDoc server is now live. . .',
  });
});
// Serve static files from 'public' folder
app.use(express.static(path.join(process.cwd(), 'public')));

app.use('/api/v1', router);

app.use(globalErrorHandler);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'API NOT FOUND!',
    error: {
      path: req.originalUrl,
      message: 'Your requested path is not found!',
    },
  });
});

export default app;
