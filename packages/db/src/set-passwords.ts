import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const hash = await bcrypt.hash("Password123!", 12);
console.log("Hash:", hash);
console.log("Self-verify:", await bcrypt.compare("Password123!", hash));

const result = await db.user.updateMany({
  where: { email: { in: ["owner@acme.example","admin@acme.example","member@acme.example","viewer@acme.example"] } },
  data: { password: hash },
});
console.log("Updated", result.count, "users");
await db.$disconnect();
