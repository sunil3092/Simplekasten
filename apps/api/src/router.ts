import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { knowledgeBaseRouter } from "./routers/knowledgeBase";
import { noteRouter } from "./routers/note";

export const appRouter = router({
  auth: authRouter,
  knowledgeBase: knowledgeBaseRouter,
  note: noteRouter,
});

export type AppRouter = typeof appRouter;
