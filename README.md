# MAX Chat — веб-чат для MAX на GREEN-API

Тестовое задание: интерфейс для отправки и получения текстовых сообщений в мессенджере
[MAX](https://green-api.com/max) через [GREEN-API](https://green-api.com/v3/docs/).
Внешний вид взят с [web.max.ru](https://web.max.ru/): список чатов слева, переписка справа.

**Стек:** React 19, TypeScript, Vite, CSS Modules, Vitest + Testing Library.
Бэкенд не нужен — GREEN-API отдаёт CORS-заголовки, браузер ходит в API напрямую.

## Запуск

Нужен Node.js 20.19+ или 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Сборка для продакшена: `npm run build` → статика в `dist/`, её можно положить на любой хостинг.

## Как пользоваться

1. Введите `idInstance` и `apiTokenInstance` со страницы инстанса в
   [личном кабинете GREEN-API](https://console.green-api.com). Адрес API подставляется сам по
   номеру инстанса (`3100123456` → `https://3100.api.green-api.com`); если в кабинете указан
   другой `apiUrl`, нажмите «изменить».
2. Введите номер получателя (`+7 999 123-45-67`, `8 999 …`, `79991234567` — подойдёт любой формат)
   и нажмите стрелку — откроется новый чат.
3. Напишите сообщение и нажмите Enter (Shift+Enter — перенос строки).
4. Когда получатель ответит в MAX, ответ появится в этом же чате.

### Подготовка инстанса

1. Создайте инстанс MAX в личном кабинете GREEN-API (тариф Developer бесплатный).
2. Авторизуйте его: в приложении MAX «Профиль → Устройства» → отсканируйте QR-код со страницы инстанса.
3. Уведомления о входящих у нового инстанса выключены. Приложение само проверит настройки
   (`getSettings`) и включит недостающие (`setSettings`: `incomingWebhook`, `outgoingWebhook`,
   `outgoingMessageWebhook`). GREEN-API применяет настройки до нескольких минут — об этом
   появится подсказка в сайдбаре.
4. Поле `webhookUrl` должно быть пустым: иначе уведомления уходят на вебхук, а не в очередь HTTP API.
   Чужой вебхук приложение не стирает, а показывает предупреждение.

## Пункты задания

| Требование | Где в коде |
| --- | --- |
| Ввод `idInstance` и `apiTokenInstance` | [`LoginScreen.tsx`](src/components/LoginScreen.tsx) — проверка через `getStateInstance` с понятными ошибками |
| Ввод номера и создание чата | [`NewChatForm.tsx`](src/components/NewChatForm.tsx), [`phone.ts`](src/lib/phone.ts), [`resolveChatId.ts`](src/lib/resolveChatId.ts) |
| Отправка — [`SendMessage`](https://green-api.com/v3/docs/api/sending/SendMessage/) | [`greenApi.ts`](src/api/greenApi.ts) `sendMessage`, [`Messenger.tsx`](src/components/Messenger.tsx) |
| Получение — [HTTP API](https://green-api.com/v3/docs/api/receiving/technology-http-api/) | [`notificationLoop.ts`](src/lib/notificationLoop.ts), [`useNotificationPolling.ts`](src/hooks/useNotificationPolling.ts) |
| Ответ получателя виден в чате | [`notifications.ts`](src/lib/notifications.ts) → [`chats.ts`](src/state/chats.ts) |
| Внешний вид как у web.max.ru | [`index.css`](src/index.css) (палитра, светлая и тёмная тема) и CSS-модули компонентов |

## Как это работает

### Номер → chatId

В MAX сообщения адресуются по внутреннему числовому `chatId` пользователя, а не по номеру.
Поэтому при создании чата номер отправляется в `CheckAccount`: он возвращает `chatId` или
сообщает, что у номера нет MAX. Входящие приходят с тем же `chatId`, и ответ попадает в нужный чат.
Если у инстанса нет `CheckAccount` (ответ 404 — например, WhatsApp-инстанс), используется `номер@c.us`.

### Приём сообщений

```
┌─► ReceiveNotification?receiveTimeout=20   long polling: сервер держит запрос до 20 с
│        │ пусто (null или 408) ────────────────┐
│        ▼ уведомление                          │
│   входящий текст        → в чат (незнакомый собеседник → новый чат)
│   исходящий с телефона  → в чат как своё сообщение
│   статус отправленного  → галочки: отправлено / доставлено / прочитано
│   всё остальное         → пропускаем          │
│        ▼                                      │
│   DeleteNotification/{receiptId}   всегда — иначе очередь встанет на этом уведомлении
└────────┴──────────────────────────────────────┘
```

- Сеть или 5xx — повтор с паузой 1 → 2 → 4 … 30 с, на 429 — не меньше 5 с. Пока связи нет,
  в сайдбаре висит плашка.
- 401/403 — цикл останавливается: креды больше не действуют.
- При выходе и размонтировании текущий запрос отменяется через `AbortController`.
- Уведомление может прийти дважды (если `DeleteNotification` не дошёл) — сообщения
  дедуплицируются по `idMessage`.

### Отправка

Сообщение сразу появляется в ленте с часиками, после ответа `SendMessage` получает настоящий
`idMessage` и одну галочку. Дальше статусы обновляет `outgoingMessageStatus`. Если отправка
не удалась, под сообщением есть кнопка «Повторить».

## Структура

```
src/
├── api/
│   ├── greenApi.ts            клиент HTTP API и тексты ошибок
│   └── types.ts               типы запросов и уведомлений
├── components/                экраны и компоненты, CSS-модули рядом
│   ├── LoginScreen.tsx        вход и проверка инстанса
│   ├── Messenger.tsx          связывает состояние, API и приём уведомлений
│   ├── Sidebar.tsx            список чатов, новый чат, статус связи, выход
│   ├── ChatView.tsx           шапка, лента, поле ввода
│   ├── MessageList.tsx        лента с разделителями дней и автопрокруткой
│   ├── MessageBubble.tsx      сообщение со временем и статусом
│   └── Composer.tsx           поле ввода: Enter — отправить
├── hooks/useNotificationPolling.ts
├── lib/
│   ├── notificationLoop.ts    receive → обработка → delete, повторы с паузой
│   ├── notifications.ts       уведомление GREEN-API → событие чата
│   ├── receiving.ts           включение уведомлений в настройках инстанса
│   ├── resolveChatId.ts       номер → chatId
│   ├── phone.ts, format.ts    номер телефона, даты и время
│   └── storage.ts             localStorage
└── state/chats.ts             чаты и сообщения (useReducer)
```

## Проверки

```bash
npm test           # Vitest: 51 тест
npm run typecheck  # TypeScript
npm run lint       # oxlint
npm run build
```

Тесты покрывают клиент API (адреса, 408, ошибки), разбор уведомлений, редьюсер (статусы,
дедупликация, новый собеседник, порядок сообщений), цикл приёма (удаление, повторы, 429, 401)
и сквозной сценарий в UI на поддельном GREEN-API: вход → чат по номеру → отправка → ответ получателя.

## Ограничения

- Только текстовые сообщения: фото, стикеры и прочее удаляются из очереди без показа.
- История хранится в `localStorage` браузера (отдельно для каждого инстанса): эти методы
  GREEN-API историю не отдают, а бэкенда у приложения нет.
- `idInstance` и `apiTokenInstance` тоже лежат в `localStorage`, чтобы не вводить их после
  перезагрузки, и никуда, кроме GREEN-API, не отправляются. «Выйти» стирает креды.
