// Vercel serverless entrypoint: export the Express app as a request handler
// instead of binding a port (see index.ts for the long-running server).
import app from "./app";

export default app;
