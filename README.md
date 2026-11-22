# REST API Дошки оголошень

Домашнє завдання №2 курсу «Fullstack Back End Development: Node.js».

REST API для дошки оголошень: JWT-автентифікація з refresh токенами (token rotation), CRUD оголошень з перевіркою ownership, валідація Zod та документація OpenAPI (Swagger UI).

Чистий JSON API без рендерингу HTML. Анонімні відвідувачі бачать список оголошень і деталі кожного з них. Створювати оголошення можуть лише зареєстровані користувачі, а редагувати й видаляти — лише власні.

## Технологічний стек

| Технологія                     | Опис                            |
| ------------------------------ | ------------------------------- |
| Node.js + TypeScript (tsx)     | Середовище виконання            |
| Express 5                      | Веб-фреймворк                   |
| Prisma 7 + PostgreSQL          | ORM та база даних               |
| Zod 4                          | Валідація вхідних даних         |
| bcrypt                         | Хешування паролів               |
| jsonwebtoken                   | JWT (access 15 хв, refresh 7 днів) |
| @asteasolutions/zod-to-openapi | Генерація OpenAPI документації  |
| swagger-ui-express             | Swagger UI на `/api-docs`       |

## Запуск

1. Встановіть залежності:

   ```bash
   npm install
   ```

2. Запустіть PostgreSQL (Docker):

   ```bash
   docker compose up -d
   ```

   Якщо порт 5432 зайнятий: `DB_PORT=5433 docker compose up -d` і змініть порт у `DATABASE_URL`.

3. Створіть `.env`:

   ```bash
   cp .env.example .env
   ```

   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/announcements?schema=public
   JWT_SECRET=your_secret_key_here
   PORT=3000
   ```

4. Застосуйте міграцію та згенеруйте Prisma Client:

   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

5. Запустіть сервер:

   ```bash
   npm run dev
   ```

Документація: http://localhost:3000/api-docs (JSON-специфікація: `/api-docs.json`).

## Скрипти

| Команда                   | Опис                                          |
| ------------------------- | --------------------------------------------- |
| `npm run dev`             | Запуск з hot reload                           |
| `npm start`               | Запуск                                        |
| `npm run prisma:migrate`  | Створення та застосування міграцій            |
| `npm run prisma:generate` | Генерація Prisma Client                       |
| `npm run prisma:deploy`   | Застосування наявних міграцій                 |
| `npm run db:up`           | Запуск PostgreSQL у Docker                    |
| `npm run typecheck`       | Перевірка типів TypeScript                    |
| `npm run test:e2e`        | E2E-перевірка всіх маршрутів (сервер має бути запущений) |

## Маршрути

### Auth

| Метод | Шлях             | Опис                                         | Auth |
| ----- | ---------------- | -------------------------------------------- | ---- |
| POST  | `/auth/register` | Реєстрація, повертає пару токенів            | Ні   |
| POST  | `/auth/login`    | Вхід, старий refresh token замінюється новим | Ні   |
| POST  | `/auth/refresh`  | Нова пара токенів (token rotation)           | Ні   |
| POST  | `/auth/logout`   | Видаляє refresh token користувача, 204       | Так  |
| GET   | `/auth/me`       | Профіль поточного користувача                | Так  |

### Оголошення

| Метод  | Шлях                 | Опис                                      | Auth |
| ------ | -------------------- | ----------------------------------------- | ---- |
| GET    | `/announcements`     | Список з пагінацією, пошуком, сортуванням | Ні   |
| GET    | `/announcements/:id` | Деталі оголошення з даними автора         | Ні   |
| POST   | `/announcements`     | Створення (автор береться з токена)       | Так  |
| PATCH  | `/announcements/:id` | Часткове оновлення (лише власне)          | Так  |
| DELETE | `/announcements/:id` | Видалення (лише власне), 204              | Так  |

Захищені маршрути вимагають заголовок `Authorization: Bearer <accessToken>`.

### GET /announcements — query-параметри

| Параметр | Опис                                                   |
| -------- | ------------------------------------------------------ |
| `search` | Пошук підрядка в `title`, нечутливий до регістру       |
| `sort`   | `newest` (за замовчуванням) або `oldest`               |
| `page`   | Номер сторінки (ціле число > 0), 10 записів на сторінку |

```json
{
  "data": [ { "id": 5, "title": "...", "user": { "id": 1, "username": "..." } } ],
  "pagination": { "total": 23, "page": 2, "totalPages": 3, "perPage": 10 }
}
```

## Валідація

| Поле (register) | Вимоги                                  |
| --------------- | --------------------------------------- |
| `username`      | рядок, обов'язковий, 3–30 символів      |
| `email`         | email, обов'язковий                     |
| `password`      | рядок, обов'язковий, мінімум 6 символів |
| `name`          | рядок, обов'язковий, мінімум 2 символи  |

| Поле (announcement) | Вимоги                                               |
| ------------------- | ---------------------------------------------------- |
| `title`             | рядок, обов'язковий, 5–50 символів                   |
| `description`       | рядок, обов'язковий, мінімум 10 символів             |
| `price`             | число, обов'язкове, більше нуля                      |
| `category`          | одне з: `sale`, `service`, `job`, `other`            |

PATCH використовує ті самі правила, але всі поля опціональні; порожній `{}` відхиляється.

Помилка валідації повертає `400`:

```json
{
  "error": "Validation failed",
  "details": { "body": ["username: Username must be at least 3 characters"] }
}
```

## Коди відповідей

| Код | Коли                                                                       |
| --- | -------------------------------------------------------------------------- |
| 400 | Помилка валідації body / params / query або некоректний JSON               |
| 401 | Немає токена, токен невалідний чи прострочений; `Invalid credentials` при вході |
| 403 | `Access denied` — спроба змінити або видалити чуже оголошення              |
| 404 | Оголошення не знайдено                                                     |
| 409 | `Username or email already taken`                                          |

## Структура проєкту

```
├── prisma/
│   ├── schema.prisma          # моделі User, RefreshToken, Announcement
│   ├── client.ts              # Prisma Client (adapter-pg)
│   └── migrations/            # міграція init
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   └── announcements.controller.ts
│   ├── middleware/
│   │   ├── authenticate.ts    # Bearer JWT → req.user (+ declare global)
│   │   └── validate.ts        # validateBody / validateParams / validateQuery
│   ├── routes/                # маршрути + registry.registerPath()
│   │   ├── auth.routes.ts
│   │   └── announcements.routes.ts
│   ├── validators/            # Zod-схеми запитів і відповідей
│   │   ├── auth.validator.ts
│   │   └── announcements.validator.ts
│   ├── utils/tokens.ts        # генерація та перевірка JWT
│   └── openapi.ts             # registry + bearerAuth
├── tests/e2e.mjs              # e2e-перевірка всіх маршрутів
├── app.ts
├── docker-compose.yml
├── .env.example
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

## Prisma schema

- `User` — `username` (унікальний), `email` (унікальний), хешований `password`, `name`, `createdAt`; зв'язки з `Announcement[]` та `RefreshToken[]`
- `RefreshToken` — `token` (унікальний), зв'язок з `User`
- `Announcement` — `title`, `description`, `price`, `category` (enum), обов'язковий зв'язок з `User`, `createdAt`, `updatedAt` (`@updatedAt`)
