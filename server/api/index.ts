// Vercel serverless function entry point
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Convert Vercel request to Web Request
    const url = `https://${req.headers.host}${req.url}`;
    
    const webReq = new Request(url, {
      method: req.method || 'GET',
      headers: new Headers(req.headers as HeadersInit),
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    // Call Hono app's fetch handler
    const response = await app.fetch(webReq);
    
    // Convert Web Response to Vercel response
    const body = await response.text();
    
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    return res.send(body);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

