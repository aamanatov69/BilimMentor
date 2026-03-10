/// <reference types="jest" />

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import bcrypt from "bcryptjs";
import request from "supertest";

interface TestUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: "student" | "teacher" | "admin";
  createdAt: Date;
}

interface TestCourse {
  id: string;
  title: string;
  category: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  isPublished: boolean;
  progress: number;
  modules: unknown[];
  teacherId: string;
  createdAt: Date;
}

interface TestAccessRequest {
  id: string;
  courseId: string;
  studentId: string;
  teacherId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  reviewedAt?: Date | null;
}

interface TestEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  approvedByTeacherId: string;
  approvedAt: Date;
  createdAt: Date;
}

interface TestMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: Date;
}

interface TestNotification {
  id: string;
  type:
    | "assignment_deadline"
    | "grade_posted"
    | "new_announcement"
    | "system_message";
  title: string;
  body: string;
  targetRole: "student" | "teacher" | "admin" | "all";
  userId?: string | null;
  createdAt: Date;
}

const db = {
  users: [] as TestUser[],
  courses: [] as TestCourse[],
  accessRequests: [] as TestAccessRequest[],
  enrollments: [] as TestEnrollment[],
  messages: [] as TestMessage[],
  notifications: [] as TestNotification[],
  assignments: [] as Array<{ id: string; title: string; courseId: string }>,
};

