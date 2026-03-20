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

export const dynamic = "force-static";
export const revalidate = 3600;

const stats = [
  { value: "500+", label: "Студентов" },
  { value: "50+", label: "Курсов" },
  { value: "20+", label: "Преподавателей" },
  { value: "95%", label: "Довольных учеников" },
] as const;

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

export default function IndexPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      {/*  Navbar  */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
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

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">
              Возможности
            </a>
            <a href="#how" className="hover:text-slate-900">
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
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:px-4 sm:text-sm"
            >
              Регистрация
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-100 md:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 px-4 py-2 sm:px-5">
            <a
              href="#features"
              className="flex-1 rounded-md bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700"
            >
              Возможности
            </a>
            <a
              href="#how"
              className="flex-1 rounded-md bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700"
            >
              Как это работает
            </a>
          </div>
        </div>
      </header>

      {/*  Hero  */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white pb-14 pt-14 sm:pb-20 sm:pt-20 lg:pt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(59,130,246,0.12),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-5 lg:px-8">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 sm:px-3.5 sm:text-sm">
            <Zap className="h-3.5 w-3.5" />
            Платформа нового поколения
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Обучение, которое{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              приносит результат
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-500 sm:text-xl">
            BilimMentor цифровая платформа наставничества и образования.
            Персональные курсы, живые менторы и прозрачный прогресс в одном
            месте.
          </p>
          {/* <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-700"
            >
              Регистрация
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Войти в аккаунт
            </Link>
          </div> */}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-400 sm:gap-x-6 sm:text-sm">
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
        <div className="relative mx-auto mt-10 max-w-5xl px-0 sm:mt-14 sm:px-5 lg:px-8">
          <div className="mobile-scroll overflow-x-auto">
            <div className="min-w-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 sm:min-w-0">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <div className="ml-3 flex-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-400">
                  app.bilimmentor.kz/dashboard
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
      <section className="border-y border-slate-100 bg-white py-10 sm:py-12">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 text-center sm:gap-8 sm:px-5 md:grid-cols-4 lg:px-8">
          {stats.map((item) => (
            <div key={item.label}>
              <p className="text-3xl font-extrabold text-blue-600">
                {item.value}
              </p>
              <p className="mt-1 text-sm text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/*  Features  */}
      <section id="features" className="bg-slate-50 py-14 sm:py-20">
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
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
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
          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-extrabold text-white">
                  {step.number}
                </div>
                <h3 className="mb-2 font-bold text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/*  CTA  */}
      <section className="bg-blue-600 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-5 lg:px-8">
          <Users className="mx-auto mb-4 h-10 w-10 text-blue-200" />
          <h2 className="text-2xl font-extrabold text-white sm:text-4xl">
            Присоединяйтесь уже сегодня
          </h2>
          <p className="mt-3 text-sm text-blue-100 sm:text-base">
            Более 500 студентов уже обучаются на BilimMentor. Начните свой путь
            прямо сейчас.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="w-full rounded-lg bg-white px-7 py-3 text-base font-semibold text-blue-700 shadow-lg transition hover:bg-blue-50 sm:w-auto"
            >
              Начать бесплатно
            </Link>
            <Link
              href="/login"
              className="w-full rounded-lg border border-blue-400 px-7 py-3 text-base font-semibold text-white transition hover:bg-blue-500 sm:w-auto"
            >
              Войти
            </Link>
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
              <span className="font-semibold text-slate-700">BilimMentor</span>
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
  );
}
