import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express, { type Express } from "express";
import { registerAttachmentRoutes } from "./attachments";
import { createContext } from "./context";
import { registerExportRoute } from "./export";
import { appRouter } from "./router";

// Split from index.ts so tests can exercise the app (via supertest) without
// binding a real port — index.ts is the only thing that calls app.listen().
export function createApp(): Express {
  const app = express();

  // Wide open for local dev across web/desktop/mobile clients; tighten to
  // known origins (the deployed web app, tauri://localhost) before shipping.
  app.use(cors());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  registerExportRoute(app);
  registerAttachmentRoutes(app);

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
