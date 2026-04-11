import { AnimatedCourseGrid } from "@/components/course-animated-view";
import {
  BookOpenCheck,
  ChartNoAxesColumn,
  CheckCircle,
  MessageCircle,
  Target,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

type PublicCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  level: string;
  isPublished?: boolean;
};

type PublicStats = {
  students: number;
  courses: number;
  teachers: number;
  satisfiedStudentsPercent: number | null;
};

async function getPublicCourses(): Promise<PublicCourse[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
  if (!apiBase) {
    return [];
  }

  try {
    const response = await fetch(
      `${apiBase.replace(/\/$/, "")}/api/public/courses`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { courses?: PublicCourse[] };
    const courses = payload.courses ?? [];

    return courses.filter(
      (item) => item.isPublished === undefined || item.isPublished,
    );
  } catch {
    return [];
  }
}

const stats = [
  { value: "0", label: "Студентов" },
  { value: "0", label: "Курсов" },
  { value: "0", label: "Преподавателей" },
  { value: "-", label: "Довольных учеников" },
] as const;

async function getPublicStats(): Promise<PublicStats | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
  if (!apiBase) {
    return null;
  }

  try {
    const response = await fetch(
      `${apiBase.replace(/\/$/, "")}/api/public/stats`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PublicStats;
  } catch {
    return null;
  }
}

const features = [
  {
    icon: Target,
    title: "Индивидуальный путь",
    description: "Персональные планы и рекомендации под цели каждого студента.",
  },
  {
    icon: ChartNoAxesColumn,
    title: "Прогресс в реальном времени",
    description:
      "Следите за успехами: оценки, задания и курсы в одном дашборде.",
  },
  {
    icon: MessageCircle,
    title: "Живое общение",
    description: "Чат с менторами, обратная связь по заданиям и комментарии.",
  },
  {
    icon: BookOpenCheck,
    title: "Каталог курсов",
    description:
      "Подготовительные курсы к поступлению, IELTS, ЕГЭ и не только.",
  },
] as const;

const steps = [
  {
    number: "01",
    title: "Зарегистрируйтесь",
    description: "Создайте аккаунт за несколько секунд без кредитной карты.",
  },
  {
    number: "02",
    title: "Выберите курс",
    description: "Найдите подходящий курс или подайте заявку к наставнику.",
  },
  {
    number: "03",
    title: "Учитесь и растите",
    description:
      "Выполняйте задания, получайте оценки и следите за прогрессом.",
  },
] as const;

export default async function IndexPage() {
  const [courses, publicStats] = await Promise.all([
    getPublicCourses(),
    getPublicStats(),
  ]);

  const runtimeStats = [
    {
      value: String(publicStats?.students ?? stats[0].value),
      label: stats[0].label,
    },
    {
      value: String(publicStats?.courses ?? stats[1].value),
      label: stats[1].label,
    },
    {
      value: String(publicStats?.teachers ?? stats[2].value),
      label: stats[2].label,
    },
    {
      value:
        typeof publicStats?.satisfiedStudentsPercent === "number"
          ? `${publicStats.satisfiedStudentsPercent}%`
          : stats[3].value,
      label: stats[3].label,
    },
  ];

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f4fbff_35%,#eef6ff_60%,#ffffff_100%)] text-slate-900 antialiased"
      style={{ fontFamily: '"Manrope", "Montserrat", sans-serif' }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(14,165,233,0.18),transparent_72%)]" />
      <div className="product-orb pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-cyan-200/65 blur-3xl" />
      <div className="product-orb product-orb-delay pointer-events-none absolute -right-28 top-64 h-80 w-80 rounded-full bg-blue-200/60 blur-3xl" />

      <div className="relative">
        {/*  Navbar  */}
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-5 lg:px-8">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/brand/bm-icon.svg"
                alt="BilimMentor"
                width={36}
                height={36}
                className="h-9 w-9"
                priority
                sizes="36px"
              />
              <span className="text-lg font-bold text-slate-900 sm:text-xl">
                BilimMentor
              </span>
            </Link>

            <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
              <a href="#courses" className="transition hover:text-slate-900">
                Курсы
              </a>
              <a href="#features" className="transition hover:text-slate-900">
                Возможности
              </a>
              <a href="#how" className="transition hover:text-slate-900">
                Как это работает
              </a>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="rounded-md px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:px-3 sm:text-sm"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(6,182,212,0.32)] transition duration-300 hover:-translate-y-0.5 hover:brightness-105 sm:px-4 sm:text-sm"
              >
                Регистрация
              </Link>
            </div>
          </div>
        </header>

        {/*  Hero  */}
        <section className="relative overflow-hidden bg-gradient-to-b from-cyan-50/60 via-white to-white pb-14 pt-14 sm:pb-20 sm:pt-20 lg:pt-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(59,130,246,0.16),transparent)]" />
          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-5 lg:px-8">
            <span className="product-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 sm:px-3.5 sm:text-sm">
              <Zap className="h-3.5 w-3.5" />
              Платформа нового поколения
            </span>
            <h1 className="product-fade-up product-fade-up-delay text-[2rem] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Обучение, которое{" "}
              <span className="bg-gradient-to-r from-blue-700 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
                приносит результат
              </span>
            </h1>
            <p className="product-fade-up product-fade-up-delay-2 mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 sm:mt-5 sm:text-xl">
              BilimMentor цифровая платформа наставничества и образования.
              Персональные курсы, живые менторы и прозрачный прогресс в одном
              месте.
            </p>
            {/* <div className="product-fade-up product-fade-up-delay-2 mt-7 flex flex-col items-stretch justify-center gap-2.5 sm:mt-8 sm:flex-row sm:items-center sm:gap-3">
              <Link
                href="/register"
                className="product-glow w-full rounded-xl bg-gradient-to-r from-blue-700 via-cyan-500 to-teal-500 px-7 py-3.5 text-base font-semibold text-white shadow-[0_18px_38px_rgba(6,182,212,0.35)] transition duration-300 hover:-translate-y-1 hover:brightness-110 sm:w-auto"
              >
                Начать бесплатно
              </Link>
              <Link
                href="/login"
                className="w-full rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-base font-semibold text-slate-700 transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
              >
                Войти в аккаунт
              </Link>
            </div> */}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500 sm:gap-x-6 sm:text-sm">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Без скрытых платежей
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Поддержка 24/7
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Бесплатно на старте
              </span>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="mx-auto mt-8 max-w-md px-4 sm:hidden">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.12)]">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <div className="ml-2 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-400">
                  app.bilimmentor.com/dashboard
                </div>
              </div>

              <div className="space-y-3 p-3.5">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Меню
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
                    <span className="rounded-md bg-blue-600 px-2.5 py-1.5 text-white">
                      Курсы
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1.5 text-slate-600">
                      Прогресс
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1.5 text-slate-600">
                      Сообщения
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1.5 text-slate-600">
                      Оценки
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1.5 text-slate-600">
                      Настройки
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-base font-bold text-slate-800">
                    Добро пожаловать
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-center">
                      <p className="text-lg font-bold text-blue-600">3</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Курсов активно
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-center">
                      <p className="text-lg font-bold text-blue-600">12</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Заданий выполнено
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-center">
                      <p className="text-lg font-bold text-blue-600">87</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Средний балл
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 p-3">
                  <p className="mb-2.5 text-xs font-semibold text-slate-700">
                    Прогресс по курсам
                  </p>
                  <div className="mb-2.5">
                    <div className="mb-1 flex justify-between text-[11px] text-slate-600">
                      <span>Подготовка к IELTS</span>
                      <span className="font-medium">72%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-full w-[72%] rounded-full bg-blue-500" />
                    </div>
                  </div>
                  <div className="mb-2.5">
                    <div className="mb-1 flex justify-between text-[11px] text-slate-600">
                      <span>Математика ЕГЭ</span>
                      <span className="font-medium">45%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-full w-[45%] rounded-full bg-blue-500" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-600">
                      <span>Study Abroad 101</span>
                      <span className="font-medium">30%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-full w-[30%] rounded-full bg-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mx-auto mt-10 hidden max-w-5xl px-0 sm:mt-14 sm:block sm:px-5 lg:px-8">
            <div className="mobile-scroll overflow-x-auto">
              <div className="product-fade-up min-w-[760px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_55px_rgba(15,23,42,0.12)] sm:min-w-0">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <div className="ml-3 flex-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-400">
                    app.bilimmentor.com/dashboard
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-0 lg:grid-cols-4">
                  <div className="hidden border-r border-slate-100 bg-slate-50 p-4 lg:block">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Меню
                    </p>
                    <div className="mb-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white">
                      Курсы
                    </div>
                    <div className="mb-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600">
                      Прогресс
                    </div>
                    <div className="mb-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600">
                      Сообщения
                    </div>
                    <div className="mb-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600">
                      Оценки
                    </div>
                    <div className="mb-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600">
                      Настройки
                    </div>
                  </div>
                  <div className="col-span-3 p-5">
                    <p className="text-lg font-bold text-slate-800">
                      Добро пожаловать{" "}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-2xl font-bold text-blue-600">3</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Курсов активно
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-2xl font-bold text-blue-600">12</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Заданий выполнено
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-2xl font-bold text-blue-600">87</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Средний балл
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-100 p-4">
                      <p className="mb-3 text-sm font-semibold text-slate-700">
                        Прогресс по курсам
                      </p>
                      <div className="mb-3">
                        <div className="mb-1 flex justify-between text-xs text-slate-600">
                          <span>Подготовка к IELTS</span>
                          <span className="font-medium">72%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div className="h-full w-[72%] rounded-full bg-blue-500" />
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="mb-1 flex justify-between text-xs text-slate-600">
                          <span>Математика ЕГЭ</span>
                          <span className="font-medium">45%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div className="h-full w-[45%] rounded-full bg-blue-500" />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-slate-600">
                          <span>Study Abroad 101</span>
                          <span className="font-medium">30%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div className="h-full w-[30%] rounded-full bg-blue-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/*  Stats  */}
        <section className="border-y border-slate-100/90 bg-white py-8 sm:py-12">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 text-center sm:gap-6 sm:px-5 md:grid-cols-4 lg:px-8">
            {runtimeStats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
              >
                <p className="text-3xl font-extrabold text-blue-600 sm:text-4xl">
                  {item.value}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Courses */}
        <section
          id="courses"
          className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] py-10 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-5 lg:px-8">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3 sm:mb-10">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 sm:text-4xl">
                  Доступные курсы
                </h2>
                {/* <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
                  Показываем реальные опубликованные курсы из системы в текущий
                  момент.
                </p> */}
              </div>
              <p className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 sm:text-sm">
                Опубликовано сейчас: {courses.length}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-3 shadow-[0_18px_42px_rgba(15,23,42,0.09)] backdrop-blur sm:p-5">
              <AnimatedCourseGrid courses={courses} />
            </div>
          </div>
        </section>

        {/*  Features  */}
        <section id="features" className="bg-slate-50/70 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-5 lg:px-8">
            <div className="mb-10 text-center sm:mb-12">
              <h2 className="text-2xl font-extrabold text-slate-900 sm:text-4xl">
                Всё что нужно для роста
              </h2>
              <p className="mt-3 text-sm text-slate-500 sm:text-base">
                Инструменты для студентов, преподавателей и администраторов в
                единой системе.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-3 text-blue-600">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 font-bold text-slate-900">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-500">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/*  How it works  */}
        <section id="how" className="bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-5 lg:px-8">
            <div className="mb-10 text-center sm:mb-12">
              <h2 className="text-2xl font-extrabold text-slate-900 sm:text-4xl">
                Как это работает
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-3 sm:gap-8">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 text-center"
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-extrabold text-white shadow-md shadow-blue-200/70">
                    {step.number}
                  </div>
                  <h3 className="mb-2 font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-500">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/*  CTA  */}
        <section className="relative overflow-hidden bg-[linear-gradient(115deg,#0f172a_0%,#1d4ed8_42%,#0891b2_100%)] py-12 sm:py-20">
          <div className="pointer-events-none absolute -left-16 top-6 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -right-14 bottom-8 h-52 w-52 rounded-full bg-cyan-200/20 blur-2xl" />
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-5 lg:px-8">
            <Users className="mx-auto mb-4 h-10 w-10 text-cyan-100" />
            <h2 className="text-2xl font-extrabold text-white sm:text-4xl">
              Присоединяйтесь уже сегодня
            </h2>
            <p className="mt-3 text-sm text-blue-100 sm:text-base">
              Начните свой путь прямо сейчас.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="product-glow w-full rounded-xl bg-white px-7 py-3 text-base font-extrabold text-blue-700 shadow-[0_18px_36px_rgba(255,255,255,0.24)] transition duration-300 hover:-translate-y-1 hover:bg-blue-50 sm:w-auto"
              >
                Начать сейчас
              </Link>
              {/* <Link
                href="/login"
                className="w-full rounded-xl border border-white/40 bg-white/10 px-7 py-3 text-base font-semibold text-white transition duration-300 hover:-translate-y-1 hover:bg-white/20 sm:w-auto"
              >
                Войти
              </Link> */}
            </div>
          </div>
        </section>

        {/*  Footer  */}
        <footer className="border-t border-slate-100 bg-white py-8">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2">
                <Image
                  src="/brand/bm-icon.svg"
                  alt="BilimMentor"
                  width={28}
                  height={28}
                  className="h-7 w-7"
                />
                <span className="font-semibold text-slate-700">
                  BilimMentor
                </span>
              </div>
              <div>
                <p className="text-center text-sm font-semibold text-slate-800 sm:text-left">
                  Есть вопросы? Свяжитесь с нами:
                </p>
                <div className="mt-2 flex flex-col items-center justify-center gap-2 text-sm text-slate-600 sm:flex-row sm:gap-4">
                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=bilimmentor@gmail.com&su=%D0%97%D0%B0%D1%8F%D0%B2%D0%BA%D0%B0%20%D0%BD%D0%B0%20BilimMentor&body=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5!%20%D0%A5%D0%BE%D1%87%D1%83%20%D1%83%D0%B7%D0%BD%D0%B0%D1%82%D1%8C%20%D0%BE%20%D0%BA%D1%83%D1%80%D1%81%D0%B0%D1%85%20BilimMentor."
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-700 underline-offset-2 hover:underline"
                  >
                    bilimmentor@gmail.com
                  </a>
                  <a
                    href="https://wa.me/996998868028?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%21%20%D0%A5%D0%BE%D1%87%D1%83%20%D1%83%D0%B7%D0%BD%D0%B0%D1%82%D1%8C%20%D0%BE%20%D0%BA%D1%83%D1%80%D1%81%D0%B0%D1%85%20BilimMentor."
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                  >
                    WhatsApp: +996 998 86 80 28
                  </a>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                © 2026 BilimMentor. Все права защищены.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
