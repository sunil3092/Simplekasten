import { Router } from "express";
import { prisma } from "@simplekasten/db";
import { createKnowledgeBaseInput, slugify } from "@simplekasten/core";
import { authMiddleware, asyncHandler, AuthRequest } from "../middleware";

const router: Router = Router();
router.use(authMiddleware);

// GET /api/vaults
router.get(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const vaults = await prisma.knowledgeBase.findMany({
      where: { ownerId: req.userId! },
      orderBy: { createdAt: "asc" },
    });

    res.json(vaults);
  }),
);

// POST /api/vaults
router.post(
  "/",
  asyncHandler(async (req: AuthRequest, res) => {
    const input = createKnowledgeBaseInput.parse(req.body);

    const vault = await prisma.knowledgeBase.create({
      data: {
        ownerId: req.userId!,
        name: input.name,
        slug: slugify(input.name, "vault"),
      },
    });

    res.status(201).json(vault);
  }),
);

export default router;
