// Vercel serverless function entry point
// Hono works with Vercel's Edge Runtime out of the box
import app from '../src/api';

export default app.fetch;

