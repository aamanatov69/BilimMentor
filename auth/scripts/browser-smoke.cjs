// Browser UI checks with API fixtures. Does not connect to or modify the database.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../..");
require(path.join(root, "api/node_modules/dotenv")).config({ path: path.join(root, "auth/.env"), quiet: true });
const jwt = require(path.join(root, "api/node_modules/jsonwebtoken"));
const chrome = process.env.BROWSER_EXECUTABLE || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(fs.existsSync);
const artifacts = path.join(root, ".browser-tests");
fs.mkdirSync(artifacts, { recursive: true });
const profile = fs.mkdtempSync(path.join(artifacts, "profile-"));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, ws, nextId = 0, role = "teacher", failInvite = true, failSettings = false;
const pending = new Map();
const course = { id: "browser-course", title: "Тестовый курс", category: "Математика", description: "Описание курса", level: "beginner", isPublished: true, progress: 0, studentsCount: 1, createdAt: "2026-01-01T00:00:00Z", modules: [{ type: "lesson", id: "browser-lesson", title: "Тестовый урок", description: "Материал урока", isVisibleToStudents: true }] };
function fixture(url, method) {
  const pathname = new URL(url).pathname;
  if (pathname === "/api/me") return { user: { id: "browser-user", fullName: "Тестовый пользователь", role } };
  if (pathname === "/api/auth/login") return { user: { id: "browser-user", role } };
  if (pathname === "/api/teacher/courses") return { courses: [course] };
  if (pathname.endsWith("/details")) return { course, students: [{ id: "student", fullName: "Анна Тест", email: "anna@example.test" }] };
  if (pathname.endsWith("/share-invite")) return { inviteToken: "browser-fixture-token", expiresAt: "2026-12-31T00:00:00Z" };
  if (pathname.endsWith("/course-access-requests")) return { requests: [] };
  if (pathname === "/api/teacher/overview") return { summary: { courses: 1, studentsEnrolled: 1, assignmentsToGrade: 0, pendingRequests: 0 }, courses: [course] };
  if (pathname === "/api/teacher/grades") return { rows: [] };
  if (pathname === "/api/notifications") return { notifications: [] };
  if (pathname === "/api/notifications/unread-count") return { count: 0 };
  if (method === "PUT") return { course };
  return {};
}
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, label) {
  for (let i = 0; i < 200; i++) {
    if (await evaluate(expression)) return;
    await delay(150);
  }
  throw new Error(`Timed out: ${label}`);
}
async function navigate(route) {
  await send("Page.navigate", { url: `http://localhost:3000${route}` });
  await waitFor("document.readyState === 'complete'", "document ready");
}
async function clickText(text) {
  const clicked = await evaluate(`(()=>{const el=[...document.querySelectorAll('button,a')].find(el=>el.getClientRects().length && el.textContent.trim()===${JSON.stringify(text)});if(!el)return false;el.click();return true})()`);
  assert.ok(clicked, `Control not found: ${text}`);
}
async function main() {
  assert.ok(chrome, "Set BROWSER_EXECUTABLE to a Chromium browser");
  assert.ok(process.env.JWT_SECRET, "auth/.env must contain JWT_SECRET");
  browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  const browserLog = fs.createWriteStream(path.join(profile, "browser.log"));
  browser.stderr.pipe(browserLog);
  let launchError;
  browser.on("error", (error) => { launchError = error; });
  const portFile = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) { if (launchError) throw launchError; await delay(100); }
  assert.ok(fs.existsSync(portFile), "Browser debugging endpoint did not start");
  const port = fs.readFileSync(portFile, "utf8").split("\n")[0];
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
  ws.addEventListener("close", () => { for (const waiter of pending.values()) waiter.reject(new Error("Browser connection closed")); pending.clear(); });
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  ws.addEventListener("message", async ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const waiter = pending.get(message.id); pending.delete(message.id);
      if (message.error) waiter?.reject(new Error(message.error.message)); else waiter?.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      const pathname = new URL(request.url).pathname;
      const status = request.method === "OPTIONS" ? 204 : pathname.endsWith("/share-invite") && failInvite ? 503 : request.method === "PUT" && failSettings ? 401 : 200;
      const body = request.method === "OPTIONS" ? "" : JSON.stringify(status === 200 ? fixture(request.url, request.method) : { message: "Fixture failure" });
      await send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [
        { name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "http://localhost:3000" },
        { name: "Access-Control-Allow-Credentials", value: "true" }, { name: "Access-Control-Allow-Headers", value: "content-type" },
        { name: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
      ], body: Buffer.from(body).toString("base64") }).catch(() => {});
    }
  });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  console.log("Browser connected");
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  await send("Fetch.enable", { patterns: [{ urlPattern: `${apiBase}/*`, requestStage: "Request" }] });
  await send("Network.setCookie", { name: "bilimMentorToken", value: jwt.sign({ sub: "browser-user", role, sessionStamp: "fixture" }, process.env.JWT_SECRET.trim(), { expiresIn: "1h" }), url: "http://localhost:3000", path: "/", httpOnly: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate("/dashboard/teacher/courses");
  await waitFor("document.body.innerText.includes('Тестовый курс')", "course list");
  await evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getClientRects().length && (b.getAttribute('aria-label')==='Поделиться курсом'||b.textContent.trim()==='Поделиться')); b.focus(); b.click();})()");
  await waitFor("!!document.querySelector('dialog[open]') && document.body.innerText.includes('Повторить создание ссылки')", "invite retry");
  failInvite = false;
  await clickText("Повторить создание ссылки");
  await waitFor("document.body.innerText.includes('Копировать ссылку')", "invite ready");
  for (let i = 0; i < 12; i++) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    assert.ok(await evaluate("document.activeElement === document.body || !!document.activeElement.closest('dialog[open]')"), "Focus escaped the dialog");
  }
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor("!document.querySelector('dialog[open]')", "Escape closes dialog");
  assert.ok(await evaluate("document.activeElement?.getAttribute('aria-label') === 'Поделиться курсом' || document.activeElement?.textContent.trim() === 'Поделиться'"), "Focus was not restored");
  console.log("PASS invite error/retry, keyboard containment and focus restoration");
  await navigate("/dashboard/teacher/courses?course=missing");
  await waitFor("document.body.innerText.includes('Курс не найден')", "missing course");
  assert.ok(!(await evaluate("document.body.innerText.includes('Тестовый урок')")), "Old lesson remained visible");
  await navigate("/dashboard/teacher/courses/browser-course/settings");
  await waitFor("!!document.querySelector('input[value=\"Тестовый курс\"]')", "settings loaded");
  await evaluate("(()=>{const input=document.querySelector('form input');input.focus();input.select();})()");
  await send("Input.insertText", { text: "Изменённое название" });
  await waitFor("document.body.innerText.includes('Есть несохранённые изменения')", "settings draft changed");
  failSettings = true;
  await clickText("Сохранить настройки");
  await waitFor("document.body.innerText.includes('Войти без закрытия формы')", "session recovery");
  assert.equal(await evaluate("document.querySelector('form input').value"), "Изменённое название");
  await clickText("Войти без закрытия формы");
  await waitFor("!!document.querySelector('dialog[open]')", "recovery dialog");
  await evaluate("document.querySelector('dialog[open] input[autocomplete=username]').focus()");
  await send("Input.insertText", { text: "fixture@example.test" });
  await evaluate("document.querySelector('dialog[open] input[type=password]').focus()");
  await send("Input.insertText", { text: "fixture-password" });
  await clickText("Войти");
  await waitFor("document.body.innerText.includes('Вход восстановлен')", "session restored");
  assert.equal(await evaluate("document.querySelector('main form input').value"), "Изменённое название");
  failSettings = false;
  await clickText("Сохранить настройки");
  await waitFor("document.body.innerText.includes('Настройки курса сохранены')", "settings saved");
  console.log("PASS missing course, settings, recovery without losing form data");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate("/dashboard/teacher/students?course=browser-course");
  await waitFor("document.body.innerText.includes('Анна Тест')", "mobile students");
  assert.ok(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Horizontal overflow on mobile");
  await clickText("Ещё");
  await waitFor("document.querySelector('button[aria-expanded=true]') !== null", "mobile menu");
  const screenshot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(artifacts, "teacher-mobile.png"), Buffer.from(screenshot.data, "base64"));
  console.log("PASS mobile layout and More navigation; screenshot saved in .browser-tests");
}
const deadline = setTimeout(() => { console.error("Browser smoke deadline exceeded"); ws?.close(); browser?.kill(); process.exit(1); }, 180000);
main().catch(async (error) => {
  console.error(error.message); process.exitCode = 1;
  if (ws?.readyState === WebSocket.OPEN) {
    console.error(await evaluate("document.body.innerText.slice(0, 4000)").catch(() => ""));
    const screenshot = await send("Page.captureScreenshot", { format: "png" }).catch(() => null);
    if (screenshot) fs.writeFileSync(path.join(artifacts, "failure.png"), Buffer.from(screenshot.data, "base64"));
  }
}).finally(() => { clearTimeout(deadline); ws?.close(); browser?.kill(); });
