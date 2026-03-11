import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Страница не найдена</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Похоже, такой страницы не существует или она была перемещена.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            На главную
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Войти
          </Link>
        </div>
      </div>
    </main>
  );
}
