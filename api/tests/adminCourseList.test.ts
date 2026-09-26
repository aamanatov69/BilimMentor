import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const db = {
  course: { count: jest.fn<any>(), findMany: jest.fn<any>() },
  user: { findMany: jest.fn<any>() },
  enrollment: { count: jest.fn<any>() },
};
jest.mock("../src/repositories/lmsRepository", () => ({ lmsRepository: { prisma: db } }));
import { listAdminCourses } from "../src/services/adminCourseListService";

beforeEach(() => {
  jest.resetAllMocks();
  db.course.count.mockResolvedValue(45);
  db.course.findMany.mockResolvedValue([{ id: "c1", title: "Math", teacher: { fullName: "Teacher" }, _count: { enrollments: 3 } }]);
  db.user.findMany.mockResolvedValue([]);
  db.enrollment.count.mockResolvedValue(100);
});

describe("admin course pagination", () => {
  it("applies filters, stable sorting and database pagination", async () => {
    const result = await listAdminCourses({ page: "2", q: " Math ", status: "published", teacher: "u2", sort: "title" });
    expect(db.course.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20, take: 20,
      where: { title: { contains: "Math", mode: "insensitive" }, teacherId: "u2", isPublished: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
    }));
    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 45, totalPages: 3 });
    expect(result.courses[0]).toEqual({ id: "c1", title: "Math", teacherName: "Teacher", students: 3 });
    const options = db.course.findMany.mock.calls[0][0];
    expect(options.select.modules).toBeUndefined();
  });

  it("clamps pages after deleting the final item and handles an empty list", async () => {
    db.course.count.mockResolvedValue(0);
    db.course.findMany.mockResolvedValue([]);
    const result = await listAdminCourses({ page: "99" });
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
    expect(db.course.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  it("rejects invalid or excessive pagination and filters before querying", async () => {
    for (const query of [{ page: "0" }, { page: "1.5" }, { pageSize: "101" }, { sort: "unknown" }, { status: "invalid" }, { q: ["x"] }]) {
      await expect(listAdminCourses(query)).rejects.toMatchObject({ status: 400 });
    }
    expect(db.course.findMany).not.toHaveBeenCalled();
  });
});
