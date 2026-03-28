"use client";

import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import {
  Bell,
  BookOpen,
  FileBarChart,
  Home,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

const sidebarItems = [
  { href: "/dashboard/admin", label: "Главная", icon: Home, exact: true },
  { href: "/dashboard/admin/users", label: "Пользователи", icon: Users },
  { href: "/dashboard/admin/courses", label: "Курсы", icon: BookOpen },
  { href: "/dashboard/admin/reports", label: "Отчеты", icon: FileBarChart },
  { href: "/dashboard/admin/requests", label: "Заявки", icon: UserCog },
  { href: "/dashboard/admin/system", label: "Система", icon: ShieldCheck },
  { href: "/dashboard/admin/settings", label: "Настройки", icon: Settings },
  {
    href: "/dashboard/admin/notifications",
    label: "Уведомления",
    icon: Bell,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceShell
      role="admin"
      title="Панель администратора"
      subtitle="Пользователи, заявки и состояние системы"
      navItems={sidebarItems}
      defaultName="Администратор"
      initialsFallback="A"
    >
      {children}
    </WorkspaceShell>
  );
}
