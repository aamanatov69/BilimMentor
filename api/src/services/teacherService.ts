import { UserRole, CourseLevel, AccessRequestStatus, NotificationTargetRole, NotificationType, Prisma } from "@prisma/client";
import { lmsRepository } from "../repositories/lmsRepository";
import { ensure } from "../utils/httpError";
import { createCourseInviteToken, verifyCourseInviteToken } from "../utils/jwt";
import { sendMessage } from "./messageService";
import {
  isCourseLevel,
  isAccessRequestStatus,
  userPublic,
  readModules,
  makeEntityId,
  asModuleRecordArray,
  findLessonIndex,
  asString,
  isRecord,
  requireCurrentUser,
  notifyStudentsAboutPublishedCourse,
  notifyStudentsAboutCompletedCourse,
  notifyStudentsAboutNewAssignment,
  nextAssignmentId,
  nextGradeId,
  MAX_LESSON_MATERIAL_FILE_SIZE_BYTES,
  normalizeLessonMaterialFile,
  parseStoredSubmissionContent,
} from "./shared/serviceHelpers";

export async function teacherListCourseAccessRequests(
  userId: string | undefined,
  status?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const normalizedStatus =
    typeof status === "string" && isAccessRequestStatus(status)
      ? status
      : undefined;

  const requests = await lmsRepository.prisma.accessRequest.findMany({
    where: {
      teacherId: currentUser.id,
      status: normalizedStatus,
    },
    include: {
      course: true,
      student: {
        select: { id: true, fullName: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    requests: requests.map((item) => ({
      ...item,
      course: { ...item.course, modules: readModules(item.course.modules) },
      student: userPublic(item.student),
    })),
  };
}


export async function teacherCourseDetails(
  userId: string | undefined,
  courseId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      },
      assignments: {
        include: {
          submissions: {
            include: {
              student: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
              grade: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = readModules(course.modules);

  const materials = modules
    .filter(
      (item) =>
        isRecord(item) && asString(item.type).toLowerCase() === "material",
    )
    .map((item, index) => {
      const record = item as Record<string, unknown>;
      const name = asString(record.name) || `Действие выполнено`;
      return {
        id: `m-${course.id}-${index + 1}`,
        title: name,
        type: record.url ? "LINK" : "FILE",
        uploadedAt:
          asString(record.createdAt) || course.createdAt.toISOString(),
        url: asString(record.url) || null,
      };
    });

  const students = course.enrollments.map((item) => ({
    id: item.student.id,
    fullName: item.student.fullName,
    email: item.student.email,
    phone: item.student.phone,
    approvedAt: item.approvedAt,
  }));

  const assignments = course.assignments.map((item) => ({
    id: item.id,
    title: item.title,
    lessonId: item.lessonId,
    dueAt: item.dueAt,
    submissions: item.submissions.length,
  }));

  const submissions = course.assignments.flatMap((assignment) =>
    assignment.submissions.map((submission) => ({
      id: submission.id,
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      studentId: submission.studentId,
      studentName: submission.student.fullName,
      submittedAt: submission.submittedAt,
      score: submission.grade?.score ?? null,
      feedback: submission.grade?.feedback ?? null,
      status: submission.grade != null ? "Enabled" : "Disabled",
    })),
  );

  return {
    course: {
      id: course.id,
      title: course.title,
      category: course.category,
      description: course.description,
      level: course.level,
      isPublished: course.isPublished,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      teacherId: course.teacherId,
      modules,
    },
    students,
    materials,
    assignments,
    submissions,
  };
}


export async function teacherReviewCourseAccessRequest(
  userId: string | undefined,
  requestId: string,
  status?: AccessRequestStatus,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const accessRequest = await lmsRepository.prisma.accessRequest.findUnique({
    where: { id: requestId },
  });
  ensure(accessRequest, 404, "Ресурс не найден");
  ensure(
    accessRequest.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );
  ensure(
    accessRequest.status === AccessRequestStatus.pending,
    409,
    "Операция недоступна",
  );

  ensure(
    status === AccessRequestStatus.approved ||
      status === AccessRequestStatus.rejected,
    400,
    "Операция недоступна",
  );

  const [requestCourse, requestStudent] = await Promise.all([
    lmsRepository.prisma.course.findUnique({
      where: { id: accessRequest.courseId },
      select: { title: true },
    }),
    lmsRepository.prisma.user.findUnique({
      where: { id: accessRequest.studentId },
      select: { id: true, fullName: true },
    }),
  ]);
  ensure(requestCourse && requestStudent, 404, "Операция недоступна");

  const reviewedAt = new Date();

  const updatedRequest = await lmsRepository.prisma.$transaction(async (tx) => {
    const updated = await tx.accessRequest.update({
      where: { id: accessRequest.id },
      data: { status, reviewedAt },
    });

    if (status === AccessRequestStatus.approved) {
      const existingEnrollment = await tx.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId: accessRequest.courseId,
            studentId: accessRequest.studentId,
          },
        },
      });

      if (!existingEnrollment) {
        await tx.enrollment.create({
          data: {
            id: await lmsRepository.nextEnrollmentId(),
            courseId: accessRequest.courseId,
            studentId: accessRequest.studentId,
            approvedByTeacherId: currentUser.id,
            approvedAt: reviewedAt,
          },
        });
      }
    }

    await tx.notification.create({
      data: {
        id: await lmsRepository.nextNotificationId(),
        type: NotificationType.system_message,
        title:
          status === AccessRequestStatus.approved
            ? "Заявка одобрена"
            : "Заявка отклонена",
        body:
          status === AccessRequestStatus.approved
            ? `Доступ к курсу "${requestCourse.title}" одобрен преподавателем.`
            : `Заявка на курс "${requestCourse.title}" отклонена преподавателем.`,
        targetRole: NotificationTargetRole.student,
        userId: requestStudent.id,
      },
    });

    return updated;
  });

  return { request: updatedRequest };
}


export async function teacherCourses(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(
    currentUser.role === UserRole.teacher ||
      currentUser.role === UserRole.admin,
    403,
    "Операция недоступна",
  );

  const courses = await lmsRepository.prisma.course.findMany({
    where:
      currentUser.role === UserRole.admin
        ? undefined
        : { teacherId: currentUser.id },
    include: {
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    courses: courses.map((item) => ({
      ...item,
      modules: readModules(item.modules),
      studentsCount: item._count.enrollments,
    })),
  };
}


export async function teacherCreateCourseShareInvite(
  userId: string | undefined,
  courseId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, teacherId: true },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const inviteToken = createCourseInviteToken({
    courseId: course.id,
    teacherId: currentUser.id,
  });
  const verifiedInvite = verifyCourseInviteToken(inviteToken);

  return {
    message: "Успешно",
    course: {
      id: course.id,
      title: course.title,
    },
    inviteToken,
    expiresAt: verifiedInvite?.expiresAt ?? null,
  };
}


export async function teacherCreateCourse(
  userId: string | undefined,
  input: {
    title?: string;
    name?: string;
    category?: string;
    description?: string;
    level?: unknown;
    publishNow?: unknown;
    initialLessons?: unknown;
  },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const normalizedTitle = (input.title ?? input.name ?? "").trim();
  const normalizedDescription = (input.description ?? "").trim();
  const normalizedCategory = (input.category ?? "General").trim() || "General";
  const normalizedLevel =
    typeof input.level === "string"
      ? input.level.trim().toLowerCase()
      : CourseLevel.beginner;

  ensure(normalizedTitle, 400, "Некорректный запрос");
  ensure(normalizedDescription, 400, "Некорректный запрос");
  ensure(isCourseLevel(normalizedLevel), 400, "Операция недоступна");

  const publishNow = input.publishNow === true;
  const initialLessonsRaw = Array.isArray(input.initialLessons)
    ? input.initialLessons
    : [];

  const initialLessons = initialLessonsRaw
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const title = asString(item.title).trim();
      if (!title) {
        return null;
      }

      return {
        title,
        description: asString(item.description).trim() || null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item, index, array) => {
      const normalized = item.title.toLowerCase();
      return (
        array.findIndex(
          (candidate) => candidate.title.toLowerCase() === normalized,
        ) === index
      );
    })
    .slice(0, 25);

  const initialLessonModules = initialLessons.map((lesson) => ({
    id: makeEntityId("lesson"),
    type: "lesson",
    title: lesson.title,
    description: lesson.description,
    isVisibleToStudents: false,
    createdAt: new Date().toISOString(),
    materials: [] as Record<string, unknown>[],
  }));

  const created = await lmsRepository.prisma.course.create({
    data: {
      id: await lmsRepository.nextCourseId(),
      title: normalizedTitle,
      category: normalizedCategory,
      description: normalizedDescription,
      level: normalizedLevel,
      isPublished: publishNow,
      progress: 0,
      modules: initialLessonModules as Prisma.InputJsonValue,
      teacherId: currentUser.id,
    },
  });

  const lessonCount = initialLessonModules.length;

  return {
    message: publishNow ? `Действие выполнено.` : `Действие выполнено.`,
    course: {
      ...created,
      modules: readModules(created.modules),
    },
  };
}


export async function teacherSetCourseVisibility(
  userId: string | undefined,
  courseId: string,
  isPublished?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");
  ensure(typeof isPublished === "boolean", 400, "Некорректный запрос");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { isPublished },
  });

  if (isPublished && !course.isPublished) {
    await notifyStudentsAboutPublishedCourse({
      courseId: updated.id,
      courseTitle: updated.title,
    });
  }

  return {
    message: isPublished ? "Enabled" : "Disabled",
    course: {
      ...updated,
      modules: readModules(updated.modules),
    },
  };
}


export async function teacherCompleteCourse(
  userId: string | undefined,
  courseId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");
  ensure(course.isPublished, 409, "Курс уже завершен");

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: {
      isPublished: false,
      progress: Math.max(course.progress, 100),
    },
  });

  await notifyStudentsAboutCompletedCourse({
    courseId: updated.id,
    courseTitle: updated.title,
  });

  return {
    message: "Курс завершен",
    course: {
      ...updated,
      modules: readModules(updated.modules),
    },
  };
}


