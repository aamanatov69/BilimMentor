# BilimMentor

BilimMentor — MVP обучающей системы (LMS) на Node.js + Next.js + React + Tailwind CSS + shadcn/ui.

## Структура

- `api` — backend API (Node.js, Express, TypeScript)
- `dashboard/auth` — интерфейс входа и регистрации
- `docs` — архитектурная и продуктовая документация

## Быстрый старт

### 1) API

```bash
cd api
npm install
npm run dev
```

Перед запуском заполните переменные в `api/.env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `CORS_ALLOWED_ORIGINS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `FRONTEND_URL` или `NEXT_PUBLIC_APP_URL`

Для production:

- Используйте надежный `JWT_SECRET` (без fallback значений)
- Установите `MAILER_ALLOW_FALLBACK=false`
- Укажите production-домен(ы) в `CORS_ALLOWED_ORIGINS` через запятую
- Применяйте миграции командой `npm run prisma:migrate:deploy`

API будет доступно по адресу `http://localhost:4000`.

### 2) Auth

```bash
cd dashboard/auth
npm install
npm run dev
```

Приложение будет доступно по адресу `http://localhost:3000`.

## MVP-функции

- Регистрация и вход пользователя
- Просмотр профиля и прогресса
- Каталог курсов
- Открытие курса и просмотр модулей
- Получение данных из API

## Тестовый API доступ

- `GET /health`
- `GET /api/courses`
- `GET /api/courses/:id`
- `POST /api/auth/register`
- `POST /api/auth/login`


