import { z } from "zod";

export const noteTypeSchema = z.enum(["fleeting", "literature", "permanent", "structure"]);
export type NoteType = z.infer<typeof noteTypeSchema>;