export async function teacherUpdateCourse(
  userId: string | undefined,
  courseId: string,
  input: {
    title?: string;
    category?: string;
    description?: string;
    level?: unknown;
  },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  if (typeof input.title === "string") {
    ensure(input.title.trim(), 400, "Некорректный запрос");
  }
  if (typeof input.description === "string") {
    ensure(input.description.trim(), 400, "Некорректный запрос");
  }
  if (typeof input.category === "string") {
    ensure(input.category.trim(), 400, "Некорректный запрос");
  }

  const normalizedLevel =
    typeof input.level === "string"
      ? input.level.trim().toLowerCase()
      : undefined;
  if (typeof normalizedLevel !== "undefined") {
    ensure(isCourseLevel(normalizedLevel), 400, "Операция недоступна");
  }

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: {
      title: typeof input.title === "string" ? input.title.trim() : undefined,
      category:
        typeof input.category === "string" ? input.category.trim() : undefined,
      description:
        typeof input.description === "string"
          ? input.description.trim()
          : undefined,
      level:
        typeof normalizedLevel === "string" && isCourseLevel(normalizedLevel)
          ? normalizedLevel
          : undefined,
    },
  });

  return {
    message: "Успешно",
    course: { ...updated, modules: readModules(updated.modules) },
  };
}


