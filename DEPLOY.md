# Деплой на Cloudflare Pages — 5 минут

## Что внутри

```
quiz-site/
├── index.html              ← фронт (без ключей)
└── functions/api/
    └── questions.js        ← serverless-функция, хранит ключ в env
```

Когда браузер запрашивает `/api/questions`, Cloudflare запускает функцию,
она читает `OPENAI_API_KEY` из переменных окружения и ходит в OpenAI.
Ключ в HTML не попадает.

## Шаги

### 1. Заведи аккаунт Cloudflare
https://dash.cloudflare.com/sign-up (бесплатно).

### 2. Создай Pages-проект
Dashboard → **Workers & Pages** → **Create** → вкладка **Pages** →
**Upload assets** (это вариант без git, самый быстрый).

- Project name: например `quiz-duel`
- Перетащи **всю папку `quiz-site/`** в окно загрузки
  (важно: чтобы загрузились и `index.html`, и `functions/`)
- Жми **Deploy site**

Через ~30 секунд получишь URL вида `https://quiz-duel.pages.dev`.

### 3. Добавь ключ OpenAI в environment variables
В проекте → **Settings** → **Environment variables** → **Add variable**:

- Variable name: `OPENAI_API_KEY`
- Value: твой новый ключ (создай свежий на https://platform.openai.com/api-keys)
- Type: **Secret** (важно — тогда он зашифрован)
- Environment: **Production**

Сохрани → нажми **Retry deployment** (или сделай любой пуш), чтобы переменная подхватилась.

### 4. Проверь
Открой `https://<твой-проект>.pages.dev`, введи тему, начни игру.
Если открыть DevTools → Network — увидишь запрос на `/api/questions`,
а ключа OpenAI в нём не будет.

---

## Обновление сайта

Просто загрузи папку заново через **Create deployment** → выбери проект.

## Через CLI (опционально)

```bash
npm install -g wrangler
wrangler login
cd quiz-site
wrangler pages deploy . --project-name=quiz-duel
# ключ задаётся так:
wrangler pages secret put OPENAI_API_KEY --project-name=quiz-duel
```

---

## Защита кошелька

Сейчас любой может зайти на твой сайт и нагенерировать тебе счёт.
Минимум что стоит сделать:

1. **На OpenAI** → Settings → Limits → выставь **Monthly budget** $5–10.
   Дальше OpenAI просто перестанет отвечать.
2. **На Cloudflare** → Security → WAF → Rate limiting rules:
   например, не больше 10 запросов в минуту с одного IP на `/api/*`.
3. Если хочешь чтобы сайтом пользовался только узкий круг — добавь
   в `questions.js` проверку секретного query-параметра или
   Basic Auth через middleware.

---

## Локальная разработка с функциями

```bash
npm install -g wrangler
cd quiz-site
echo "OPENAI_API_KEY=sk-..." > .dev.vars   # НЕ коммить!
wrangler pages dev .
# открой http://localhost:8788
```
