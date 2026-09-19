import cors from "cors";
import express, { type Express, Response, NextFunction } from "express";
import { registerAttachmentRoutes } from "./attachments";
import { registerExportRoute } from "./export";
import { handleError } from "./errors";
import authRoutes from "./routes/auth";
import notesRoutes from "./routes/notes";
import tagsRoutes from "./routes/tags";
import vaultsRoutes from "./routes/vaults";
import attachmentsRoutes from "./routes/attachments";

// Split from index.ts so tests can exercise the app (via supertest) without
// binding a real port — index.ts is the only thing that calls app.listen().
export function createApp(): Express {
  const app = express();

  // Wide open for local dev across web/desktop/mobile clients; tighten to
  // known origins (the deployed web app, the Electron file:// origin) before
  // shipping.
  app.use(cors());

  // JSON body parser
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Mount REST routes
  app.use("/api/auth", authRoutes);
  app.use("/api/notes", notesRoutes);
  app.use("/api/tags", tagsRoutes);
  app.use("/api/vaults", vaultsRoutes);
  app.use("/api/attachments", attachmentsRoutes);

  // Binary transfers (multipart upload, zip streaming) don't fit the REST
  // routes' JSON shape, so these stay as their own plain Express routes.
  registerExportRoute(app);
  registerAttachmentRoutes(app);

  // Error handling middleware (must be last)
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: Response,
      _next: NextFunction,
    ) => {
      handleError(err, res);
    },
  );

  return app;
}
