// Vercel serverless function entry point for Node.js runtime
import { handle } from 'hono/vercel';
import app from '../src/api';

export default handle(app);

