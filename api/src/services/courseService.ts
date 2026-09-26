import { UserRole, CourseLevel } from "@prisma/client";
import { lmsRepository } from "../repositories/lmsRepository";
import { ensure } from "../utils/httpError";
import {
  readModules,
  getStudentLessonProgress,
  coursePreview,
  requireCurrentUser,
} from "./shared/serviceHelpers";

export async function listCourses(userId?: string) {
  const currentUser = await requireCurrentUser(userId);

  if (currentUser.role === UserRole.admin) {
    const courses = await lmsRepository.prisma.course.findMany({
      orderBy: { createdAt: "desc" },
    });
    return {
      courses: courses.map((item) => ({
        ...item,
        modules: readModules(item.modules),
      })),
    };
  }

  if (currentUser.role === UserRole.teacher) {
    const courses = await lmsRepository.prisma.course.findMany({
      where: { teacherId: currentUser.id },
      orderBy: { createdAt: "desc" },
    });
    return {
      courses: courses.map((item) => ({
        ...item,
        modules: readModules(item.modules),
      })),
    };
  }

  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: { studentId: currentUser.id },
    select: { courseId: true },
  });

  const courses = await lmsRepository.prisma.course.findMany({
    where: {
      id: { in: enrollments.map((item) => item.courseId) },
      OR: [{ isPublished: true }, { progress: { gte: 100 } }],
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    courses: courses.map((item) => ({
      ...item,
      modules: readModules(item.modules),
    })),
  };
}


export async function getCourseById(courseId: string, userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");

  if (currentUser.role === UserRole.admin) {
    return { course: { ...course, modules: readModules(course.modules) } };
  }

  if (currentUser.role === UserRole.teacher) {
    ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");
    return { course: { ...course, modules: readModules(course.modules) } };
  }

  const enrollment = await lmsRepository.prisma.enrollment.findUnique({
    where: {
      courseId_studentId: {
        courseId,
        studentId: currentUser.id,
      },
    },
    select: { id: true, lastViewedLessonId: true },
  });

  ensure(enrollment, 403, "Доступ запрещен");
  ensure(course.isPublished || course.progress >= 100, 403, "Доступ запрещен");

  const studentProgress = await getStudentLessonProgress({
    courseId: course.id,
    studentId: currentUser.id,
    modules: course.modules,
  });

  return {
    course: {
      ...course,
      modules: readModules(course.modules),
      progress: studentProgress.progressPercent,
      studentProgress,
      lastViewedLessonId: enrollment.lastViewedLessonId,
    },
  };
}


export async function createCourseLegacy(input: {
  name?: string;
  description?: string;
  teacher_id?: string;
}) {
  const { name, description, teacher_id } = input;
  ensure(name && description && teacher_id, 400, "Операция недоступна");

  const teacher = await lmsRepository.prisma.user.findFirst({
    where: { id: teacher_id, role: UserRole.teacher },
    select: { id: true },
  });
  ensure(teacher, 404, "Ресурс не найден");

  const createdCourse = await lmsRepository.prisma.course.create({
    data: {
      id: await lmsRepository.nextCourseId(),
      title: name,
      category: "General",
      description,
      level: CourseLevel.beginner,
      progress: 0,
      modules: [],
      teacherId: teacher.id,
    },
  });

  return {
    course: { ...createdCourse, modules: readModules(createdCourse.modules) },
    teacher_id: teacher.id,
  };
}


export async function discoverStudentCourses(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: { studentId: currentUser.id },
    select: { courseId: true },
  });
  const enrolledIds = enrollments.map((item) => item.courseId);

  const courses = await lmsRepository.prisma.course.findMany({
    where: {
      id: { notIn: enrolledIds.length > 0 ? enrolledIds : [""] },
      isPublished: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { courses: courses.map((item) => coursePreview(item)) };
}


export async function listPublicCourses() {
  const courses = await lmsRepository.prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
  });

  return { courses: courses.map((item) => coursePreview(item)) };
}


export async function getPublicStats() {
  const [students, teachers, publishedCourses, gradeAggregate] =
    await Promise.all([
      lmsRepository.prisma.user.count({ where: { role: UserRole.student } }),
      lmsRepository.prisma.user.count({ where: { role: UserRole.teacher } }),
      lmsRepository.prisma.course.count({ where: { isPublished: true } }),
      lmsRepository.prisma.grade.aggregate({
        _avg: { score: true },
      }),
    ]);

  const averageScore =
    typeof gradeAggregate._avg.score === "undefined" ||
    gradeAggregate._avg.score === null
      ? null
      : Number(gradeAggregate._avg.score);

  const satisfiedStudentsPercent =
    averageScore === null
      ? null
      : Math.max(0, Math.min(100, Math.round(averageScore)));

  return {
    students,
    courses: publishedCourses,
    teachers,
    satisfiedStudentsPercent,
  };
}

