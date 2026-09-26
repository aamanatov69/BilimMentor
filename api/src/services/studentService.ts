import { UserRole, AccessRequestStatus, NotificationTargetRole, NotificationType } from "@prisma/client";
import { lmsRepository } from "../repositories/lmsRepository";
import { ensure } from "../utils/httpError";
import {
  readModules,
  StudentLessonProgressSummary,
  makeEntityId,
  readVisibleLessonIds,
  getStudentLessonProgress,
  isAssignmentVisibleToStudents,
  readLessonTitleById,
  asString,
  sanitizeStudentFacingText,
  requireCurrentUser,
  nextSubmissionId,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_TOTAL_ATTACHMENTS_SIZE_BYTES,
  parseStoredSubmissionContent,
  normalizeSubmissionInput,
  sanitizeSubmissionForResponse,
} from "./shared/serviceHelpers";

export async function studentRequestCourseAccess(
  userId: string | undefined,
  input: { courseId?: string },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");
  ensure(input.courseId, 400, "Некорректный запрос");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: input.courseId },
  });
  ensure(course, 404, "Ресурс не найден");

  const alreadyEnrolled = await lmsRepository.prisma.enrollment.findUnique({
    where: {
      courseId_studentId: {
        courseId: input.courseId,
        studentId: currentUser.id,
      },
    },
    select: { id: true },
  });
  ensure(!alreadyEnrolled, 409, "Конфликт данных");

  const pendingRequest = await lmsRepository.prisma.accessRequest.findFirst({
    where: {
      courseId: input.courseId,
      studentId: currentUser.id,
      status: AccessRequestStatus.pending,
    },
    select: { id: true },
  });
  ensure(!pendingRequest, 409, "Конфликт данных");

  const request = await lmsRepository.prisma.accessRequest.create({
    data: {
      id: await lmsRepository.nextAccessRequestId(),
      courseId: input.courseId,
      studentId: currentUser.id,
      teacherId: course.teacherId,
      status: AccessRequestStatus.pending,
    },
  });

  await lmsRepository.prisma.notification.create({
    data: {
      id: await lmsRepository.nextNotificationId(),
      type: NotificationType.system_message,
      title: "Новая заявка на доступ к курсу",
      body: `Студент ${currentUser.fullName} запросил доступ к курсу "${course.title}".`,
      targetRole: NotificationTargetRole.teacher,
      userId: course.teacherId,
    },
  });

  return { request };
}


