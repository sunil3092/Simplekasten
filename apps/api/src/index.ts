import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";
import { createContext } from "./context";
import { appRouter } from "./router";

const app = express();

// Wide open for local dev across web/desktop/mobile clients; tighten to known
// origins (the deployed web app, tauri://localhost) before shipping.
app.use(cors());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`VaultVista API listening on :${port}`);
});
