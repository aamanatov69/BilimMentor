import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Test accounts cannot be created in production.");
  const roles: UserRole[] = ["admin", "teacher", "student"];
  const credentials = await prisma.$transaction(async (tx) => {
    const results: Array<{ role: UserRole; email: string; password?: string; status: string }> = [];
    for (const role of roles) {
      const email = `qa.${role}@bilimmentor.local`;
      const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) { results.push({ role, email, status: "Already exists; password unchanged" }); continue; }
      const password = randomBytes(18).toString("base64url");
      await tx.user.create({ data: {
        id: `qa_${randomUUID()}`, fullName: `QA ${role}`, email,
        phone: `qa-${randomUUID()}`, role, passwordHash: await bcrypt.hash(password, 12),
      } });
      results.push({ role, email, password, status: "Created" });
    }
    return results;
  }, { timeout: 30000 });
  // Only newly generated test passwords are shown, never existing account credentials.
  console.table(credentials);
}
main().catch(() => { console.error("Test accounts were not created. Check database connection and migrations with db:check and prisma:migrate:deploy."); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
