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
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type RegisterRole = "student" | "teacher";

function normalizeKgPhoneDigits(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  const withoutCountryCode = digitsOnly.startsWith("996")
    ? digitsOnly.slice(3)
    : digitsOnly;
  return withoutCountryCode.slice(0, 9);
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseInviteToken = searchParams.get("courseInvite")?.trim() ?? "";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<RegisterRole>("student");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  useEffect(() => {
    if (courseInviteToken) {
      setRole("student");
    }
  }, [courseInviteToken]);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const normalizedFullName = fullName.trim();
    const normalizedEmail = email.trim();
    const normalizedPhoneDigits = normalizeKgPhoneDigits(phone);
    const normalizedPhone = `+996${normalizedPhoneDigits}`;

    if (!normalizedFullName || !normalizedEmail || !normalizedPhoneDigits) {
      setError("Заполните все обязательные поля");
      return;
    }

    if (!role) {
      setError("Выберите роль аккаунта");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Введите пароль и подтверждение пароля");
      return;
    }

    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов");
      return;
    }

    if (passwordsMismatch) {
      setError("Пароли не совпадают");
      return;
    }

    if (!/^\d{9}$/.test(normalizedPhoneDigits)) {
      setError("Введите 9 цифр номера телефона без кода страны");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: normalizedFullName,
          email: normalizedEmail,
          phone: normalizedPhone,
          role,
          password,
          courseInviteToken: courseInviteToken || undefined,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        token?: string;
        user?: {
          id: string;
          fullName: string;
          email: string;
          phone: string;
          role: "student" | "teacher" | "admin";
        };
      };

      if (!response.ok || !data.user) {
        setError(data.message ?? "Не удалось завершить регистрацию");
        setLoading(false);
        return;
      }

      if (data.user.role === "teacher") {
        router.push("/dashboard/teacher");
      } else {
        router.push("/dashboard/student");
      }
    } catch {
      setError("Ошибка сети. Убедитесь, что API запущен на порту 4000.");
    } finally {
      setLoading(false);
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
              Начните своё образовательное путешествие с{" "}
              <span className="text-blue-700">BilimMentor</span>
            </Link>
          </h1>

          <p className="text-base leading-7 text-slate-600">
            Учитесь быстрее с курсами, практикой и отслеживанием прогресса.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Регистрация</CardTitle>
            <CardDescription>
              Заполните форму для создания личного кабинета.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="space-y-2">
                <Label htmlFor="fullName">Имя и фамилия</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Имя и фамилия"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Электронная почта</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Электронная почта"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Номер телефона</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="500 000 000"
                  value={phone}
                  onChange={(event) =>
                    setPhone(normalizeKgPhoneDigits(event.target.value))
                  }
                  inputMode="numeric"
                  maxLength={9}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Введите ваш номер телефона.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Роль аккаунта</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as RegisterRole)
                  }
                  disabled={Boolean(courseInviteToken)}
                  className="flex h-10 w-full rounded-md border bg-input px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  required
                >
                  <option value="student">Студент</option>
                  <option value="teacher">Преподаватель</option>
                </select>
                {courseInviteToken ? (
                  <p className="text-xs text-emerald-700">
                    Регистрация выполняется по приглашению на курс. Роль
                    студента выбрана автоматически, доступ к курсу откроется
                    сразу после создания аккаунта.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Минимум 8 символов"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                    aria-label={
                      showPassword ? "Скрыть пароль" : "Показать пароль"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Подтверждение пароля</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                    aria-label={
                      showConfirmPassword
                        ? "Скрыть подтверждение пароля"
                        : "Показать подтверждение пароля"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordsMismatch ? (
                  <p className="text-xs text-rose-600">Пароли не совпадают</p>
                ) : null}
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <Button
                className="w-full"
                type="submit"
                disabled={loading || passwordsMismatch}
              >
                {loading ? "Регистрация..." : "Создать аккаунт"}
              </Button>
              <Separator />
              <p className="text-sm text-muted-foreground text-center">
                Уже есть аккаунт?{" "}
                <Link
                  href="/login"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Войти
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