function hasOwn(obj: unknown, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function applySelect<T extends object>(
  row: T,
  select?: Record<string, boolean>,
) {
  if (!select) {
    return row;
  }

  const picked: Record<string, unknown> = {};
  Object.keys(select).forEach((key) => {
    if (select[key] && hasOwn(row, key)) {
      picked[key] = (row as Record<string, unknown>)[key];
    }
  });
  return picked;
}

function matchesUserWhere(
  user: TestUser,
  where: Record<string, unknown>,
): boolean {
  if (hasOwn(where, "OR") && Array.isArray(where.OR)) {
    const conditions = where.OR as Array<Record<string, unknown>>;
    return conditions.some((condition) => matchesUserWhere(user, condition));
  }

  if (hasOwn(where, "id") && where.id !== user.id) {
    return false;
  }

  if (hasOwn(where, "email") && where.email !== user.email) {
    return false;
  }

  if (hasOwn(where, "phone") && where.phone !== user.phone) {
    return false;
  }

  if (hasOwn(where, "role") && where.role !== user.role) {
    return false;
  }

  if (
    hasOwn(where, "id") &&
    typeof where.id === "object" &&
    where.id !== null
  ) {
    const notId = (where.id as { not?: string }).not;
    if (notId && user.id === notId) {
      return false;
    }
  }

  return true;
}

function resetDb() {
  const baseDate = new Date("2026-03-06T10:00:00.000Z");
  const passwordHash = bcrypt.hashSync("password123", 4);

  db.users = [
    {
      id: "u1",
      fullName: "Demo Student",
      email: "student@bilimmentor.local",
      phone: "+79990000001",
      passwordHash,
      role: "student",
      createdAt: new Date(baseDate),
    },
    {
      id: "u2",
      fullName: "Demo Teacher",
      email: "teacher@bilimmentor.local",
      phone: "+79990000002",
      passwordHash,
      role: "teacher",
      createdAt: new Date(baseDate),
    },
    {
      id: "u3",
      fullName: "Demo Admin",
      email: "admin@bilimmentor.local",
      phone: "+79990000003",
      passwordHash,
      role: "admin",
      createdAt: new Date(baseDate),
    },
  ];

  db.courses = [
    {
      id: "c1",
      title: "Node.js Fundamentals",
      category: "Backend",
      description: "текст Node.js",
      level: "beginner",
      isPublished: true,
      progress: 45,
      modules: [],
      teacherId: "u2",
      createdAt: new Date(baseDate),
    },
  ];

  db.accessRequests = [];
  db.enrollments = [];
  db.messages = [
    {
      id: "msg1",
      fromUserId: "u1",
      toUserId: "u2",
      text: "текст",
      createdAt: new Date(baseDate),
    },
  ];
  db.notifications = [];
  db.assignments = [];
}

const prismaMock: any = {
  user: {
    count: jest.fn(async () => db.users.length),
    findUnique: jest.fn(async ({ where, select }: any) => {
      const row = db.users.find((user) => user.id === where.id) ?? null;
      return row ? applySelect(row, select) : null;
    }),
    findFirst: jest.fn(async ({ where, select }: any) => {
      if (!where) {
        const first = db.users[0] ?? null;
        return first ? applySelect(first, select) : null;
      }

      const row =
        db.users.find((user) => matchesUserWhere(user, where)) ?? null;
      return row ? applySelect(row, select) : null;
    }),
    findMany: jest.fn(async ({ where, select, orderBy }: any = {}) => {
      let rows = [...db.users];
      if (where?.id?.not) {
        rows = rows.filter((user) => user.id !== where.id.not);
      }
      if (where?.role) {
        rows = rows.filter((user) => user.role === where.role);
      }
      if (orderBy?.createdAt === "desc") {
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      if (orderBy?.fullName === "asc") {
        rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
      }
      return rows.map((row) => applySelect(row, select));
    }),
    create: jest.fn(async ({ data, select }: any) => {
      const row: TestUser = {
        ...data,
        createdAt: new Date(),
      };
      db.users.push(row);
      return applySelect(row, select);
    }),
    update: jest.fn(async ({ where, data, select }: any) => {
      const index = db.users.findIndex((user) => user.id === where.id);
      if (index === -1) {
        throw new Error("user not found");
      }
      db.users[index] = {
        ...db.users[index],
        ...Object.fromEntries(
          Object.entries(data).filter(
            ([, value]) => typeof value !== "undefined",
          ),
        ),
      };
      return applySelect(db.users[index], select);
    }),
    delete: jest.fn(async ({ where }: any) => {
      const index = db.users.findIndex((user) => user.id === where.id);
      if (index === -1) {
        throw new Error("user not found");
      }
      const [deleted] = db.users.splice(index, 1);
      return deleted;
    }),
    createMany: jest.fn(async ({ data }: any) => {
      data.forEach((row: TestUser) => db.users.push(row));
      return { count: data.length };
    }),
  },
  course: {
    count: jest.fn(async () => db.courses.length),
    findUnique: jest.fn(async ({ where, select }: any) => {
      const row = db.courses.find((course) => course.id === where.id) ?? null;
      return row ? applySelect(row, select) : null;
    }),
    findMany: jest.fn(async ({ where, select, orderBy }: any = {}) => {
      let rows = [...db.courses];

      if (where?.teacherId) {
        rows = rows.filter((course) => course.teacherId === where.teacherId);
      }

      if (where?.id?.in) {
        rows = rows.filter((course) => where.id.in.includes(course.id));
      }

      if (where?.id?.notIn) {
        rows = rows.filter((course) => !where.id.notIn.includes(course.id));
      }

      if (orderBy?.createdAt === "desc") {
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }

      return rows.map((row) => applySelect(row, select));
    }),
    create: jest.fn(async ({ data }: any) => {
      const row: TestCourse = {
        ...data,
        createdAt: new Date(),
      };
      db.courses.push(row);
      return row;
    }),
    delete: jest.fn(async ({ where }: any) => {
      const index = db.courses.findIndex((course) => course.id === where.id);
      if (index === -1) {
        throw new Error("course not found");
      }
      const [deleted] = db.courses.splice(index, 1);
      return deleted;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const index = db.courses.findIndex((course) => course.id === where.id);
      if (index === -1) {
        throw new Error("course not found");
      }
      db.courses[index] = {
        ...db.courses[index],
        ...Object.fromEntries(
          Object.entries(data).filter(
            ([, value]) => typeof value !== "undefined",
          ),
        ),
      };
      return db.courses[index];
    }),
    createMany: jest.fn(async ({ data }: any) => {
      data.forEach((row: TestCourse) =>
        db.courses.push({ ...row, createdAt: new Date() }),
      );
      return { count: data.length };
    }),
  },
  enrollment: {
    count: jest.fn(async () => db.enrollments.length),
    findUnique: jest.fn(async ({ where, select }: any) => {
      const key = where.courseId_studentId;
      const row =
        db.enrollments.find(
          (item) =>
            item.courseId === key.courseId && item.studentId === key.studentId,
        ) ?? null;
      return row ? applySelect(row, select) : null;
    }),
    findMany: jest.fn(async ({ where, include }: any = {}) => {
      let rows = [...db.enrollments];
      if (where?.studentId) {
        rows = rows.filter((item) => item.studentId === where.studentId);
      }
      if (include?.course) {
        return rows.map((row) => ({
          ...row,
          course: db.courses.find((course) => course.id === row.courseId),
        }));
      }
      return rows;
    }),
    create: jest.fn(async ({ data }: any) => {
      const row: TestEnrollment = {
        ...data,
        createdAt: new Date(),
      };
      db.enrollments.push(row);
      return row;
    }),
  },
  accessRequest: {
    count: jest.fn(async ({ where }: any = {}) => {
      if (!where?.status) {
        return db.accessRequests.length;
      }
      return db.accessRequests.filter((item) => item.status === where.status)
        .length;
    }),
    findFirst: jest.fn(async ({ where, select }: any) => {
      const row =
        db.accessRequests.find(
          (item) =>
            (typeof where.courseId === "undefined" ||
              item.courseId === where.courseId) &&
            (typeof where.studentId === "undefined" ||
              item.studentId === where.studentId) &&
            (typeof where.status === "undefined" ||
              item.status === where.status),
        ) ?? null;
      return row ? applySelect(row, select) : null;
    }),
    findUnique: jest.fn(async ({ where }: any) => {
      return db.accessRequests.find((item) => item.id === where.id) ?? null;
    }),
    findMany: jest.fn(async ({ where, include }: any = {}) => {
      let rows = [...db.accessRequests];
      if (where?.teacherId) {
        rows = rows.filter((item) => item.teacherId === where.teacherId);
      }
      if (where?.studentId) {
        rows = rows.filter((item) => item.studentId === where.studentId);
      }
      if (where?.status) {
        rows = rows.filter((item) => item.status === where.status);
      }

      return rows.map((row) => ({
        ...row,
        course: include?.course
          ? db.courses.find((course) => course.id === row.courseId)
          : undefined,
        student: include?.student
          ? db.users.find((user) => user.id === row.studentId)
          : undefined,
      }));
    }),
    create: jest.fn(async ({ data }: any) => {
      const row: TestAccessRequest = {
        ...data,
        createdAt: new Date(),
      };
      db.accessRequests.push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const index = db.accessRequests.findIndex((item) => item.id === where.id);
      if (index === -1) {
        throw new Error("access request not found");
      }
      db.accessRequests[index] = {
        ...db.accessRequests[index],
        ...Object.fromEntries(
          Object.entries(data).filter(
            ([, value]) => typeof value !== "undefined",
          ),
        ),
      };
      return db.accessRequests[index];
    }),
  },
  notification: {
    findMany: jest.fn(async () => [...db.notifications]),
    create: jest.fn(async ({ data }: any) => {
      const row: TestNotification = {
        ...data,
        createdAt: new Date(),
      };
      db.notifications.push(row);
      return row;
    }),
    createMany: jest.fn(async ({ data }: any) => {
      data.forEach((row: TestNotification) =>
        db.notifications.push({
          ...row,
          createdAt: row.createdAt ?? new Date(),
        }),
      );
      return { count: data.length };
    }),
  },
  message: {
    findMany: jest.fn(async ({ where, include }: any = {}) => {
      let rows = [...db.messages];
      if (where?.OR) {
        rows = rows.filter(
          (item) =>
            item.fromUserId === where.OR[0].fromUserId ||
            item.toUserId === where.OR[1].toUserId,
        );
      }

      return rows.map((row) => ({
        ...row,
        fromUser: include?.fromUser
          ? db.users.find((user) => user.id === row.fromUserId)
          : undefined,
        toUser: include?.toUser
          ? db.users.find((user) => user.id === row.toUserId)
          : undefined,
      }));
    }),
    create: jest.fn(async ({ data }: any) => {
      const row: TestMessage = {
        ...data,
        createdAt: new Date(),
      };
      db.messages.push(row);
      return row;
    }),
    createMany: jest.fn(async ({ data }: any) => {
      data.forEach((row: TestMessage) =>
        db.messages.push({ ...row, createdAt: row.createdAt ?? new Date() }),
      );
      return { count: data.length };
    }),
  },
  assignment: {
    findMany: jest.fn(async () => [...db.assignments]),
    createMany: jest.fn(async ({ data }: any) => {
      db.assignments.push(...data);
      return { count: data.length };
    }),
  },
  $transaction: jest.fn(async (callback: (client: any) => Promise<unknown>) =>
    callback(prismaMock),
  ),
};

jest.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("API integration tests", () => {
  function authCookieFrom(response: { headers: { [key: string]: unknown } }) {
    const setCookieHeader = response.headers["set-cookie"];
    if (!Array.isArray(setCookieHeader) || setCookieHeader.length === 0) {
      return "";
    }
    const raw = String(setCookieHeader[0]);
    return raw.split(";")[0];
  }

  beforeEach(() => {
    resetDb();
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("registers, logs in and validates token", async () => {
      const { app } = require("../src/server");

      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          fullName: "New Student",
          email: "new.student@bilimmentor.local",
          phone: "+79990001234",
          password: "password123",
          role: "student",
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.user.email).toBe(
        "new.student@bilimmentor.local",
      );
      const registerCookie = authCookieFrom(registerResponse);
      expect(registerCookie).toContain("bilimMentorToken=");

      const loginResponse = await request(app).post("/api/auth/login").send({
        identifier: "new.student@bilimmentor.local",
        password: "password123",
      });

      expect(loginResponse.status).toBe(200);
      const loginCookie = authCookieFrom(loginResponse);
      expect(loginCookie).toContain("bilimMentorToken=");

      const meResponse = await request(app)
        .get("/api/me")
        .set("Cookie", loginCookie);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user.email).toBe("new.student@bilimmentor.local");
    });
  });

  describe("Course flow", () => {
    it("student requests course, teacher approves, student gets course access", async () => {
      const { app } = require("../src/server");

      const studentLogin = await request(app).post("/api/auth/login").send({
        identifier: "student@bilimmentor.local",
        password: "password123",
      });
      const teacherLogin = await request(app).post("/api/auth/login").send({
        identifier: "teacher@bilimmentor.local",
        password: "password123",
      });

      const studentCookie = authCookieFrom(studentLogin);
      const teacherCookie = authCookieFrom(teacherLogin);
      expect(studentCookie).toContain("bilimMentorToken=");
      expect(teacherCookie).toContain("bilimMentorToken=");

      const requestResponse = await request(app)
        .post("/api/student/course-access-requests")
        .set("Cookie", studentCookie)
        .send({ courseId: "c1" });

      expect(requestResponse.status).toBe(201);
      expect(requestResponse.body.request.status).toBe("pending");

      const teacherRequests = await request(app)
        .get("/api/teacher/course-access-requests?status=pending")
        .set("Cookie", teacherCookie);

      expect(teacherRequests.status).toBe(200);
      expect(teacherRequests.body.requests).toHaveLength(1);

      const approval = await request(app)
        .patch(
          `/api/teacher/course-access-requests/${requestResponse.body.request.id}`,
        )
        .set("Cookie", teacherCookie)
        .send({ status: "approved" });

      expect(approval.status).toBe(200);
      expect(approval.body.request.status).toBe("approved");

      const accessibleCourse = await request(app)
        .get("/api/courses/c1")
        .set("Cookie", studentCookie);

      expect(accessibleCourse.status).toBe(200);
      expect(accessibleCourse.body.course.id).toBe("c1");
    });
  });

  describe("Messaging", () => {
    it("student sends message and teacher receives it", async () => {
      const { app } = require("../src/server");

      const studentLogin = await request(app).post("/api/auth/login").send({
        identifier: "student@bilimmentor.local",
        password: "password123",
      });
      const teacherLogin = await request(app).post("/api/auth/login").send({
        identifier: "teacher@bilimmentor.local",
        password: "password123",
      });

      const studentCookie = authCookieFrom(studentLogin);
      const teacherCookie = authCookieFrom(teacherLogin);
      expect(studentCookie).toContain("bilimMentorToken=");
      expect(teacherCookie).toContain("bilimMentorToken=");

      const sendResponse = await request(app)
        .post("/api/messages")
        .set("Cookie", studentCookie)
        .send({
          toUserId: "u2",
          message: "текст текст текст текст",
        });

      expect(sendResponse.status).toBe(201);
      expect(sendResponse.body.message.text).toBe("текст текст текст текст");

      const inboxResponse = await request(app)
        .get("/api/messages?withUserId=u1")
        .set("Cookie", teacherCookie);

      expect(inboxResponse.status).toBe(200);
      expect(
        inboxResponse.body.messages.some(
          (item: { text: string }) => item.text === "текст текст текст текст",
        ),
      ).toBe(true);
    });
  });
});
