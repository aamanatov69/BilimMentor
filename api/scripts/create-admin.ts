import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

function readArg(name: string) {
  const key = `--${name}`;
  const index = process.argv.indexOf(key);
  if (index === -1 || index + 1 >= process.argv.length) {
    return "";
  }
  return process.argv[index + 1].trim();
}

async function main() {
  const fullName = readArg("fullName");
  const email = readArg("email").toLowerCase();
  const phone = readArg("phone");
  const password = readArg("password");

  if (!fullName || !email || !phone || !password) {
    console.error(
      'Usage: npx tsx scripts/create-admin.ts --fullName "Имя" --email "admin@example.com" --phone "+79990000000" --password "<CHANGE_ME>"',
    );
    process.exit(1);
  }

  const exists = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { id: true },
  });

  if (exists) {
    console.error("User with this email or phone already exists");
    process.exit(1);
  }


  const created = await prisma.user.create({
    data: {
      id: `u_${randomUUID()}`,
      fullName,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
    },
    select: { id: true, fullName: true, email: true },
  });

  console.log(`Admin created: ${created.id} (${created.email})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
