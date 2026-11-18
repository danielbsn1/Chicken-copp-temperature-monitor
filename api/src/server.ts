import { createApp } from "./app.js";
import { logger } from "./core/logger.js";

// Só para desenvolvimento local. Na Vercel, a entrada é api/index.ts.
const port = Number(process.env.PORT ?? 3333);

createApp().listen(port, () => {
  logger.info(`API em http://localhost:${port}`);
});
