import { UserRole, NotificationTargetRole, NotificationType } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { lmsRepository } from "../repositories/lmsRepository";
import { ensure } from "../utils/httpError";
import { createToken, verifyCourseInviteToken } from "../utils/jwt";
import { buildResetPasswordLink, sendResetPasswordEmail } from "../utils/mailer";
import {
  makeEntityId,
  normalizePhoneIdentifier,
  hashResetToken,
  getPasswordResetTokenOrThrow,
  requireCurrentUser,
} from "./shared/serviceHelpers";

export async function register(input: {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  courseInviteToken?: string;
}) {
  const { fullName, email, phone, password, role } = input;
  const inviteToken =
    typeof input.courseInviteToken === "string"
      ? input.courseInviteToken.trim()
      : "";

  ensure(
    fullName && email && phone && password && role,
    400,
    "Операция недоступна",
  );
  ensure(
    role === UserRole.student || role === UserRole.teacher,
    400,
    "Операция недоступна",
  );

  const invitePayload = inviteToken
    ? verifyCourseInviteToken(inviteToken)
    : null;

  if (inviteToken) {
    ensure(
      invitePayload,
      400,
      "Ссылка приглашения недействительна или устарела",
    );
    ensure(
      role === UserRole.student,
      400,
      "Приглашение доступно только для роли student",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  const userExists = await lmsRepository.prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    },
    select: { id: true },
  });

  ensure(!userExists, 409, "Операция недоступна");

  const registrationResult = await lmsRepository.prisma.$transaction(
    async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          id: await lmsRepository.nextUserId(),
          fullName: fullName.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash: await bcrypt.hash(password, 12),
          role,
        },
      });

      let autoEnrollment:
        | {
            courseId: string;
            courseTitle: string;
          }
        | undefined;

      if (invitePayload) {
        const invitedCourse = await tx.course.findUnique({
          where: { id: invitePayload.courseId },
          select: { id: true, title: true, teacherId: true },
        });

        ensure(
          invitedCourse && invitedCourse.teacherId === invitePayload.teacherId,
          400,
          "Ссылка приглашения недействительна или устарела",
        );

        await tx.enrollment.create({
          data: {
            id: await lmsRepository.nextEnrollmentId(),
            courseId: invitedCourse.id,
            studentId: createdUser.id,
            approvedByTeacherId: invitedCourse.teacherId,
            approvedAt: new Date(),
          },
        });

        await tx.notification.create({
          data: {
            id: await lmsRepository.nextNotificationId(),
            type: NotificationType.system_message,
            title: "Доступ к курсу открыт",
            body: `Вы автоматически зачислены на курс \"${invitedCourse.title}\".`,
            targetRole: NotificationTargetRole.student,
            userId: createdUser.id,
          },
        });

        autoEnrollment = {
          courseId: invitedCourse.id,
          courseTitle: invitedCourse.title,
        };
      }

      return { createdUser, autoEnrollment };
    },
  );

  const { createdUser } = registrationResult;

  return {
    message: "Успешно",
    token: createToken(createdUser),
    user: {
      id: createdUser.id,
      fullName: createdUser.fullName,
      email: createdUser.email,
      phone: createdUser.phone,
      role: createdUser.role,
    },
    autoEnrollment: registrationResult.autoEnrollment,
  };
}


export async function login(input: { identifier?: string; password?: string; expectedUserId?: string }) {
  const identifier = input.identifier?.trim();
  const { password } = input;
  ensure(identifier && password, 400, "Некорректный запрос");

  const normalizedPhone = normalizePhoneIdentifier(identifier);
  const loginCandidates = [identifier, identifier.toLowerCase()];
  if (normalizedPhone) {
    loginCandidates.push(normalizedPhone);
  }

  const user = await lmsRepository.prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        ...Array.from(new Set(loginCandidates)).map((candidate) => ({
          phone: candidate,
        })),
      ],
    },
  });

  ensure(user, 401, "Неверный логин или пароль");
  ensure(!user.isBlocked, 403, "Доступ запрещен");
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  ensure(isValidPassword, 401, "Неверный логин или пароль");
  ensure(!input.expectedUserId || input.expectedUserId === user.id, 409, "Для сохранения открытой формы войдите в тот же аккаунт.");

  return {
    message: "Успешно",
    token: createToken(user),
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  };
}


export async function requestPasswordReset(input: { email?: string }) {
  const email = input.email?.trim().toLowerCase();
  ensure(email, 400, "Некорректный запрос");

  const user = await lmsRepository.prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true, email: true },
  });
  ensure(user, 404, "Ресурс не найден");

  await lmsRepository.prisma.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
      OR: [{ usedAt: { not: null } }, { expiresAt: { lte: new Date() } }],
    },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await lmsRepository.prisma.passwordResetToken.create({
    data: {
      id: makeEntityId("prt"),
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetLink = buildResetPasswordLink(rawToken);
  await sendResetPasswordEmail({
    to: user.email,
    fullName: user.fullName,
    resetLink,
  });

  return {
    message: "Вам на почту выслана ссылка для сброса пароля",
  };
}


export async function resetPasswordByToken(input: {
  token?: string;
  password?: string;
  confirmPassword?: string;
}) {
  const password = input.password?.trim();
  const confirmPassword = input.confirmPassword?.trim();

  ensure(password, 400, "Некорректный запрос");
  ensure(password.length >= 6, 400, "Операция недоступна");
  ensure(password === confirmPassword, 400, "Некорректный запрос");

  const resetToken = await getPasswordResetTokenOrThrow(input.token);

  const hashedPassword = await bcrypt.hash(password, 12);
  await lmsRepository.prisma.$transaction([
    lmsRepository.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: hashedPassword },
    }),
    lmsRepository.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    lmsRepository.prisma.notification.create({
      data: {
        id: await lmsRepository.nextNotificationId(),
        type: NotificationType.system_message,
        title: "Сброс пароля выполнен",
        body: `Сброс пароля выполнен: ${resetToken.user.fullName} (${resetToken.user.email})`,
        targetRole: NotificationTargetRole.admin,
        userId: null,
      },
    }),
  ]);

  return { message: "Успешно" };
}


export async function validateResetPasswordToken(input: { token?: string }) {
  const resetToken = await getPasswordResetTokenOrThrow(input.token);

  ensure(!resetToken.openedAt, 400, "Некорректный запрос");

  const updateResult = await lmsRepository.prisma.passwordResetToken.updateMany(
    {
      where: {
        id: resetToken.id,
        openedAt: null,
      },
      data: {
        openedAt: new Date(),
      },
    },
  );

  ensure(updateResult.count === 1, 400, "Некорректный запрос");

  return { valid: true };
}


export async function me(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  return {
    user: {
      id: currentUser.id,
      fullName: currentUser.fullName,
      email: currentUser.email,
      phone: currentUser.phone,
      role: currentUser.role,
    },
  };
}

