import { prisma } from "@repo/db/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const result = RegisterSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      emailVerifiedAt: new Date(),
    },
  });

  // Create a default personal organization for the new user
  const slug = email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const org = await prisma.organization.create({
    data: {
      name: `${name}'s Finances`,
      slug: `${slug}-${user.id.slice(0, 8)}`,
    },
  });

  await prisma.membership.create({
    data: { organizationId: org.id, userId: user.id, role: "OWNER" },
  });

  return Response.json({ success: true }, { status: 201 });
}
