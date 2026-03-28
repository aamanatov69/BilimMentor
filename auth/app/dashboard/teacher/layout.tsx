"use client";

import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { Bell, BookOpen, GraduationCap, Home, Star, Users } from "lucide-react";

const sidebarItems = [
  { href: "/dashboard/teacher", label: "Главная", icon: Home, exact: true },
  { href: "/dashboard/teacher/courses", label: "Курсы", icon: BookOpen },
  { href: "/dashboard/teacher/students", label: "Студенты", icon: Users },
  { href: "/dashboard/teacher/grades", label: "Оценки", icon: Star },
  {
    href: "/dashboard/teacher/assignments",
    label: "Работы на проверку",
    icon: GraduationCap,
  },
  {
    href: "/dashboard/teacher/notifications",
    label: "Уведомления",
    icon: Bell,
  },
];

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceShell
      role="teacher"
      title="Рабочее место преподавателя"
      subtitle="Курсы, проверка работ и прогресс студентов"
      navItems={sidebarItems}
      defaultName="Преподаватель"
      initialsFallback="T"
    >
      {children}
    </WorkspaceShell>
  );
}