export async function studentListCourseAccessRequests(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const requests = await lmsRepository.prisma.accessRequest.findMany({
    where: { studentId: currentUser.id },
    include: { course: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    requests: requests.map((item) => ({
      ...item,
      course: { ...item.course, modules: readModules(item.course.modules) },
    })),
  };
}


export async function studentDashboardOverview(userId: string | undefined) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: {
      studentId: currentUser.id,
      course: {
        OR: [{ isPublished: true }, { progress: { gte: 100 } }],
      },
    },
    include: {
      course: {
        include: {
          teacher: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const courseIds = enrollments.map((item) => item.courseId);

  const progressByCourseId = new Map<string, StudentLessonProgressSummary>();
  await Promise.all(
    enrollments.map(async (item) => {
      const progress = await getStudentLessonProgress({
        courseId: item.course.id,
        studentId: currentUser.id,
        modules: item.course.modules,
      });
      progressByCourseId.set(item.course.id, progress);
    }),
  );

  const assignments = await lmsRepository.prisma.assignment.findMany({
    where: {
      courseId: { in: courseIds.length ? courseIds : ["__none__"] },
      course: { isPublished: true },
    },
    include: {
      course: {
        select: { id: true, title: true, modules: true },
      },
      submissions: {
        where: { studentId: currentUser.id },
        include: { grade: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const visibleAssignments = assignments.filter((item) =>
    isAssignmentVisibleToStudents(item.course.modules, item.lessonId),
  );

  const targetRole = NotificationTargetRole.student;
  const notifications = await lmsRepository.prisma.notification.findMany({
    where: {
      OR: [{ userId: null }, { userId: currentUser.id }],
      AND: [
        { OR: [{ targetRole: NotificationTargetRole.all }, { targetRole }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const now = new Date();
  const soonDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const assignmentItems = visibleAssignments.map((item) => {
    const ownSubmission = item.submissions[0];
    const dueAt = item.dueAt;
    const dueSoon =
      !!dueAt &&
      dueAt.getTime() >= now.getTime() &&
      dueAt.getTime() <= soonDate.getTime() &&
      !ownSubmission;

    return {
      id: item.id,
      title: item.title,
      course: item.course.title,
      dueDate: dueAt ? dueAt.toISOString() : null,
      status: ownSubmission ? "Enabled" : "Disabled",
      dueSoon,
    };
  });

  const grades = visibleAssignments
    .flatMap((item) =>
      item.submissions
        .filter((submission) => submission.grade?.score != null)
        .map((submission) => ({
          id: submission.id,
          assignment: sanitizeStudentFacingText(item.title),
          course: item.course.title,
          grade: submission.grade
            ? Number(submission.grade.score)
            : null,
          comment: submission.grade?.feedback ?? null,
          createdAt: submission.submittedAt.toISOString(),
        })),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const gpa =
    grades.length > 0
      ? Number(
          (
            grades.reduce((acc, item) => acc + (item.grade ?? 0), 0) /
            grades.length /
            25
          ).toFixed(2),
        )
      : 0;

  return {
    summary: {
      courses: enrollments.length,
      assignments: assignmentItems.length,
      dueSoon: assignmentItems.some((item) => item.dueSoon),
      gpa,
    },
    currentCourses: enrollments.map((item) => {
      const lessonProgress = progressByCourseId.get(item.course.id);
      const lastLessonId = item.lastViewedLessonId && readVisibleLessonIds(item.course.modules).includes(item.lastViewedLessonId)
        ? item.lastViewedLessonId : null;
      const nextLessonId = readVisibleLessonIds(item.course.modules)
        .find((id) => !lessonProgress?.completedLessonIds.includes(id));
      const calculatedProgress =
        progressByCourseId.get(item.course.id)?.progressPercent ?? 0;
      const completedByTeacher =
        !item.course.isPublished && item.course.progress >= 100;
      const isCompleted = completedByTeacher || calculatedProgress >= 100;

      return {
        progress: calculatedProgress,
        id: item.course.id,
        name: item.course.title,
        teacher: item.course.teacher.fullName,
        status: isCompleted ? "Enabled" : "Disabled",
        completedByTeacher,
        completedLessons: lessonProgress?.completedLessons ?? 0,
        totalLessons: lessonProgress?.totalLessons ?? 0,
        lastViewedAt: lastLessonId ? item.lastViewedAt?.toISOString() ?? null : null,
        lastViewedLesson: lastLessonId ? { id: lastLessonId, title: readLessonTitleById(item.course.modules, lastLessonId) ?? "Урок" } : null,
        nextLesson: !isCompleted && nextLessonId ? { id: nextLessonId, title: readLessonTitleById(item.course.modules, nextLessonId) ?? "Урок" } : null,
      };
    }),
    assignments: assignmentItems,
    recentGrades: grades.slice(0, 5),
    announcements: notifications.map((item) => ({
      id: item.id,
      title: item.title,
      text: item.body,
      date: item.createdAt.toISOString(),
    })),
  };
}


export async function studentViewLesson(userId: string | undefined, courseId: string, lessonId: string) {
  const user = await requireCurrentUser(userId);
  ensure(user.role === UserRole.student, 403, "Доступ запрещён");
  const enrollment = await lmsRepository.prisma.enrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId: user.id } },
    include: { course: true },
  });
  ensure(enrollment, 403, "Нет доступа к курсу");
  ensure(enrollment.course.isPublished || enrollment.course.progress >= 100, 403, "Курс недоступен");
  ensure(readVisibleLessonIds(enrollment.course.modules).includes(lessonId), 404, "Урок не найден или скрыт");
  await lmsRepository.prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { lastViewedLessonId: lessonId, lastViewedAt: new Date() },
  });
  return { saved: true };
}

export async function studentCourses(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: {
      studentId: currentUser.id,
      course: {
        OR: [{ isPublished: true }, { progress: { gte: 100 } }],
      },
    },
    include: { course: true },
    orderBy: { createdAt: "desc" },
  });

  const courses = await Promise.all(
    enrollments.map(async (item) => {
      const studentProgress = await getStudentLessonProgress({
        courseId: item.course.id,
        studentId: currentUser.id,
        modules: item.course.modules,
      });

      return {
        ...item.course,
        modules: readModules(item.course.modules),
        progress: studentProgress.progressPercent,
        completedByTeacher:
          !item.course.isPublished && item.course.progress >= 100,
        studentProgress,
      };
    }),
  );

  return { courses };
}


export async function studentSetLessonCompletion(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  completed?: boolean,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const normalizedCourseId = asString(courseId).trim();
  const normalizedLessonId = asString(lessonId).trim();
  ensure(normalizedCourseId, 400, "Некорректный запрос");
  ensure(normalizedLessonId, 400, "Некорректный запрос");

  const enrollment = await lmsRepository.prisma.enrollment.findUnique({
    where: {
      courseId_studentId: {
        courseId: normalizedCourseId,
        studentId: currentUser.id,
      },
    },
    select: { id: true },
  });
  ensure(enrollment, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: normalizedCourseId },
    select: { id: true, modules: true, isPublished: true, progress: true },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(
    course.isPublished,
    403,
    course.progress >= 100
      ? "Курс завершен. Доступен только просмотр."
      : "Доступ запрещен",
  );

  const visibleLessonIds = readVisibleLessonIds(course.modules);
  ensure(
    visibleLessonIds.includes(normalizedLessonId),
    404,
    "Операция недоступна",
  );

  const shouldMarkCompleted = completed !== false;
  if (shouldMarkCompleted) {
    await lmsRepository.prisma.studentLessonProgress.upsert({
      where: {
        courseId_studentId_lessonId: {
          courseId: normalizedCourseId,
          studentId: currentUser.id,
          lessonId: normalizedLessonId,
        },
      },
      create: {
        id: makeEntityId("slp"),
        courseId: normalizedCourseId,
        studentId: currentUser.id,
        lessonId: normalizedLessonId,
        completedAt: new Date(),
      },
      update: {
        completedAt: new Date(),
      },
    });
  } else {
    await lmsRepository.prisma.studentLessonProgress.deleteMany({
      where: {
        courseId: normalizedCourseId,
        studentId: currentUser.id,
        lessonId: normalizedLessonId,
      },
    });
  }

  const studentProgress = await getStudentLessonProgress({
    courseId: normalizedCourseId,
    studentId: currentUser.id,
    modules: course.modules,
  });

  return {
    message: shouldMarkCompleted ? "Enabled" : "Disabled",
    studentProgress,
  };
}


export async function studentAssignments(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const assignments = await lmsRepository.prisma.assignment.findMany({
    where: {
      course: {
        OR: [{ isPublished: true }, { progress: { gte: 100 } }],
        enrollments: {
          some: { studentId: currentUser.id },
        },
      },
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          modules: true,
          isPublished: true,
          progress: true,
          teacherId: true,
          teacher: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      submissions: {
        where: { studentId: currentUser.id },
        include: { grade: true },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const visibleAssignments = assignments.filter((item) =>
    isAssignmentVisibleToStudents(item.course.modules, item.lessonId),
  );

  return {
    assignments: visibleAssignments.map((item) => {
      const ownSubmission = item.submissions[0] ?? null;
      const parsedSubmission = ownSubmission
        ? parseStoredSubmissionContent(ownSubmission.content)
        : null;

      return {
        id: item.id,
        title: sanitizeStudentFacingText(item.title),
        description: item.description,
        lessonId: item.lessonId,
        lessonTitle: readLessonTitleById(item.course.modules, item.lessonId),
        dueAt: item.dueAt?.toISOString() ?? null,
        course: {
          id: item.course.id,
          title: item.course.title,
          teacher: item.course.teacher.fullName,
          completedByTeacher:
            !item.course.isPublished && item.course.progress >= 100,
        },
        submission: ownSubmission
          ? {
              id: ownSubmission.id,
              ...sanitizeSubmissionForResponse(
                parsedSubmission ?? {
                  text: "",
                  formula: "",
                  code: "",
                  attachments: [],
                },
              ),
              submittedAt: ownSubmission.submittedAt.toISOString(),
              grade: ownSubmission.grade?.score != null
                ? Number(ownSubmission.grade.score)
                : null,
              feedback: ownSubmission.grade?.feedback ?? null,
            }
          : null,
      };
    }),
  };
}


export async function studentSubmitAssignment(
  userId: string | undefined,
  assignmentId: string,
  input?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const assignment = await lmsRepository.prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: {
        include: {
          teacher: {
            select: { id: true, fullName: true },
          },
        },
      },
    },
  });

  ensure(assignment, 404, "Ресурс не найден");

  const enrollment = await lmsRepository.prisma.enrollment.findUnique({
    where: {
      courseId_studentId: {
        courseId: assignment.courseId,
        studentId: currentUser.id,
      },
    },
    select: { id: true },
  });
  ensure(enrollment, 403, "Доступ запрещен");
  ensure(
    assignment.course.isPublished,
    403,
    assignment.course.progress >= 100
      ? "Курс завершен. Доступен только просмотр."
      : "Курс скрыт преподавателем. Отправка работ недоступна.",
  );
  ensure(
    isAssignmentVisibleToStudents(
      assignment.course.modules,
      assignment.lessonId,
    ),
    403,
    "Задание скрыто преподавателем. Отправка работы недоступна.",
  );
  ensure(
    !assignment.dueAt || new Date() <= assignment.dueAt,
    403,
    "Срок сдачи задания прошёл.",
  );

  const existingSubmission = await lmsRepository.prisma.submission.findFirst({
    where: {
      assignmentId,
      studentId: currentUser.id,
    },
    orderBy: { submittedAt: "desc" },
  });

  const fallbackPayload = existingSubmission
    ? parseStoredSubmissionContent(existingSubmission.content)
    : { text: "", formula: "", code: "", attachments: [] };
  const submissionPayload = normalizeSubmissionInput(input, fallbackPayload);

  ensure(
    submissionPayload.text ||
      submissionPayload.formula ||
      submissionPayload.code ||
      submissionPayload.attachments.length > 0,
    400,
    "Добавьте текст ответа или вложение",
  );

  let totalAttachmentsSize = 0;
  for (const attachment of submissionPayload.attachments) {
    ensure(
      attachment.size > 0 && attachment.size <= MAX_ATTACHMENT_SIZE_BYTES,
      400,
      "Размер каждого вложения должен быть больше нуля и не превышать 8 МБ",
    );
    totalAttachmentsSize += attachment.size;
  }
  ensure(
    totalAttachmentsSize <= MAX_TOTAL_ATTACHMENTS_SIZE_BYTES,
    400,
    "Общий размер вложений не должен превышать 20 МБ",
  );

  const serializedSubmissionContent = JSON.stringify(submissionPayload);

  const submittedAt = new Date();
  const submission = existingSubmission
    ? await lmsRepository.prisma.submission.update({
        where: { id: existingSubmission.id },
        data: {
          content: serializedSubmissionContent,
          submittedAt,
        },
      })
    : await lmsRepository.prisma.submission.create({
        data: {
          id: await nextSubmissionId(),
          assignmentId,
          studentId: currentUser.id,
          content: serializedSubmissionContent,
          submittedAt,
        },
      });

  await lmsRepository.prisma.notification.create({
    data: {
      id: await lmsRepository.nextNotificationId(),
      type: NotificationType.system_message,
      title: "Новая сдача задания",
      body: `Студент ${currentUser.fullName} отправил решение по заданию "${assignment.title}" в курсе "${assignment.course.title}".`,
      targetRole: NotificationTargetRole.teacher,
      userId: assignment.course.teacherId,
    },
  });

  return {
    message: "Успешно",
    submission: {
      id: submission.id,
      submittedAt: submission.submittedAt.toISOString(),
      ...sanitizeSubmissionForResponse(submissionPayload),
    },
  };
}


export async function studentGradesOverview(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const submissions = await lmsRepository.prisma.submission.findMany({
    where: { studentId: currentUser.id },
    include: {
      assignment: {
        include: {
          course: {
            include: {
              teacher: {
                select: { id: true, fullName: true },
              },
            },
          },
        },
      },
      grade: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  const assignmentGrades = submissions
    .filter((item) => item.grade != null)
    .map((item) => ({
      submissionId: item.id,
      assignmentId: item.assignmentId,
      assignmentTitle: sanitizeStudentFacingText(item.assignment.title),
      courseId: item.assignment.course.id,
      courseTitle: item.assignment.course.title,
      teacherName: item.assignment.course.teacher.fullName,
      score: item.grade?.score != null ? Number(item.grade.score) : null,
      feedback: item.grade?.feedback ?? null,
      submittedAt: item.submittedAt.toISOString(),
      gradedAt: item.grade?.createdAt.toISOString() ?? null,
    }));

  const courseStatsMap = new Map<
    string,
    {
      courseId: string;
      courseTitle: string;
      teacherName: string;
      assignmentsSubmitted: number;
      assignmentsGraded: number;
      totalScore: number;
      maxScore: number;
      minScore: number;
    }
  >();

  for (const submission of submissions) {
    const courseId = submission.assignment.course.id;
    const current = courseStatsMap.get(courseId) ?? {
      courseId,
      courseTitle: submission.assignment.course.title,
      teacherName: submission.assignment.course.teacher.fullName,
      assignmentsSubmitted: 0,
      assignmentsGraded: 0,
      totalScore: 0,
      maxScore: 0,
      minScore: 100,
    };

    current.assignmentsSubmitted += 1;

    if (submission.grade?.score != null) {
      const score = Number(submission.grade.score);
      current.assignmentsGraded += 1;
      current.totalScore += score;
      current.maxScore = Math.max(current.maxScore, score);
      current.minScore = Math.min(current.minScore, score);
    }

    courseStatsMap.set(courseId, current);
  }

  const courseStats = Array.from(courseStatsMap.values()).map((item) => ({
    courseId: item.courseId,
    courseTitle: item.courseTitle,
    teacherName: item.teacherName,
    assignmentsSubmitted: item.assignmentsSubmitted,
    assignmentsGraded: item.assignmentsGraded,
    averageScore:
      item.assignmentsGraded > 0
        ? Number((item.totalScore / item.assignmentsGraded).toFixed(2))
        : null,
    maxScore: item.assignmentsGraded > 0 ? item.maxScore : null,
    minScore: item.assignmentsGraded > 0 ? item.minScore : null,
  }));

  const gradedScores = assignmentGrades
    .map((item) => item.score)
    .filter((item): item is number => item !== null);

  return {
    summary: {
      assignmentsSubmitted: submissions.length,
      assignmentsGraded: gradedScores.length,
      averageScore:
        gradedScores.length > 0
          ? Number(
              (
                gradedScores.reduce((acc, value) => acc + value, 0) /
                gradedScores.length
              ).toFixed(2),
            )
          : null,
      bestScore: gradedScores.length > 0 ? Math.max(...gradedScores) : null,
      worstScore: gradedScores.length > 0 ? Math.min(...gradedScores) : null,
    },
    courseStats,
    assignmentGrades,
  };
}
