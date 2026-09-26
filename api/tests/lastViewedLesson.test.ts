import { beforeEach, describe, expect, it, jest } from "@jest/globals";
jest.mock("../src/repositories/lmsRepository", () => ({ lmsRepository: { prisma: {
  user: { findUnique: jest.fn() }, enrollment: { findUnique: jest.fn(), update: jest.fn() },
} } }));
import { lmsRepository } from "../src/repositories/lmsRepository";
import { studentViewLesson } from "../src/services/studentService";

describe("last viewed lesson", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(lmsRepository.prisma.user.findUnique).mockResolvedValue({ id: "student", role: "student" } as never);
    jest.mocked(lmsRepository.prisma.enrollment.findUnique).mockResolvedValue({
      id: "enrollment", course: { isPublished: true, progress: 0, modules: [
        { type: "lesson", id: "visible" }, { type: "lesson", id: "hidden", isVisibleToStudents: false },
      ] },
    } as never);
  });
  it("records a visible lesson without marking it completed", async () => {
    await expect(studentViewLesson("student", "course", "visible")).resolves.toEqual({ saved: true });
    expect(lmsRepository.prisma.enrollment.update).toHaveBeenCalledWith({ where: { id: "enrollment" }, data: { lastViewedLessonId: "visible", lastViewedAt: expect.any(Date) } });
  });
  it("rejects hidden lessons and missing enrollment without writing", async () => {
    await expect(studentViewLesson("student", "course", "hidden")).rejects.toMatchObject({ status: 404 });
    jest.mocked(lmsRepository.prisma.enrollment.findUnique).mockResolvedValue(null);
    await expect(studentViewLesson("student", "course", "visible")).rejects.toMatchObject({ status: 403 });
    expect(lmsRepository.prisma.enrollment.update).not.toHaveBeenCalled();
  });
});
