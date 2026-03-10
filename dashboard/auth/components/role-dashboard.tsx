"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
type UserRole = "student" | "teacher" | "admin";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface RoleDashboardProps {
  expectedRole: UserRole;
  title: string;
  subtitle: string;
  permissions: string[];
}

export function RoleDashboard({
  expectedRole: _expectedRole,
  title,
  subtitle,
  permissions,
}: RoleDashboardProps) {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-xl border bg-card p-6">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
        </header>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Ваши права</h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {permissions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <div className="flex items-center gap-3">
          <Button onClick={() => router.push("/")}>На главную</Button>
          <Button
            variant="outline"
            onClick={async () => {
              await fetch(`${API_URL}/api/auth/logout`, {
                method: "POST",
                credentials: "include",
              });
              router.replace("/");
            }}
          >
            Выйти
          </Button>
        </div>
      </div>
    </main>
  );
}
