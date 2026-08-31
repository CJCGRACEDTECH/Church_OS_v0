// Vercel serverless function wrapping the Church OS Express API.
// All /api/* requests are rewritten here (see vercel.json); Express routes
// carry the /api prefix already, and Vercel preserves the original req.url.
// Body parsing is left to Express so the Stripe/Square webhook HMAC checks
// receive the raw payload.
export { default } from "../artifacts/api-server/dist/vercel.mjs";

export const config = {
  api: {
    bodyParser: false,
  },
};
