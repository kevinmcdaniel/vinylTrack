import express from 'express';
import { errorHandler } from './common/errorHandler.js';
import { identifyUser } from './common/authorize.js';
import { indexRoute } from './route/index.js';

const app = express();
// No "X-Powered-By: Express" (#134): nothing a browser calls should name the stack.
app.disable('x-powered-by');
app.use(express.json());
app.use(identifyUser);
app.use('/api', indexRoute);
app.use(errorHandler);

export default app;
