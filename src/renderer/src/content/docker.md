# Docker: ایمیج، کانتینر و Compose

> مراجع: [Docker Docs](https://docs.docker.com/) · [Dockerfile Reference](https://docs.docker.com/reference/dockerfile/) · [Compose File](https://docs.docker.com/compose/compose-file/)

## در این درس چه یاد می‌گیرید؟

تفاوت ایمیج و کانتینر را می‌فهمید، Dockerfile چندمرحله‌ای بهینه و امن می‌نویسید، با Compose اپ + دیتابیس را بالا می‌آورید و مشکلات رایج (کش، مجوز، شبکه، حجم) را عیب‌یابی می‌کنید. در پایان، API و Postgres تمرین را با یک دستور اجرا می‌کنید.

---

## ۱. ایمیج، کانتینر، لایه

| مفهوم | تعریف |
| --- | --- |
| Image | بسته‌ی فقط‌خواندنی از فایل‌سیستم + متادیتا |
| Container | نمونه‌ی در حال اجرای ایمیج + لایه‌ی نوشتنی |
| Layer | هر دستور Dockerfile یک لایه |
| Registry | انبار ایمیج (Docker Hub، GHCR) |

هر دستور `RUN`/`COPY` یک لایه می‌سازد. اگر لایه‌ای تغییر کند، همه‌ی لایه‌های بعدی دوباره ساخته می‌شوند. بنابراین چیزهایی که کم تغییر می‌کنند (manifest و نصب وابستگی) باید **قبل** از کد قرار گیرند.

```dockerfile
COPY package*.json ./
RUN npm ci
COPY . .
```

برعکسش (اول کد، بعد نصب) باعث می‌شود هر تغییر کد، نصب وابستگی را از نو اجرا کند.

## ۲. Dockerfile چندمرحله‌ای برای Node

```dockerfile
# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

نکات:

- **multi-stage**: ابزار build در ایمیج نهایی نمی‌ماند؛ حجم و سطح حمله کم می‌شود.
- **`npm ci`** از lockfile دقیق نصب می‌کند.
- **`USER node`**: هرگز root نباشید.
- **dumb-init**: سیگنال‌ها (SIGTERM) درست به فرایند برسد و zombieها جمع شوند.
- **HEALTHCHECK** برای orchestrator.
- `--chown` از مالکیت root روی فایل‌ها جلوگیری می‌کند.

## ۳. `.dockerignore`

```
node_modules
dist
.git
.env
.env.*
*.log
coverage
tests
Dockerfile
docker-compose*.yml
```

بدون این فایل، `COPY . .` ممکن است `node_modules` محلی (با باینری پلتفرم اشتباه) و `.env` را بفرستد.

## ۴. ENV، ARG و راز

```dockerfile
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-slim

ENV PORT=3000
```

| | ARG | ENV |
| --- | --- | --- |
| زمان | build | build + runtime |
| در ایمیج نهایی | در تاریخچه می‌ماند | می‌ماند |
| برای راز | ❌ | ❌ |

راز را در build نگذارید. در Compose از `env_file`/`environment` و در production از secret manager استفاده کنید. هر `ARG`/`ENV` در `docker history` قابل مشاهده است.

## ۵. Compose: اپ + دیتابیس

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: tasks
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d tasks']
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: .
      target: runtime
    environment:
      DATABASE_URL: postgresql://app:devpass@db:5432/tasks
      NODE_ENV: production
    # در محیط واقعی:
    # env_file: .env
    # و مقادیر حساس از secret manager تزریق شود
    ports:
      - '3000:3000'
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgdata:
```

```bash
docker compose up --build
docker compose logs -f api
docker compose exec db psql -U app -d tasks
docker compose down            # داده می‌ماند
docker compose down -v         # volume هم پاک می‌شود
```

**شبکه:** سرویس‌ها با نام سرویس به هم وصل می‌شوند (`db:5432`)، نه `localhost`. هر سرویس名前‌فضای DNS خودش را دارد.

**named volume** برای داده‌ی دیتابیس؛ bind mount برای توسعه (کد زنده).

## ۶. دستورهای روزمره

```bash
docker build -t tasks-api:1.0.0 .
docker run --rm -p 3000:3000 --env-file .env tasks-api:1.0.0
docker ps -a
docker logs -f <id>
docker exec -it <id> sh
docker image prune -f
docker system df
```

برای معماری دیگر:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/acme/tasks:1.0.0 --push .
```

## ۷. عیب‌یابی رایج

| نشانه | علت | راه‌حل |
| --- | --- | --- |
| `ECONNREFUSED db:5432` | دیتابیس آماده نیست | `depends_on` با healthcheck |
| تغییر کد دیده نمی‌شود | کش لایه | ترتیب COPY / `--no-cache` |
| `Cannot find module` | `node_modules` کپی نشده | `npm ci` در ایمیج |
| permission denied | USER node + فایل root | `--chown` |
| ایمیج ۱GB | devDependencies | multi-stage + `npm prune` |
| SIGTERM کار نمی‌کند | PID 1، بدون init | dumb-init/`--init` |
| پورت اشغال | کانتینر قبلی | `docker ps` و stop |
| `.env` داخل ایمیج | بدون dockerignore | بخش ۳ |

## ۸. امنیت کانتینر

- ایمیج پایه‌ی رسمی و pin‌شده (digest یا تگ دقیق)، نه `latest` در production.
- کاربر non-root و `read_only: true` در صورت امکان.
- `security_opt: [no-new-privileges:true]`، drop capabilities.
- اسکن:

```bash
docker scout cves tasks-api:1.0.0
trivy image tasks-api:1.0.0
```

- تگ ایمیج را با نسخه/کامیت بزنید؛ `latest` قابل بازتولید نیست.
- اسرار را در متغیر محیطی طولانی‌عمر نگذارید؛ secret manager/Docker secrets.

## ۹. ساخت گام‌به‌گام کانتینری‌کردن API (تمرین)

**گام ۱ — پروژه:** API وظایف از درس Express (یا هر API با `/health`).

**گام ۲ — `.dockerignore`** بخش ۳.

**گام ۳ — Dockerfile** چندمرحله‌ای بخش ۲؛ build و اجرا.

**گام ۴ — تست محلی:** `docker run --rm -p 3000:3000 --env-file .env api:dev` و درخواست به `/health`.

**گام ۵ — Compose:** افزودن Postgres با volume و healthcheck.

**گام ۶ — migration:** در entrypoint یا job جدا `prisma migrate deploy` را قبل از شروع اجرا کنید (نه در هر request).

**گام ۷ — بهینه‌سازی:** حجم ایمیج قبل/بعد را با `docker images` مقایسه کنید.

**گام ۸ — امنیت:** USER غیر root، اسکن Trivy، حذف پکیج‌های اضافه.

**گام ۹ — مستند:** README با `docker compose up` و متغیرهای لازم.

### اجرای واقعی: build، compose و سلامت

```bash
docker build -t tasks-api:1.0.0 .
# [+] Building 18.4s (12/12) FINISHED
#  => [deps 2/3] COPY package.json package-lock.json ./
#  => [deps 3/3] RUN npm ci
#  => [build 4/4] RUN npm run build && npm prune --omit=dev
#  => [runtime 3/5] COPY --from=build /app/node_modules ./node_modules
#  => exporting to image
#  => => naming to docker.io/library/tasks-api:1.0.0

docker images tasks-api
# REPOSITORY   TAG     IMAGE ID       CREATED         SIZE
# tasks-api    1.0.0   a1b2c3d4e5f6   5 seconds ago   198MB

docker run --rm -p 3000:3000 --env-file .env tasks-api:1.0.0
# server listening on 3000

curl -s localhost:3000/health
# {"ok":true}
```

**Compose:**

```bash
docker compose up -d --build
# ✔ Network tasks_default  Created
# ✔ Container tasks-db-1   Healthy
# ✔ Container tasks-api-1  Started

docker compose ps
# NAME          IMAGE            STATUS                   PORTS
# tasks-api-1   tasks-api:latest Up 12 seconds (healthy)   0.0.0.0:3000->3000/tcp
# tasks-db-1    postgres:16      Up 18 seconds (healthy)   0.0.0.0:5432->5432/tcp

docker compose logs -f api
# api-1  | server listening on 3000
# api-1  | connected to postgres
```

**ایست بازرسی ۱ — کش:** یک فایل در `src/` را تغییر دهید و دوباره build کنید. خروجی باید نشان دهد لایه‌ی `npm ci` با `CACHED` رد شده و فقط لایه‌های کد دوباره اجرا شده‌اند. اگر `npm ci` دوباره اجرا شد، `COPY . .` قبل از آن است.

**ایست بازرسی ۲ — non-root:**

```bash
docker run --rm tasks-api:1.0.0 id
# uid=1000(node) gid=1000(node) groups=1000(node)
```

اگر `uid=0(root)` دیدید، `USER node` را جا انداخته‌اید.

**ایست بازرسی ۳ — حجم:** قبل و بعد از multi-stage مقایسه کنید:

```bash
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}'
# tasks-api:dev       1.12GB
# tasks-api:1.0.0     198MB
```

**ایست بازرسی ۴ — دیتابیس واقعاً آماده است:** `docker compose up` بدون `condition: service_healthy` معمولاً این خطا را می‌دهد:

```text
Error: P1001: Can't reach database server at `db:5432`
```

یعنی API قبل از Postgres بالا آمده؛ healthcheck و `depends_on` را اضافه کنید.

**ایست بازرسی ۵ — سیگنال:**

```bash
docker stop tasks-api-1
docker logs tasks-api-1 | tail -3
# SIGTERM: خاموشی…
# server closed
```

اگر هیچ لاگی نیست، `dumb-init` و handler سیگنال را بررسی کنید.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `multistage` | بخش ۲ و ۹ (COPY packageها قبل از سورس برای کش) |
| `non-root` | بخش ۲ و ۸ |
| `dockerignore` | بخش ۳ |
| `compose` | بخش ۵ (دو سرویس، volume، depends_on: service_healthy) |
| `config` | بخش ۴ و ۵ (env، بدون رمز واقعی) |

## ۱۰. آزمایش‌ها (با پاسخ)

**۱.** چرا `COPY package*.json` قبل از `COPY . .` است؟

**پاسخ:** تا وقتی فقط کد تغییر کند، لایه‌ی نصب وابستگی از کش استفاده کند.

**۲.** چرا `localhost` در کانتینر api به دیتابیس اشاره نمی‌کند؟

**پاسخ:** هر کانتینر شبکه‌ی خودش را دارد؛ باید نام سرویس (`db`) استفاده شود.

**۳.** چرا `npm ci` بهتر از `npm install` در CI/ایمیج است؟

**پاسخ:** دقیقاً lockfile را نصب می‌کند و در صورت ناهماهنگی خطا می‌دهد؛ قابل بازتولید.

**۴.** چرا HEALTHCHECK مهم است؟

**پاسخ:** orchestrator/compose می‌فهمد سرویس واقعاً آماده است، نه فقط فرایند بالا.

## ۱۱. خودآزمایی

1. ایمیج و کانتینر چه تفاوتی دارند؟
2. کش لایه چگونه کار می‌کند؟
3. multi-stage چه فایده‌ای دارد؟
4. ARG و ENV چه تفاوتی دارند؟
5. چرا USER غیر root؟
6. named volume چه زمانی لازم است؟

## ۱۲. چک‌لیست تحویل

- [ ] Dockerfile چندمرحله‌ای
- [ ] `npm ci` و `.dockerignore`
- [ ] USER غیر root + init
- [ ] HEALTHCHECK
- [ ] Compose با db + volume + healthcheck
- [ ] migration قبل از شروع
- [ ] اسکن ایمیج
- [ ] README با دستور اجرا
