import { z } from 'zod';

export const createNoteBodySchema = z
  .object({
    content: z.string().trim().min(1).max(20_000),
  })
  .strict();

export const updateNoteBodySchema = z
  .object({
    content: z.string().trim().min(1).max(20_000),
    editReason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export type CreateNoteBody = z.infer<typeof createNoteBodySchema>;
export type UpdateNoteBody = z.infer<typeof updateNoteBodySchema>;
