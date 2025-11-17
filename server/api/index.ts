// Vercel serverless function entry point
import { handle } from '@hono/node-server/vercel';
import app from '../src/api';

export default handle(app);

