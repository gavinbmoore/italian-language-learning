// Vercel serverless function entry point
// Hono works with Vercel's Edge Runtime out of the box
import app from '../src/api';

export const config = {
  runtime: 'edge',
};

export default app.fetch;

