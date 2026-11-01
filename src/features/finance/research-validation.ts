import { z } from "zod";
export const financeNewsReviewSchema = z.object({
  eventId: z.string().min(1).max(100),
  status: z.enum(["investigate", "monitor", "discard"]),
  note: z.string().trim().min(3).max(6000),
  openQuestions: z.string().trim().max(6000).default(""),
});