export async function teacherDeleteCourse(
  userId: string | undefined,
  courseId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  await lmsRepository.prisma.course.delete({ where: { id: courseId } });

  return {
    message: "Успешно",
    course: { ...course, modules: readModules(course.modules) },
  };
}


export async function teacherCreateAssignment(
  userId: string | undefined,
  courseId: string,
  input: {
    title?: string;
    description?: string;
    dueAt?: string;
    lessonId?: string;
  },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const normalizedTitle = (input.title ?? "").trim();
  const normalizedLessonId = (input.lessonId ?? "").trim();
  ensure(normalizedTitle, 400, "Некорректный запрос");
  ensure(normalizedLessonId, 400, "Некорректный запрос");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, normalizedLessonId);
  ensure(lessonIndex >= 0, 400, "Некорректный запрос");

  const parsedDueAt = input.dueAt ? new Date(input.dueAt) : undefined;
  if (parsedDueAt) {
    ensure(!Number.isNaN(parsedDueAt.getTime()), 400, "Операция недоступна");
  }

  const assignment = await lmsRepository.prisma.assignment.create({
    data: {
      id: await nextAssignmentId(),
      title: normalizedTitle,
      description: (input.description ?? "").trim() || null,
      dueAt: parsedDueAt,
      courseId,
      lessonId: normalizedLessonId,
    },
  });

  const lessonVisibleToStudents =
    modules[lessonIndex]?.isVisibleToStudents !== false;
  if (course.isPublished && lessonVisibleToStudents) {
    await notifyStudentsAboutNewAssignment({
      courseId: course.id,
      courseTitle: course.title,
      assignmentTitle: assignment.title,
      dueAt: parsedDueAt,
    });
  }

  return { message: "Успешно", assignment };
}


