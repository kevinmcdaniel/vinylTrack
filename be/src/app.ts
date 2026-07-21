import express from 'express';
import { errorHandler } from './common/errorHandler.js';
import { indexRoute } from './route/index.js';

const app = express();
app.use(express.json());
app.use('/api', indexRoute);
app.use(errorHandler);

export default app;
