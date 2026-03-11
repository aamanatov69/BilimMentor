import { BrandMark } from "@/components/brand-mark";
import { AnimatedCourseGrid } from "@/components/course-animated-view";
import Link from "next/link";

type PublicCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  level: string;
};

async function getPublicCourses(): Promise<PublicCourse[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    return [];
  }

  try {
    const response = await fetch(`${apiBase}/api/public/courses`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { courses?: PublicCourse[] };
    return payload.courses ?? [];
  } catch {
    return [];
  }
}

export default async function IndexPage() {
  const courses = await getPublicCourses();

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(160deg,#ecfeff_0%,#e2e8f0_36%,#dbeafe_100%)] px-3 py-4 text-slate-900 sm:px-4 sm:py-5 md:px-8 md:py-8"
      style={{ fontFamily: '"Manrope", "Segoe UI", sans-serif' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_6%_10%,rgba(14,165,233,0.16),transparent_32%),radial-gradient(circle_at_92%_8%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_50%_82%,rgba(37,99,235,0.10),transparent_36%)]" />
      <div className="pointer-events-none absolute left-[-130px] top-[76px] h-[340px] w-[340px] rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="pointer-events-none absolute right-[-180px] top-[110px] h-[420px] w-[420px] rounded-full bg-blue-300/20 blur-3xl" />

      <div className="relative mx-auto max-w-6xl space-y-6 sm:space-y-7">
        <header className="rounded-3xl border border-white/60 bg-white/75 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.12)] backdrop-blur sm:p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <BrandMark className="scale-110" />
            </div>
            <div className="grid w-full grid-cols-2 gap-2 text-sm sm:flex sm:w-auto sm:items-center">
              <Link
                href="/login"
                className="rounded-lg border border-slate-200/90 bg-white/90 px-4 py-2 text-center font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                Вход
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 px-4 py-2 text-center font-medium text-white shadow-[0_10px_24px_rgba(14,116,144,0.35)] transition hover:brightness-95"
              >
                Регистрация
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_0.8fr] lg:items-end">
            <div className="space-y-4">
              <p className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
                Smart Education Platform
              </p>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-6xl">
                <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-blue-700 bg-clip-text text-transparent">
                  BilimMentor
                </span>{" "}
                - образовательная платформа для студентов и преподавателей
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base md:text-xl/8">
                Создавайте онлайн-курсы и обучайтесь в одном месте: лекции,
                задания, проверка знаний и удобный контроль прогресса для
                каждого участника.
              </p>
            </div>

            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white/90 p-3 text-sm sm:grid-cols-3 lg:grid-cols-1 lg:text-right">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Курсы
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {courses.length}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Формат
                </p>
                <p className="text-xl font-semibold text-slate-900">Online</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Поддержка
                </p>
                <p className="text-xl font-semibold text-slate-900">24/7</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/register"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Начать бесплатно
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Уже есть аккаунт
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              Доступные курсы
            </h2>
            <p className="text-sm text-slate-600">
              Обновляется в реальном времени
            </p>
          </div>
          <AnimatedCourseGrid courses={courses} />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="group rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-sky-50 to-white p-5 shadow-sm transition hover:shadow-[0_14px_32px_rgba(59,130,246,0.16)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
              Для студентов
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-blue-900 sm:text-3xl md:text-4xl">
              Учитесь по понятному треку
            </h3>
            <p className="mt-3 text-base text-slate-600 sm:text-lg md:text-xl">
              Проходите уроки, сдавайте задания и отслеживайте свой прогресс в
              личном кабинете.
            </p>
            <div className="mt-5">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
              >
                Начать обучение
              </Link>
            </div>
          </article>
          <article className="group rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-5 shadow-sm transition hover:shadow-[0_14px_32px_rgba(16,185,129,0.16)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              Для преподавателей
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-emerald-900 sm:text-3xl md:text-4xl">
              Создавайте курсы и управляйте ими
            </h3>
            <p className="mt-3 text-base text-slate-600 sm:text-lg md:text-xl">
              Создавайте курсы, публикуйте уроки и задания, анализируйте
              результаты и помогайте студентам расти.
            </p>
            <div className="mt-5">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 sm:w-auto"
              >
                Кабинет преподавателя
              </Link>
            </div>
          </article>
        </section>

        <footer className="rounded-3xl border border-white/70 bg-white/85 p-4 text-center text-xs text-slate-600 shadow-sm backdrop-blur sm:p-5 sm:text-sm">
          <p className="mt-1 leading-5 sm:leading-6">
            Developed at the initiative of Saltanat Dzhaparova. Copyright 2026
          </p>
          <div className="mt-2 flex flex-col items-center gap-1.5 break-words sm:flex-row sm:justify-center sm:gap-2">
            <span className="text-slate-500">Контакты:</span>
            <a
              href="mailto:bilimmentor@gmail.com"
              className="rounded px-1 py-0.5 text-blue-700 hover:underline"
            >
              bilimmentor@gmail.com
            </a>
            <span className="hidden text-slate-400 sm:inline">|</span>
            <a
              href="https://wa.me/996998868028"
              target="_blank"
              rel="noreferrer"
              className="rounded px-1 py-0.5 text-emerald-700 hover:underline"
            >
              WhatsApp: +996 (998) 868028
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
