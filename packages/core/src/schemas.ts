import { z } from "zod";

export const noteTypeSchema = z.enum(["fleeting", "literature", "permanent", "structure"]);

export const createNoteInput = z.object({
  kbId: z.string().min(1),
  title: z.string().min(1).max(300),
  content: z.string().max(200_000),
  type: noteTypeSchema.default("fleeting"),
});
export type CreateNoteInput = z.infer<typeof createNoteInput>;

export const updateNoteInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300).optional(),
  content: z.string().max(200_000).optional(),
  type: noteTypeSchema.optional(),
});
export type UpdateNoteInput = z.infer<typeof updateNoteInput>;

export const createKnowledgeBaseInput = z.object({
  name: z.string().min(1).max(120),
});
export type CreateKnowledgeBaseInput = z.infer<typeof createKnowledgeBaseInput>;

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginInput>;
