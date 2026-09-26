type Role = "student" | "teacher" | "admin";

export function loginDestination(next: string | null | undefined, role: Role) {
  const fallback = `/dashboard/${role}`;
  if (!next || !next.startsWith("/dashboard/") || /[\\\r\n]/.test(next)) return fallback;
  try {
    const url = new URL(next, "https://local.invalid");
    if (url.origin !== "https://local.invalid" || /%|\\/.test(url.pathname)) return fallback;
    const allowed = role === "admin" ? ["admin", "teacher", "student"] : [role];
    if (!allowed.some((item) => url.pathname === `/dashboard/${item}` || url.pathname.startsWith(`/dashboard/${item}/`))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