export async function teacherUpdateAssignmentDeadline(
  userId: string | undefined,
  assignmentId: string,
  dueAt?: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const assignment = await lmsRepository.prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  ensure(assignment, 404, "Ресурс не найден");
  ensure(
    assignment.course.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );
  ensure(dueAt && dueAt.trim(), 400, "Некорректный запрос");

  const parsedDueAt = new Date(dueAt);
  ensure(!Number.isNaN(parsedDueAt.getTime()), 400, "Операция недоступна");

  const updated = await lmsRepository.prisma.assignment.update({
    where: { id: assignmentId },
    data: { dueAt: parsedDueAt },
  });

  return { message: "Успешно", assignment: updated };
}


export async function teacherUpdateAssignment(
  userId: string | undefined,
  assignmentId: string,
  input: {
    title?: string;
    description?: string;
    dueAt?: string | null;
    lessonId?: string;
  },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const assignment = await lmsRepository.prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  ensure(assignment, 404, "Ресурс не найден");
  ensure(
    assignment.course.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );

  const hasTitle = typeof input.title === "string";
  const hasDescription = typeof input.description === "string";
  const hasDueAt = typeof input.dueAt === "string" || input.dueAt === null;
  const hasLessonId = typeof input.lessonId === "string";

  ensure(
    hasTitle || hasDescription || hasDueAt || hasLessonId,
    400,
    "Некорректный запрос",
  );

  if (hasTitle) {
    ensure(input.title?.trim(), 400, "Некорректный запрос");
  }

  let nextLessonId: string | null | undefined;
  if (hasLessonId) {
    const normalizedLessonId = input.lessonId?.trim() ?? "";
    ensure(normalizedLessonId, 400, "Некорректный запрос");

    const modules = asModuleRecordArray(assignment.course.modules);
    const lessonIndex = findLessonIndex(modules, normalizedLessonId);
    ensure(lessonIndex >= 0, 400, "Некорректный запрос");
    nextLessonId = normalizedLessonId;
  }

  let parsedDueAt: Date | null | undefined;
  if (hasDueAt) {
    const dueAtRaw = typeof input.dueAt === "string" ? input.dueAt.trim() : "";
    if (!dueAtRaw) {
      parsedDueAt = null;
    } else {
      const dueAtValue = new Date(dueAtRaw);
      ensure(!Number.isNaN(dueAtValue.getTime()), 400, "Операция недоступна");
      parsedDueAt = dueAtValue;
    }
  }

  const updated = await lmsRepository.prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      title: hasTitle ? input.title?.trim() : undefined,
      description: hasDescription
        ? input.description?.trim() || null
        : undefined,
      dueAt: hasDueAt ? parsedDueAt : undefined,
      lessonId: hasLessonId ? nextLessonId : undefined,
    },
  });

  return { message: "Успешно", assignment: updated };
}


export async function teacherDeleteAssignment(
  userId: string | undefined,
  assignmentId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const assignment = await lmsRepository.prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: { select: { teacherId: true } } },
  });
  ensure(assignment, 404, "Ресурс не найден");
  ensure(
    assignment.course.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );

  await lmsRepository.prisma.assignment.delete({
    where: { id: assignmentId },
  });

  return { message: "Успешно", assignment };
}


