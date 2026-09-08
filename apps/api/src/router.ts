import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { knowledgeBaseRouter } from "./routers/knowledgeBase";
import { noteRouter } from "./routers/note";
import { tagRouter } from "./routers/tag";

export const appRouter = router({
  auth: authRouter,
  knowledgeBase: knowledgeBaseRouter,
  note: noteRouter,
  tag: tagRouter,
});

export type AppRouter = typeof appRouter;
