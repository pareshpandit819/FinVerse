import { z } from "zod";

export const MagicLinkRequestSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const MfaEnrollSchema = z.object({
  token: z.string().length(6).regex(/^\d{6}$/),
});

export const MfaChallengeSchema = z.object({
  token: z.string().length(6).regex(/^\d{6}$/),
});

export const RoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
export type Role = z.infer<typeof RoleSchema>;

export const MemberInviteSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: RoleSchema.exclude(["OWNER"]),
});

export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>;
export type MemberInvite = z.infer<typeof MemberInviteSchema>;