export async function teacherUploadMaterial(
  userId: string | undefined,
  courseId: string,
  input: { name?: string; url?: string },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const materialName = (input.name ?? "").trim();
  ensure(materialName, 400, "Некорректный запрос");

  const modules = readModules(course.modules);
  const nextModules = [
    ...modules,
    {
      type: "material",
      name: materialName,
      url: (input.url ?? "").trim() || null,
      createdAt: new Date().toISOString(),
    },
  ];

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules },
  });

  return {
    message: "Успешно",
    course: { ...updated, modules: readModules(updated.modules) },
  };
}


export async function teacherCreateLesson(
  userId: string | undefined,
  courseId: string,
  input: { title?: string; description?: string },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const title = (input.title ?? "").trim();
  ensure(title, 400, "Некорректный запрос");

  const modules = asModuleRecordArray(course.modules);
  const duplicateExists = modules.some((item) => {
    const type = asString(item.type).toLowerCase();
    if (type !== "lesson") return false;
    return asString(item.title).trim().toLowerCase() === title.toLowerCase();
  });
  ensure(!duplicateExists, 409, "Конфликт данных");

  const lesson = {
    id: makeEntityId("lesson"),
    type: "lesson",
    title,
    description:
      (input.description ?? "").trim().length > 0
        ? (input.description ?? "")
        : null,
    isVisibleToStudents: false,
    createdAt: new Date().toISOString(),
    materials: [] as Record<string, unknown>[],
  };

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: {
      modules: [...modules, lesson] as Prisma.InputJsonValue,
    },
  });

  return {
    message: "Успешно",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}


export async function teacherUpdateLesson(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  input: { title?: string; description?: string },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const normalizedTitle = (input.title ?? "").trim();
  ensure(normalizedTitle, 400, "Некорректный запрос");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const duplicateExists = modules.some((item, index) => {
    if (index === lessonIndex) return false;
    const type = asString(item.type).toLowerCase();
    if (type !== "lesson") return false;
    return (
      asString(item.title).trim().toLowerCase() ===
      normalizedTitle.toLowerCase()
    );
  });
  ensure(!duplicateExists, 409, "Конфликт данных");

  const lesson = {
    ...modules[lessonIndex],
    title: normalizedTitle,
    description:
      (input.description ?? "").trim().length > 0
        ? (input.description ?? "")
        : null,
    updatedAt: new Date().toISOString(),
  };

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}


export async function teacherDeleteLesson(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const deletedLesson = modules[lessonIndex];
  const nextModules = modules.filter((item) => asString(item.id) !== lessonId);

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson: deletedLesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}


export async function teacherReorderLessons(
  userId: string | undefined,
  courseId: string,
  lessonIds?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  ensure(Array.isArray(lessonIds), 400, "Некорректный запрос");

  const normalizedLessonIds = lessonIds
    .map((item) => asString(item).trim())
    .filter((item) => item.length > 0);

  const modules = asModuleRecordArray(course.modules);
  const lessonModules = modules.filter(
    (item) => asString(item.type).toLowerCase() === "lesson",
  );
  const nonLessonModules = modules.filter(
    (item) => asString(item.type).toLowerCase() !== "lesson",
  );

  ensure(
    normalizedLessonIds.length === lessonModules.length,
    400,
    "Некорректный запрос",
  );

  const lessonById = new Map(
    lessonModules.map((item) => [asString(item.id).trim(), item]),
  );

  const uniqueLessonIds = new Set(normalizedLessonIds);
  ensure(
    uniqueLessonIds.size === normalizedLessonIds.length,
    400,
    "Конфликт данных",
  );

  const reorderedLessons = normalizedLessonIds.map((lessonId) => {
    const lesson = lessonById.get(lessonId);
    ensure(lesson, 400, "Некорректный запрос");
    return lesson;
  });

  const nextModules = [...reorderedLessons, ...nonLessonModules].map(
    (item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
    }),
  );

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    course: { ...updated, modules: readModules(updated.modules) },
  };
}


