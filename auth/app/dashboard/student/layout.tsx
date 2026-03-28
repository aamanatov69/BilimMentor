"use client";

import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Bell, BookOpen, ClipboardCheck, Home, Star } from "lucide-react";

const sidebarItems = [
  { href: "/dashboard/student", label: "Главная", icon: Home, exact: true },
  { href: "/dashboard/student/courses", label: "Курсы", icon: BookOpen },
  {
    href: "/dashboard/student/assignments",
    label: "Задания",
    icon: ClipboardCheck,
  },
  { href: "/dashboard/student/grades", label: "Оценки", icon: Star },
  {
    href: "/dashboard/student/notifications",
    label: "Уведомления",
    icon: Bell,
  },
];

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceShell
      role="student"
      title="Мой учебный кабинет"
      subtitle="План на сегодня, дедлайны и ваш прогресс"
      navItems={sidebarItems}
      defaultName="Студент"
      initialsFallback="S"
    >
      {children}
    </WorkspaceShell>
  );
}
