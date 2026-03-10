import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  // Remove legacy demo users and related records by fixed IDs/emails.
  const demoUserIds = ["u1", "u2", "u3"];
  const demoEmails = [
    "student@bilimmentor.local",
    "teacher@bilimmentor.local",
    "admin@bilimmentor.local",
  ];

  await prisma.notification.deleteMany({
    where: {
      OR: [
        { id: { in: ["n1", "n2", "n3", "n4"] } },
        { userId: { in: demoUserIds } },
      ],
    },
  });

  await prisma.message.deleteMany({
    where: {
      OR: [
        { id: { in: ["msg1", "msg2", "msg3"] } },
        { fromUserId: { in: demoUserIds } },
        { toUserId: { in: demoUserIds } },
      ],
    },
  });

  await prisma.grade.deleteMany({
    where: { gradedById: { in: demoUserIds } },
  });

  await prisma.submission.deleteMany({
    where: { studentId: { in: demoUserIds } },
  });

  await prisma.assignment.deleteMany({
    where: { id: { in: ["a1", "a2", "a3"] } },
  });

  await prisma.accessRequest.deleteMany({
    where: {
      OR: [
        { studentId: { in: demoUserIds } },
        { teacherId: { in: demoUserIds } },
      ],
    },
  });

  await prisma.enrollment.deleteMany({
    where: {
      OR: [
        { studentId: { in: demoUserIds } },
        { approvedByTeacherId: { in: demoUserIds } },
      ],
    },
  });

  await prisma.course.deleteMany({
    where: {
      OR: [{ id: { in: ["c1", "c2"] } }, { teacherId: { in: demoUserIds } }],
    },
  });

  await prisma.user.deleteMany({
    where: {
      OR: [{ id: { in: demoUserIds } }, { email: { in: demoEmails } }],
    },
  });

  // Optional bootstrap for real admin account.
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPhone = process.env.BOOTSTRAP_ADMIN_PHONE?.trim();
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  const adminFullName =
    process.env.BOOTSTRAP_ADMIN_FULL_NAME?.trim() || "System Administrator";

  if (adminEmail && adminPhone && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: adminEmail }, { phone: adminPhone }] },
      select: { id: true },
    });

    if (!existing) {
      const allUserIds = await prisma.user.findMany({ select: { id: true } });
      const maxId = allUserIds.reduce((acc, row) => {
        const value = Number.parseInt(row.id.replace(/^u/, ""), 10);
        return Number.isNaN(value) ? acc : Math.max(acc, value);
      }, 0);
      const nextId = `u${maxId + 1}`;

      await prisma.user.create({
        data: {
          id: nextId,
          fullName: adminFullName,
          email: adminEmail,
          phone: adminPhone,
          passwordHash,
          role: UserRole.admin,
        },
      });

      console.log(`Bootstrap admin created: ${adminEmail}`);
    } else {
      console.log(`Bootstrap admin already exists: ${adminEmail}`);
    }
  }

  console.log("Demo data removed. Seed completed without demo fixtures.");
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
