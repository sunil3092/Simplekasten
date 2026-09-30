import { z } from "zod";

export const noteTypeSchema = z.enum(["fleeting", "literature", "permanent", "structure", "daily"]);
export type NoteType = z.infer<typeof noteTypeSchema>;