export async function teacherAddLessonMaterial(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  input: {
    type?: string;
    title?: string;
    text?: string;
    url?: string;
    table?: string;
    formula?: string;
    code?: string;
    file?: unknown;
  },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const lesson = { ...modules[lessonIndex] };
  const materialType = (input.type ?? "material").trim().toLowerCase();
  const title = (input.title ?? "").trim();
  const rawText = input.text ?? "";
  const text = rawText.trim();
  const url = (input.url ?? "").trim();
  const table = (input.table ?? "").trim();
  const formula = (input.formula ?? "").trim();
  const code = (input.code ?? "").trim();
  const file = normalizeLessonMaterialFile(input.file);
  const hasFile = file !== null;

  ensure(title, 400, "Некорректный запрос");
  ensure(
    text || url || table || formula || code || hasFile,
    400,
    "Операция недоступна",
  );

  if (file) {
    ensure(
      file.size > 0 && file.size <= MAX_LESSON_MATERIAL_FILE_SIZE_BYTES,
      400,
      `Действие выполнено`,
    );
  }

  const currentMaterials = Array.isArray(lesson.materials)
    ? lesson.materials.filter((item): item is Record<string, unknown> =>
        isRecord(item),
      )
    : [];

  const material = {
    id: makeEntityId("mat"),
    type: materialType,
    title,
    text: text ? rawText : null,
    url: url || null,
    table: table || null,
    formula: formula || null,
    code: code || null,
    file,
    createdAt: new Date().toISOString(),
  };

  lesson.materials = [...currentMaterials, material];

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson,
    material,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}


export async function teacherDeleteLessonMaterial(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  materialId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const normalizedMaterialId = materialId.trim();
  ensure(normalizedMaterialId, 400, "Некорректный запрос");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const lesson = { ...modules[lessonIndex] };
  const currentMaterials = Array.isArray(lesson.materials)
    ? lesson.materials.filter((item): item is Record<string, unknown> =>
        isRecord(item),
      )
    : [];

  const nextMaterials = currentMaterials.filter(
    (item) => asString(item.id) !== normalizedMaterialId,
  );
  ensure(
    nextMaterials.length !== currentMaterials.length,
    404,
    "Ресурс не найден",
  );

  lesson.materials = nextMaterials;
  lesson.updatedAt = new Date().toISOString();

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}


export async function teacherSetLessonVisibility(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  isVisibleToStudents?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");
  ensure(typeof isVisibleToStudents === "boolean", 400, "Операция недоступна");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const lesson = {
    ...modules[lessonIndex],
    isVisibleToStudents,
    updatedAt: new Date().toISOString(),
  };

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: isVisibleToStudents ? "Enabled" : "Disabled",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}


export async function teacherMessageStudent(
  userId: string | undefined,
  courseId: string,
  studentId: string,
  message?: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const [course, student] = await Promise.all([
    lmsRepository.prisma.course.findUnique({ where: { id: courseId } }),
    lmsRepository.prisma.user.findUnique({ where: { id: studentId } }),
  ]);

  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");
  ensure(
    student && student.role === UserRole.student,
    404,
    "Операция недоступна",
  );

  return sendMessage(currentUser.id, { toUserId: studentId, message });
}


export async function teacherCommentSubmission(
  userId: string | undefined,
  submissionId: string,
  comment?: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const normalizedComment = (comment ?? "").trim();
  ensure(normalizedComment, 400, "Некорректный запрос");

  const submission = await lmsRepository.prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: { include: { course: true } },
      grade: true,
    },
  });
  ensure(submission, 404, "Ресурс не найден");
  ensure(
    submission.assignment.course.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );

  const grade = submission.grade
    ? await lmsRepository.prisma.grade.update({
        where: { submissionId: submission.id },
        data: { feedback: normalizedComment, gradedById: currentUser.id },
      })
    : await lmsRepository.prisma.grade.create({
        data: {
          id: await nextGradeId(),
          submissionId: submission.id,
          gradedById: currentUser.id,
          feedback: normalizedComment,
          score: null,
        },
      });

  return { message: "Успешно", grade };
}


