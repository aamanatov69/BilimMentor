import test from "node:test";
import assert from "node:assert/strict";
import { loginDestination } from "../lib/login-destination.ts";
test("preserves dashboard location for permitted roles", () => {
  const path = "/dashboard/student/courses/c1?lesson=l2#material";
  assert.equal(loginDestination(path, "student"), path);
  assert.equal(loginDestination(path, "admin"), path);
  assert.equal(loginDestination(null, "teacher"), "/dashboard/teacher");
});
test("rejects external redirects, other roles and encoded paths", () => {
  for (const path of ["https://evil.example", "//evil.example", "/dashboard/admin", "/dashboard/studentx", "/dashboard/student/../../login", "/dashboard/student/%2e%2e/admin", "/dashboard/student/%252e%252e/admin", "/dashboard/student\\evil", "/login"]) {
    assert.equal(loginDestination(path, "student"), "/dashboard/student");
  }
});
