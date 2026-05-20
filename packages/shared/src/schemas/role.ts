import { z } from "zod";

export const roleAssignmentInput = z.object({
  role: z.enum(["client", "lawyer"]),
});

export type RoleAssignmentInput = z.infer<typeof roleAssignmentInput>;
