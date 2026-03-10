"use client";

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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const dynamic = "force-dynamic";

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const validateToken = async () => {
      if (!token) {
        if (!isMounted) {
          return;
        }

        setError("Ссылка недействительна: отсутствует токен.");
        setIsTokenValid(false);
        setIsCheckingToken(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
        );
        const data = (await response.json()) as { message?: string };

        if (!isMounted) {
          return;
        }

        if (!response.ok) {
          setError(data.message?? "Ссылка для сброса недействительна");
          setIsTokenValid(false);
          return;
        }

        setError("");
        setIsTokenValid(true);
      } catch {
        if (!isMounted) {
          return;
        }
        setError("Не удалось проверить ссылку. Попробуйте позже.");
        setIsTokenValid(false);
      } finally {
        if (isMounted) {
          setIsCheckingToken(false);
        }
      }
    };

    void validateToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password!== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message?? "Не удалось обновить пароль");
        return;
      }

      setSuccess(data.message?? "Пароль успешно обновлен");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        router.push("/login?reset=1");
      }, 1000);
    } catch {
      setError("Ошибка сети. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Новый пароль</CardTitle>
          <CardDescription>
            {isCheckingToken? "Проверка ссылки...": isTokenValid? "Введите новый пароль и подтверждение.": "Ссылка недействительна или уже использована."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleReset}>
            <div className="space-y-2">
              <Label htmlFor="new-password">Новый пароль</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={!isTokenValid || isCheckingToken}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Подтверждение пароля</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                disabled={!isTokenValid || isCheckingToken}
              />
            </div>

            {error? <p className="text-sm text-rose-600">{error}</p>: null}
            {success? (
              <p className="text-sm text-emerald-700">{success}</p>
            ): null}

            <Button
              type="submit"
              className="w-full"
              disabled={loading ||!isTokenValid || isCheckingToken}
            >
              {loading? "Сохранение...": "Сохранить"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">
                Вернуться ко входу
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
