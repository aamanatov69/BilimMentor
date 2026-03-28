"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

type PublicCourse = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  level: string;
};

const courseVisuals = [
  "from-sky-500/35 via-blue-500/20 to-indigo-500/15",
  "from-cyan-500/35 via-teal-500/20 to-slate-500/15",
  "from-amber-500/30 via-orange-500/20 to-rose-500/10",
  "from-violet-500/30 via-blue-500/20 to-sky-500/10",
];

function levelLabel(level: string) {
  const normalized = level.toLowerCase();
  if (normalized.includes("beginner")) return "Начальный";
  if (normalized.includes("intermediate")) return "Средний";
  if (normalized.includes("advanced")) return "Продвинутый";
  return level;
}

function visualIndexById(id: string) {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) {
    sum += id.charCodeAt(index);
  }
  return sum % courseVisuals.length;
}

function AnimateView({
  name,
  className,
  children,
}: {
  name: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      layoutId={name}
      transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Item({
  course,
  visual,
  setSelectedItem,
  className,
}: {
  course: PublicCourse;
  visual: string;
  setSelectedItem: (item: string) => void;
  className?: string;
}) {
  const animationName = `course-${course.id}`;

  return (
    <AnimateView
      name={animationName}
      className={`w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.1)] md:w-72 md:flex-none xl:w-80 ${className ?? ""}`}
    >
      <button
        type="button"
        className="group block w-full text-left transition duration-300 hover:-translate-y-1 md:hover:scale-[1.02]"
        onClick={() => setSelectedItem(course.id)}
      >
        <div
          className={`relative min-h-[255px] bg-gradient-to-br sm:min-h-[275px] ${visual}`}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/35 blur-2xl transition group-hover:scale-110" />
          <div className="pointer-events-none absolute -left-10 bottom-8 h-24 w-24 rounded-full bg-white/25 blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/80 to-white/40" />
          <div className="relative z-10 flex min-h-[255px] items-end p-3.5 text-slate-900 sm:min-h-[275px] sm:p-4.5">
            <div className="flex w-full min-h-[182px] flex-col justify-end gap-2.5">
              <div className="mb-1 flex flex-wrap gap-1.5 text-[11px] font-medium">
                {course.category &&
                course.category.trim() &&
                course.category.trim().toLowerCase() !== "general" ? (
                  <span className="rounded-full border border-slate-300 bg-white/90 px-2.5 py-1">
                    {course.category}
                  </span>
                ) : null}
                <span className="rounded-full border border-slate-300 bg-white/90 px-2.5 py-1">
                  {levelLabel(course.level)}
                </span>
              </div>
              <h3
                className="line-clamp-2 min-h-[3.3rem] text-[1.1rem] font-bold leading-snug tracking-tight text-slate-900 sm:min-h-[3.7rem] sm:text-[1.28rem]"
                style={{ fontFamily: '"Montserrat", "Manrope", sans-serif' }}
              >
                {course.title}
              </h3>
              <p className="line-clamp-3 min-h-[4.6rem] text-sm font-medium leading-6 text-slate-700">
                {course.description?.trim() ||
                  "Описание курса будет добавлено в ближайшее время."}
              </p>
              <span className="inline-flex w-fit items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition group-hover:bg-slate-800 sm:px-4 sm:py-2 sm:text-sm">
                Подробнее
                <span aria-hidden="true">{"->"}</span>
              </span>
            </div>
          </div>
        </div>
      </button>
    </AnimateView>
  );
}

function Modal({
  selectedCourse,
  onClose,
}: {
  selectedCourse: PublicCourse;
  onClose: () => void;
}) {
  const animationName = `course-${selectedCourse.id}`;
  const modalVisual = courseVisuals[visualIndexById(selectedCourse.id)];
  const descriptionText =
    selectedCourse.description?.trim() ||
    "Описание курса будет добавлено в ближайшее время.";
  const modalTextLength =
    selectedCourse.title.trim().length + descriptionText.length;

  const modalWidthClass =
    modalTextLength > 900
      ? "max-w-5xl"
      : modalTextLength > 520
        ? "max-w-4xl"
        : modalTextLength > 240
          ? "max-w-3xl"
          : "max-w-2xl";

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-40 bg-slate-900/30 p-2 sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="flex min-h-full items-center justify-center">
          <AnimateView
            name={animationName}
            className={`w-full ${modalWidthClass} overflow-x-hidden overflow-y-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.2)]`}
          >
            <div
              className={`relative max-h-[92svh] overflow-x-hidden overflow-y-auto bg-gradient-to-br ${modalVisual}`}
              onClick={onClose}
            >
              <div className="pointer-events-none absolute -left-24 -top-20 h-52 w-52 rounded-full bg-white/35 blur-3xl" />
              <div className="pointer-events-none absolute -right-20 bottom-8 h-40 w-40 rounded-full bg-white/25 blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/85 to-white/50" />

              <div className="relative z-10 p-4 text-slate-900 sm:p-6">
                <div className="w-full rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-lg sm:p-6">
                  <div className="mb-4 flex items-start justify-end gap-3">
                    <Link
                      href="/login"
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                    >
                      Войти
                    </Link>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Закрыть
                    </button>
                  </div>

                  <h3
                    className="break-words text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl"
                    style={{
                      fontFamily: '"Montserrat", "Manrope", sans-serif',
                    }}
                  >
                    {selectedCourse.title}
                  </h3>

                  <p className="mt-3 break-words text-sm font-medium leading-7 text-slate-700 sm:text-base">
                    {descriptionText}
                  </p>
                </div>
              </div>
            </div>
          </AnimateView>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function AnimatedCourseGrid({ courses }: { courses: PublicCourse[] }) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedItem) ?? null,
    [courses, selectedItem],
  );

  return (
    <>
      <div className="max-h-[40rem] touch-pan-y overflow-y-auto overscroll-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden md:max-h-none md:touch-pan-x md:overflow-x-auto md:overflow-y-hidden md:pb-2">
        <div className="grid gap-4 md:flex md:w-max md:flex-nowrap">
          {courses.length > 0 ? (
            courses.map((course, index) => {
              const visual = courseVisuals[index % courseVisuals.length];
              const hiddenOnMobile = index >= 10;
              return (
                <Item
                  key={course.id}
                  course={course}
                  visual={visual}
                  setSelectedItem={setSelectedItem}
                  className={hiddenOnMobile ? "hidden md:block" : undefined}
                />
              );
            })
          ) : (
            <article className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 text-sm text-slate-600 shadow-sm backdrop-blur md:col-span-2 xl:col-span-4">
              Пока нет опубликованных курсов.
            </article>
          )}
        </div>
      </div>

      {selectedCourse ? (
        <Modal
          selectedCourse={selectedCourse}
          onClose={() => setSelectedItem(null)}
        />
      ) : null}
    </>
  );
}
