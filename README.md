# SubTracker - Умный трекер подписок

Полнофункциональное веб-приложение для отслеживания подписок с серверлесс-архитектурой на Netlify.

## Функционал

### Управление подписками
- ✅ CRUD-операции для подписок (название, стоимость, периодичность, дата списания, категория, цвет/иконка)
- ✅ Дашборд с фильтрами по периодам и суммарной статистикой
- ✅ Визуальная шкала времени (таймлайн) ближайших списаний
- ✅ Категоризация подписок с цветовой индикацией

### Система монетизации
- ✅ Бесплатный тариф: максимум 5 активных подписок
- ✅ Premium (10₽ навсегда): неограниченные подписки, экспорт CSV, детальная аналитика
- ✅ Оплата через QR-код СБП

### Аутентификация
- ✅ Регистрация с валидацией email
- ✅ JWT-аутентификация (access + refresh tokens)
- ✅ Хеширование паролей (bcrypt)
- ✅ Профиль пользователя

### Дополнительные фичи
- ✅ Smart Notifications (за 3 и 1 день до списания)
- ✅ Калькулятор экономии ("что если" сценарии)
- ✅ PWA-ready (service worker, манифест)
- ✅ Анимированные графики (Canvas-based)
- ✅ Drag-and-drop сортировка
- ✅ Темная/светлая тема

## Технологии

### Frontend
- Vanilla JavaScript (ES6 modules)
- CSS3 с переменными (темы)
- Canvas API для графиков
- PWA (Service Worker, Manifest)

### Backend
- Netlify Functions (serverless)
- Neon PostgreSQL
- JWT для аутентификации
- bcrypt для хеширования

## Установка и запуск

### Локальная разработка

1. Клонировать репозиторий:
```bash
git clone <repo-url>
cd subtracker
```

2. Установить зависимости:
```bash
npm install
```

3. Настроить переменные окружения:
```bash
# Создать файл .env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
```

4. Запустить миграции:
```bash
npm run migrate
```

5. Запустить локальный сервер:
```bash
npm run dev
```

### Деплой на Netlify

1. Подключить репозиторий к Netlify
2. Настроить переменные окружения в панели Netlify:
   - `DATABASE_URL` - URL подключения к Neon PostgreSQL
   - `JWT_SECRET` - секретный ключ для JWT
3. Деплой произойдет автоматически

### Настройка базы данных (Neon)

1. Создать проект на [Neon](https://neon.tech)
2. Получить строку подключения
3. Добавить в переменные окружения Netlify
4. Миграции выполнятся автоматически при первом запуске

## Структура проекта

```
subtracker/
├── netlify/
│   └── functions/          # Serverless функции
│       ├── auth-*.js       # Аутентификация
│       ├── subscriptions.js # CRUD подписок
│       ├── categories.js   # Категории
│       ├── user-profile.js # Профиль пользователя
│       ├── premium-*.js    # Premium функции
│       ├── stats.js        # Статистика
│       ├── export-csv.js   # Экспорт данных
│       └── utils/          # Утилиты
├── public/                 # Статические файлы
│   ├── css/               # Стили
│   ├── js/                # JavaScript модули
│   ├── assets/            # Иконки и изображения
│   ├── index.html         # Главная страница
│   ├── manifest.json      # PWA манифест
│   └── sw.js              # Service Worker
├── db/
│   ├── schema.sql         # Схема базы данных
│   └── migrate.js         # Скрипт миграций
├── netlify.toml           # Конфигурация Netlify
└── package.json
```

## API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/auth/refresh` - Обновление токена
- `POST /api/auth/logout` - Выход

### Подписки
- `GET /api/subscriptions` - Список подписок
- `POST /api/subscriptions` - Создать подписку
- `PUT /api/subscriptions/:id` - Обновить подписку
- `DELETE /api/subscriptions/:id` - Удалить подписку
- `PUT /api/subscriptions/:id/reorder` - Изменить порядок

### Категории
- `GET /api/categories` - Список категорий
- `POST /api/categories` - Создать категорию
- `PUT /api/categories/:id` - Обновить категорию
- `DELETE /api/categories/:id` - Удалить категорию

### Пользователь
- `GET /api/user/profile` - Профиль
- `PUT /api/user/change-password` - Сменить пароль
- `DELETE /api/user/delete-account` - Удалить аккаунт

### Premium
- `POST /api/premium/generate` - Сгенерировать платеж
- `POST /api/premium/verify` - Подтвердить оплату

### Статистика и экспорт
- `GET /api/stats` - Статистика
- `GET /api/export/csv` - Экспорт в CSV

## Лицензия

MIT
