"use client";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const dynamic = "force-dynamic";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const isResetSuccess = searchParams.get("reset") === "1";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      try {
        const response = await fetch(`${API_URL}/api/me`, {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          user?: { role?: "student" | "teacher" | "admin" };
        };
        const role = data.user?.role;
        if (cancelled || !role) {
          return;
        }

        const destination =
          role === "admin"
            ? "/dashboard/admin"
            : role === "teacher"
              ? "/dashboard/teacher"
              : "/dashboard/student";

        window.location.assign(destination);
      } catch {
        // Ignore session probe failures and keep user on login.
      }
    };

    void redirectIfAuthenticated();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = (await response.json()) as {
        message?: string;
        user?: {
          id: string;
          fullName: string;
          email: string;
          phone: string;
          role: "student" | "teacher" | "admin";
        };
      };

      if (!response.ok || !data.user) {
        setError(data.message ?? "Не удалось выполнить вход");
        setLoading(false);
        return;
      }

      const destination =
        data.user.role === "admin"
          ? "/dashboard/admin"
          : data.user.role === "teacher"
            ? "/dashboard/teacher"
            : "/dashboard/student";

      // Use full-page navigation to avoid cookie race conditions after cross-origin login.
      window.location.assign(destination);
    } catch {
      setError("Сервер недоступен. Убедитесь, что API запущен на порту 4000.");
    } finally {
      setLoading(false);
    }
  };

  const openForgotModal = () => {
    setIsForgotModalOpen(true);
    setResetEmail("");
    setResetError("");
  };

  const closeForgotModal = () => {
    if (isSendingReset) {
      return;
    }
    setIsForgotModalOpen(false);
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetError("");
    setForgotSuccessMessage("");
    setIsSendingReset(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setResetError(data.message ?? "Не удалось отправить письмо");
        return;
      }

      const backendMessage = data.message?.trim();
      setForgotSuccessMessage(
        backendMessage && backendMessage.toLowerCase() !== "success"
          ? backendMessage
          : "Вам на почту выслана ссылка для сброса пароля",
      );
      setIsForgotModalOpen(false);
      setResetEmail("");
    } catch {
      setResetError("Ошибка сети. Попробуйте снова.");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <section className="hidden lg:flex items-center justify-center border-r bg-muted/30">
        <div className="max-w-sm space-y-4 text-center p-8">
          <div className="mx-auto flex justify-center">
            <BrandMark />
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900">
            <Link href="/">
              С возвращением!{" "}
              <span className="text-blue-700 text-2xl">
                Войдите в свой аккаунт
              </span>
            </Link>
          </h1>
          <p className="text-base leading-7 text-slate-600">
            Учитесь быстрее с трекингом прогресса, курсами и практикой.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Вход в аккаунт</CardTitle>
            <CardDescription>
              Введите электронную почту или телефон и пароль.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="identifier">Email или телефон</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="электронная почта или телефон"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <div className="pt-1 text-right">
                  <button
                    type="button"
                    className="text-sm text-primary underline-offset-4 hover:underline"
                    onClick={openForgotModal}
                  >
                    Забыли пароль?
                  </button>
                </div>
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {isResetSuccess ? (
                <p className="text-sm text-emerald-700">
                  Пароль успешно сброшен. Войдите с новым паролем.
                </p>
              ) : null}
              {forgotSuccessMessage ? (
                <p className="text-sm text-emerald-700">
                  {forgotSuccessMessage}
                </p>
              ) : null}
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Вход..." : "Войти"}
              </Button>
              <Separator />
              <p className="text-sm text-muted-foreground text-center">
                Нет аккаунта?{" "}
                <Link
                  href="/register"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Зарегистрироваться
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </section>

      {isForgotModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Восстановление пароля
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Укажите зарегистрированную электронную почту.
            </p>

            <form className="mt-4 space-y-3" onSubmit={handleForgotPassword}>
              <Input
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                required
                disabled={isSendingReset}
              />

              {resetError ? (
                <p className="text-sm text-rose-600">{resetError}</p>
              ) : null}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={closeForgotModal}
                  disabled={isSendingReset}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
                  disabled={isSendingReset}
                >
                  {isSendingReset ? "Отправка..." : "Отправить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <LoginPageContent />
    </Suspense>
  );
}
