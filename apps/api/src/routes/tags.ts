import { Router } from "express";
import { z } from "zod";
import { prisma } from "@vaultvista/db";
import { authMiddleware, asyncHandler, AuthRequest } from "../middleware";
import { Errors } from "../errors";

const router: Router = Router();
router.use(authMiddleware);

// GET /api/tags?kbId=...
router.get(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const { kbId } = z.object({ kbId: z.string() }).parse(req.query);

    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: kbId, ownerId: req.userId! },
    });
    if (!kb) throw Errors.notFound("Knowledge base");

    const tags = await prisma.tag.findMany({
      where: { kbId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { notes: true } } },
    });

    res.json(
      tags.map((t) => ({ id: t.id, name: t.name, noteCount: t._count.notes })),
    );
  }),
);

export default router;