export async function teacherGradeSubmission(
  userId: string | undefined,
  submissionId: string,
  score?: unknown,
  feedback?: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");
  ensure(
    typeof score === "number" || (typeof score === "string" && score.trim() !== ""),
    400,
    "Укажите оценку от 0 до 100",
  );

  const scoreValue = Number(score);
  ensure(Number.isFinite(scoreValue), 400, "Некорректный запрос");
  ensure(scoreValue >= 0 && scoreValue <= 100, 400, "Операция недоступна");

  const submission = await lmsRepository.prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: { include: { course: true } },
      grade: true,
    },
  });
  ensure(submission, 404, "Ресурс не найден");
  ensure(
    submission.assignment.course.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );

  const normalizedFeedback = (feedback ?? "").trim() || null;

  const grade = submission.grade
    ? await lmsRepository.prisma.grade.update({
        where: { submissionId: submission.id },
        data: {
          score: scoreValue,
          feedback: normalizedFeedback,
          gradedById: currentUser.id,
        },
      })
    : await lmsRepository.prisma.grade.create({
        data: {
          id: await nextGradeId(),
          submissionId: submission.id,
          gradedById: currentUser.id,
          score: scoreValue,
          feedback: normalizedFeedback,
        },
      });

  await lmsRepository.prisma.notification.create({
    data: {
      id: await lmsRepository.nextNotificationId(),
      type: NotificationType.grade_posted,
      title: "Оценка опубликована",
      body: `По заданию "${submission.assignment.title}" в курсе "${submission.assignment.course.title}" выставлена оценка: ${scoreValue}.`,
      targetRole: NotificationTargetRole.student,
      userId: submission.studentId,
    },
  });

  return { message: "Успешно", grade };
}


export async function teacherGradesOverview(userId: string | undefined) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const submissions = await lmsRepository.prisma.submission.findMany({
    where: {
      assignment: {
        course: {
          teacherId: currentUser.id,
        },
      },
    },
    include: {
      student: {
        select: { id: true, fullName: true, email: true, role: true },
      },
      assignment: {
        include: {
          course: {
            select: { id: true, title: true },
          },
        },
      },
      grade: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  return {
    rows: submissions.map((item) => {
      const payload = parseStoredSubmissionContent(item.content);

      return {
        submissionId: item.id,
        studentId: item.studentId,
        studentName: item.student.fullName,
        studentEmail: item.student.email,
        assignmentId: item.assignmentId,
        assignmentTitle: item.assignment.title,
        courseId: item.assignment.course.id,
        courseTitle: item.assignment.course.title,
        score: item.grade?.score ?? null,
        feedback: item.grade?.feedback ?? null,
        submittedAt: item.submittedAt,
        answerText: payload.text,
        answerFormula: payload.formula,
        answerCode: payload.code,
        answerAttachments: payload.attachments.map((attachment) => ({
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          dataBase64: attachment.dataBase64,
        })),
      };
    }),
  };
}


export async function teacherDashboardOverview(userId: string | undefined) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const courses = await lmsRepository.prisma.course.findMany({
    where: { teacherId: currentUser.id },
    select: {
      id: true,
      title: true,
      category: true,
      progress: true,
      isPublished: true,
      createdAt: true,
      modules: true,
      updatedAt: true,
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const courseIds = courses.map((item) => item.id);

  const [pendingRequests, studentsEnrolled, assignmentsToGrade] =
    await Promise.all([
      lmsRepository.prisma.accessRequest.count({
        where: {
          teacherId: currentUser.id,
          status: AccessRequestStatus.pending,
        },
      }),
      lmsRepository.prisma.enrollment.count({
        where: {
          courseId: { in: courseIds.length ? courseIds : ["__none__"] },
        },
      }),
      lmsRepository.prisma.submission.count({
        where: {
          assignment: {
            course: {
              teacherId: currentUser.id,
            },
          },
          OR: [{ grade: null }, { grade: { is: { score: null } } }],
        },
      }),
    ]);

  return {
    summary: {
      courses: courses.length,
      assignmentsToGrade,
      studentsEnrolled,
      pendingRequests,
    },
    courses: courses.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      progress: item.progress,
      isPublished: item.isPublished,
      createdAt: item.createdAt.toISOString(),
      modules: item.modules,
      studentsCount: item._count.enrollments,
    })),
  };
}

