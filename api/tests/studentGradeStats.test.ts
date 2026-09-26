import { describe, expect, it, jest } from "@jest/globals";

jest.mock("../src/repositories/lmsRepository", () => ({
  lmsRepository: { prisma: {
    user: { findUnique: jest.fn() },
    submission: { findMany: jest.fn() },
  } },
}));
import { lmsRepository } from "../src/repositories/lmsRepository";
import { studentGradesOverview } from "../src/services/studentService";

describe("student grade statistics", () => {
  it("excludes comment-only grades from averages and counts but retains zero grades", async () => {
    const date = new Date("2026-01-01T00:00:00Z");
    jest.mocked(lmsRepository.prisma.user.findUnique).mockResolvedValue({ id: "student", role: "student" } as never);
    jest.mocked(lmsRepository.prisma.submission.findMany).mockResolvedValue(
      [null, 0, 80].map((score, index) => ({
        id: `submission-${index}`, assignmentId: `assignment-${index}`, submittedAt: date,
        grade: { score, feedback: "Feedback", createdAt: date },
        assignment: { title: "Assignment", course: { id: "course", title: "Course", teacher: { fullName: "Teacher" } } },
      })) as never,
    );
    const result = await studentGradesOverview("student");
    expect(result.summary).toMatchObject({ assignmentsSubmitted: 3, assignmentsGraded: 2, averageScore: 40, bestScore: 80, worstScore: 0 });
    expect(result.courseStats[0]).toMatchObject({ assignmentsGraded: 2, averageScore: 40, minScore: 0, maxScore: 80 });
    expect(result.assignmentGrades[0]).toMatchObject({ score: null, feedback: "Feedback" });
  });
});
