const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const teacherIdentifier =
  process.env.SMOKE_TEACHER_IDENTIFIER ?? "teacher@bilimmentor.local";
const teacherPassword = process.env.SMOKE_TEACHER_PASSWORD ?? "password123";
const adminIdentifier =
  process.env.SMOKE_ADMIN_IDENTIFIER ?? "admin@bilimmentor.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "password123";
const testPrefix = process.env.SMOKE_TEST_PREFIX ?? "smoke-e2e";

function ensure(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function makeCookieJar() {
  let cookie = "";

  return {
    read() {
      return cookie;
    },
    writeFromResponse(response) {
      const setCookieHeader = response.headers.get("set-cookie") ?? "";
      if (!setCookieHeader) {
        return;
      }

      const nextCookie = setCookieHeader.split(";")[0]?.trim() ?? "";
      if (nextCookie) {
        cookie = nextCookie;
      }
    },
  };
}

async function requestWithJar(jar, path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };

  if (jar.read()) {
    headers.cookie = jar.read();
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
  });

  jar.writeFromResponse(response);

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { response, data };
}

function assertOk(result, context) {
  if (result.response.ok) {
    return;
  }

  const serverMessage =
    result.data && typeof result.data.message === "string"
      ? result.data.message
      : "";

  throw new Error(
    `${context}: ${result.response.status}${serverMessage ? ` (${serverMessage})` : ""}`,
  );
}

async function loginWithCredentials(identifier, password) {
  const jar = makeCookieJar();
  const result = await requestWithJar(jar, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

  assertOk(result, `Login failed for ${identifier}`);
  return jar;
}

function lessonIdsFromModules(modules) {
  if (!Array.isArray(modules)) {
    return [];
  }

  return modules
    .filter(
      (item) => item && String(item.type ?? "").toLowerCase() === "lesson",
    )
    .map((item) => String(item.id ?? "").trim())
    .filter((item) => item.length > 0);
}

async function run() {
  const teacherJar = await loginWithCredentials(
    teacherIdentifier,
    teacherPassword,
  );
  const adminJar = await loginWithCredentials(adminIdentifier, adminPassword);

  const stamp = Date.now();
  const courseTitle = `${testPrefix}-course-${stamp}`;
  const lessonTitleA = `${testPrefix}-lesson-a-${stamp}`;
  const lessonTitleB = `${testPrefix}-lesson-b-${stamp}`;

  let createdCourseId = "";

  try {
    const createCourse = await requestWithJar(
      teacherJar,
      "/api/teacher/courses",
      {
        method: "POST",
        body: JSON.stringify({
          title: courseTitle,
          description: "Teacher wizard smoke flow",
          level: "beginner",
          publishNow: false,
        }),
      },
    );
    assertOk(createCourse, "Create course failed");

    createdCourseId = String(createCourse.data?.course?.id ?? "").trim();
    ensure(createdCourseId, "Create course returned empty id");

    const createLessonA = await requestWithJar(
      teacherJar,
      `/api/teacher/courses/${createdCourseId}/lessons`,
      {
        method: "POST",
        body: JSON.stringify({
          title: lessonTitleA,
          description: "Lesson A",
        }),
      },
    );
    assertOk(createLessonA, "Create first lesson failed");

    const createLessonB = await requestWithJar(
      teacherJar,
      `/api/teacher/courses/${createdCourseId}/lessons`,
      {
        method: "POST",
        body: JSON.stringify({
          title: lessonTitleB,
          description: "Lesson B",
        }),
      },
    );
    assertOk(createLessonB, "Create second lesson failed");

    const lessonAId = String(createLessonA.data?.lesson?.id ?? "").trim();
    const lessonBId = String(createLessonB.data?.lesson?.id ?? "").trim();
    ensure(lessonAId && lessonBId, "Lesson creation returned empty lesson ids");

    const reorder = await requestWithJar(
      teacherJar,
      `/api/teacher/courses/${createdCourseId}/lessons/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({ lessonIds: [lessonBId, lessonAId] }),
      },
    );
    assertOk(reorder, "Lesson reorder failed");

    const reorderedIds = lessonIdsFromModules(reorder.data?.course?.modules);
    ensure(
      reorderedIds[0] === lessonBId && reorderedIds[1] === lessonAId,
      "Lesson reorder response order mismatch",
    );

    const publishBulk = await requestWithJar(
      adminJar,
      "/api/admin/courses/bulk",
      {
        method: "POST",
        body: JSON.stringify({
          action: "publish",
          courseIds: [createdCourseId],
        }),
      },
    );
    assertOk(publishBulk, "Bulk publish failed");
    ensure(
      Number(publishBulk.data?.affectedCount ?? 0) >= 1,
      "Bulk publish affectedCount is zero",
    );

    const unpublishBulk = await requestWithJar(
      adminJar,
      "/api/admin/courses/bulk",
      {
        method: "POST",
        body: JSON.stringify({
          action: "unpublish",
          courseIds: [createdCourseId],
        }),
      },
    );
    assertOk(unpublishBulk, "Bulk unpublish failed");

    const deleteBulk = await requestWithJar(
      adminJar,
      "/api/admin/courses/bulk",
      {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          courseIds: [createdCourseId],
        }),
      },
    );
    assertOk(deleteBulk, "Bulk delete failed");
    ensure(
      Number(deleteBulk.data?.affectedCount ?? 0) >= 1,
      "Bulk delete affectedCount is zero",
    );

    const verifyDeleted = await requestWithJar(adminJar, "/api/courses", {
      method: "GET",
    });
    assertOk(verifyDeleted, "Courses list verification failed");

    const existsAfterDelete = Array.isArray(verifyDeleted.data?.courses)
      ? verifyDeleted.data.courses.some(
          (course) => String(course.id) === createdCourseId,
        )
      : false;
    ensure(!existsAfterDelete, "Course still exists after bulk delete");

    console.log("E2E smoke OK: teacher wizard flow + admin bulk mass actions");
  } finally {
    if (createdCourseId) {
      await requestWithJar(adminJar, `/api/admin/courses/${createdCourseId}`, {
        method: "DELETE",
      });
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
