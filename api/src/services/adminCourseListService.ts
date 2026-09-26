import type { Prisma } from "@prisma/client";
import { lmsRepository } from "../repositories/lmsRepository";
import { ensure } from "../utils/httpError";

export async function listAdminCourses(query: Record<string, unknown>) {
  const integer = (value: unknown, fallback: number, maximum: number) => {
    if (value === undefined) return fallback;
    ensure(typeof value === "string" && /^\d+$/.test(value), 400, "Некорректная пагинация");
    const parsed = Number(value);
    ensure(Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum, 400, "Некорректная пагинация");
    return parsed;
  };
  const page = integer(query.page, 1, 1_000_000);
  const pageSize = integer(query.pageSize, 20, 100);
  const status = query.status ?? "all";
  const sort = query.sort ?? "newest";
  ensure(typeof status === "string" && ["all", "published", "hidden"].includes(status), 400, "Некорректный статус");
  ensure(typeof sort === "string" && ["newest", "oldest", "title"].includes(sort), 400, "Некорректная сортировка");
  ensure(query.q === undefined || (typeof query.q === "string" && query.q.length <= 200), 400, "Некорректный поиск");
  ensure(query.teacher === undefined || (typeof query.teacher === "string" && query.teacher.length <= 64), 400, "Некорректный преподаватель");
  const where: Prisma.CourseWhereInput = {
    ...(query.q ? { title: { contains: String(query.q).trim(), mode: "insensitive" } } : {}),
    ...(query.teacher ? { teacherId: String(query.teacher) } : {}),
    ...(status !== "all" ? { isPublished: status === "published" } : {}),
  };
  const db = lmsRepository.prisma;
  const [total, totalCourses, published, enrollments, teachers] = await Promise.all([
    db.course.count({ where }),
    db.course.count(),
    db.course.count({ where: { isPublished: true } }),
    db.enrollment.count(),
    db.user.findMany({ where: { role: "teacher" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const orderBy: Prisma.CourseOrderByWithRelationInput[] = sort === "title"
    ? [{ title: "asc" }, { id: "asc" }]
    : [{ createdAt: sort === "oldest" ? "asc" : "desc" }, { id: "asc" }];
  const courses = await db.course.findMany({
    where, orderBy, skip: (currentPage - 1) * pageSize, take: pageSize,
    select: {
      id: true, title: true, teacherId: true, isPublished: true, createdAt: true,
      teacher: { select: { fullName: true } },
      _count: { select: { enrollments: true } },
    },
  });
  return {
    courses: courses.map(({ _count, teacher, ...course }) => ({ ...course, students: _count.enrollments, teacherName: teacher.fullName })),
    teachers,
    pagination: { page: currentPage, pageSize, total, totalPages },
    summary: { courses: totalCourses, published, enrollments },
  };
}
