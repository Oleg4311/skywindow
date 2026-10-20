# SkyWindow

Погода и веб-камеры восьми городов: React + TypeScript + Vite и NestJS.
Прогноз на пять дней, местное время, поиск города и камеры в радиусе 30 км.
Обновление данных каждые пять минут. Источники: Open-Meteo и Windy Webcams API v3.

## Локальный запуск

Нужны Node.js 22+ и npm.

```powershell
npm ci
Copy-Item apps/api/.env.example apps/api/.env
# Укажите WINDY_WEBCAMS_API_KEY в apps/api/.env
npm run dev
```

Сайт: http://localhost:5173. API: http://localhost:3001/api/health.
Без ключа погода работает, камеры показывают сообщение о настройке.
В Linux/macOS используйте `cp` вместо `Copy-Item`.

```sh
npm run typecheck
npm run build
npm test
npm start
```

После сборки `npm start` отдаёт API и фронтенд вместе на порту 3001 (или `PORT`).
Тесты запускаются после сборки и проверяют настоящий HTTP-сервер.

## Получение ключа

1. Откройте [Windy API Keys](https://api4.windy.com/keys), войдите или зарегистрируйтесь.
2. Создайте ключ **Webcams API**, выбрав подходящий тариф. Ключи Map Forecast и Point Forecast не подходят.
3. Активация может занять несколько минут. Проверьте ключ через **Authorize** в [документации](https://api4.windy.com/webcams/docs).
4. Локально добавьте `WINDY_WEBCAMS_API_KEY=ваш_ключ` в `apps/api/.env` и перезапустите API.
5. На Render добавьте ключ в **Environment → WINDY_WEBCAMS_API_KEY**, сохраните и дождитесь перезапуска.

Ключ используется только сервером. Не добавляйте его в `VITE_*`, исходники или GitHub Actions.
Open-Meteo для этого приложения отдельного ключа не требует.
Камеры могут показывать таймлапсы, запрещать встраивание или временно не работать;
используйте ссылку «Открыть источник» у выбранной камеры.
Для своего сценария проверьте [условия Windy](https://api4.windy.com/webcams/terms)
и [Open-Meteo](https://open-meteo.com/en/terms).

## Развёртывание через GitHub

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
размещает статические файлы. NestJS требует отдельного сервера:
фронтенд публикуется на GitHub Pages, API с ключом — на Render.
В репозитории подготовлены GitHub Actions и `render.yaml`.

### 1. Запустите API на Render

1. Войдите в [Render](https://dashboard.render.com/) через GitHub.
2. **New → Blueprint**: выберите `Oleg4311/skywindow`, ветку `main`.
3. Render прочитает `render.yaml`. Введите `WINDY_WEBCAMS_API_KEY`.
4. Проверьте `WEB_ORIGIN=https://oleg4311.github.io` — без `/skywindow/` и завершающего `/`.
5. Создайте сервис и дождитесь успешной сборки. Скопируйте HTTPS URL,
   например `https://skywindow-xxxx.onrender.com`.
6. Откройте `<URL>/api/health`: ожидается `{"ok":true}`.
   `<URL>/api/weather/krakow` возвращает погоду,
   `<URL>/api/cameras/krakow` — статус `ok` при рабочем ключе.

Сервис также отдаёт сайт по адресу Render. Бесплатный сервис может засыпать;
после пробуждения обновите страницу или нажмите «Повторить».
Актуальные условия смотрите в [документации Render](https://render.com/docs/web-services).

### 2. Опубликуйте фронтенд на GitHub Pages

1. В [репозитории](https://github.com/Oleg4311/skywindow) откройте **Settings → Pages**.
2. **Build and deployment → Source → GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   имя `VITE_API_URL`, значение — HTTPS URL Render без `/api`.
   Например `https://skywindow-xxxx.onrender.com`. Это публичный адрес, не ключ.
4. **Actions → Deploy GitHub Pages → Run workflow → main**.
5. После успешной публикации откройте **https://oleg4311.github.io/skywindow/**.

Следующие push в `main` автоматически проверяют проект и публикуют фронтенд.
До добавления `VITE_API_URL` публикация пропускается. При смене URL перезапустите workflow:
Vite подставляет его при сборке. Для другого владельца измените `WEB_ORIGIN` на Render.
Для собственного домена установите `VITE_BASE_PATH: /` в workflow.

## Переменные и API

| Переменная | Где | Назначение |
| --- | --- | --- |
| `WINDY_WEBCAMS_API_KEY` | API | Секрет камер |
| `WEB_ORIGIN` | API | Допустимые origins через запятую |
| `PORT` | API | По умолчанию 3001, Render задаёт сам |
| `VITE_API_URL` | Сборка фронтенда | URL API, пусто для одного домена |
| `VITE_BASE_PATH` | Сборка фронтенда | `/skywindow/` для Pages, иначе `/` |

API: `GET /api/health`, `/api/cities`, `/api/weather/:id`, `/api/cameras/:id`.
Неизвестный город: 404; недоступная погода: 503.
Статусы камер: `ok`, `configuration_required`, `provider_error`.
При проблемах проверьте URL API, CORS origin, логи Render, тип ключа и квоту Windy.
