# Архитектура BilimMentor

## Контекст

Система состоит из backend API и нескольких frontend-приложений dashboard.

## Компоненты

### 1. API (`/api`)

- Express + TypeScript
- REST endpoints для авторизации и курсов
- In-memory хранилище для MVP

### 2. Auth UI (`/dashboard/auth`)

- Next.js App Router
- Формы Login/Register
- Современный UI на Tailwind + shadcn/ui

## Поток данных

1. Пользователь регистрируется или входит в auth UI.
2. Auth UI отправляет запросы в API.

## Следующий этап

- Подключить БД (PostgreSQL + Prisma)
- Добавить JWT/refresh токены
- Добавить роли (student, teacher, admin)


