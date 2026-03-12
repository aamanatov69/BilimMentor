"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type ReportResponse = {
  generatedAt: string;
  coursesByCategory?: Record<string, number>;
};

export default function AdminSystemPage() {
  const [apiOnline, setApiOnline] = useState(false);
  const [dbSyncedAt, setDbSyncedAt] = useState("");
  const [coursesByCategory, setCoursesByCategory] = useState<
    Record<string, number>
  >({});
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSystem = async () => {

      try {
        const [healthRes, reportsRes] = await Promise.all([
          fetch(`${API_URL}/health`),
          fetch(`${API_URL}/api/admin/reports`, {
          credentials: "include",
          }),
        ]);

        const healthData = (await healthRes.json()) as { status?: string };
        const reportsData = (await reportsRes.json()) as ReportResponse & {
          message?: string;
        };

        setApiOnline(healthRes.ok && healthData.status === "ok");

        if (!reportsRes.ok) {
          setError(
            reportsData.message ?? "Не удалось загрузить системные данные",
          );
          return;
        }

        setDbSyncedAt(reportsData.generatedAt ?? "");
        setCoursesByCategory(reportsData.coursesByCategory ?? {});
      } catch {
        setError("Ошибка сети");
      }
    };

    void loadSystem();
  }, []);

  const serviceStatus = useMemo(
    () => [
      {
        service: "API-сервис",
        state: apiOnline ? "online" : "offline",
      },
      {
        service: "База данных",
        state: dbSyncedAt ? "online" : "offline",
      },
    ],
    [apiOnline, dbSyncedAt],
  );

  const systemLogs = useMemo(
    () =>
      Object.entries(coursesByCategory).map(([category, count]) => ({
        id: category,
        timestamp: dbSyncedAt ? new Date(dbSyncedAt).toLocaleString() : "-",
        service: "База данных",
        error: `Категория \"${category}\": ${count} курсов`,
      })),
    [coursesByCategory, dbSyncedAt],
  );

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold sm:text-2xl">Система</h1>
        <p className="mt-2 text-slate-600">
          Мониторинг состояния API и данных из БД.
        </p>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Статус сервисов</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {serviceStatus.map((item) => (
            <article
              key={item.service}
              className="rounded border border-slate-200 p-4"
            >
              <p className="text-sm text-slate-500">{item.service}</p>
              <p
                className={`mt-2 text-xl font-semibold ${item.state === "online" ? "text-emerald-700" : "text-rose-700"}`}
              >
                {item.state === "online" ? "Онлайн" : "Офлайн"}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Журнал данных БД</h2>
        <div className="mobile-scroll mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-3 font-medium">Время</th>
                <th className="py-2 pr-3 font-medium">Источник</th>
                <th className="py-2 pr-3 font-medium">Событие</th>
              </tr>
            </thead>
            <tbody>
              {systemLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100">
                  <td className="py-3 pr-3">{log.timestamp}</td>
                  <td className="py-3 pr-3">{log.service}</td>
                  <td className="py-3 pr-3">{log.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
