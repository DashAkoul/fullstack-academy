# مبانی Docker

> مرجع رسمی: [Docker Docs](https://docs.docker.com/)

Docker برنامه و همه‌ی وابستگی‌هایش را در یک **image** بسته‌بندی می‌کند تا روی هر ماشینی یکسان اجرا شود. جمله‌ی معروف: «روی سیستم من کار می‌کرد» دیگر بهانه نیست.

## ۱. مفاهیم پایه

| مفهوم | تعریف |
| --- | --- |
| **Image** | قالب فقط‌خواندنی از فایل‌سیستم + متادیتا |
| **Container** | نمونه‌ی در حال اجرای یک image (+ لایه‌ی قابل نوشتن) |
| **Dockerfile** | دستور ساخت image |
| **Registry** | انبار imageها (Docker Hub، GHCR) |
| **Volume** | ذخیره‌سازی پایدار بیرون از چرخه‌ی container |
| **Network** | شبکه‌ی داخلی برای ارتباط containerها با نام سرویس |

## ۲. Dockerfile چندمرحله‌ای برای Node

```dockerfile
# syntax=docker/dockerfile:1

# ---------- مرحله ۱: نصب وابستگی‌ها ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- مرحله ۲: build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- مرحله ۳: production ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
```

چرا این‌طور نوشته شده؟

- **چندمرحله‌ای**: ابزارهای build در image نهایی نمی‌مانند → image کوچک‌تر و سطح حمله کمتر.
- **کپی package.json قبل از سورس**: لایه‌ی نصب وابستگی کش می‌شود؛ تغییر کد باعث نصب دوباره نمی‌شود.
- **`npm ci --omit=dev`**: فقط وابستگی‌های اجرا.
- **`USER node`**: کاربر غیر root.
- **HEALTHCHECK**: ارکستراتور می‌فهمد سرویس سالم است یا نه.

## ۳. ‎.dockerignore

```
node_modules
dist
out
.git
.env
.env.*
!.env.example
coverage
*.log
Dockerfile*
docker-compose*.yml
README.md
```

بدون این فایل، `COPY . .` می‌تواند `node_modules` محلی (ممکن است با لینوکس ناسازگار باشد) و فایل‌های حساس را وارد image کند.

## ۴. دستورات ضروری

```bash
docker build -t library-api:1.0 .
docker images
docker run -d --name api -p 4000:4000 --env-file .env library-api:1.0
docker logs -f api
docker exec -it api sh
docker ps -a
docker stats
docker rm -f api
docker rmi library-api:1.0
docker system prune -af      # ⚠️ همه چیز استفاده‌نشده را پاک می‌کند
```

## ۵. Docker Compose: چند سرویس با یک دستور

```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .
      target: runtime
    env_file: .env
    environment:
      DATABASE_URL: postgresql://app:devpassword@db:5432/library
    ports: ['4000:4000']
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: library
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports: ['5433:5432']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d library']
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

```bash
docker compose up --build -d
docker compose logs -f api
docker compose exec db psql -U app -d library
docker compose down            # حجم داده حفظ می‌شود
docker compose down -v         # ⚠️ داده‌ها هم پاک می‌شوند
```

نکته‌ی مهم: نام میزبان در شبکه‌ی Compose، **نام سرویس** است (`db`)، نه `localhost`. داخل container، `localhost` به خود container اشاره می‌کند.

## ۶. Volume، Bind Mount و شبکه

| نوع | کاربرد |
| --- | --- |
| Named volume (`pgdata:`) | داده‌ی پایدار پایگاه داده — مدیریت با Docker |
| Bind mount (`./src:/app/src`) | توسعه با hot reload |
| tmpfs | داده‌ی موقت در حافظه |

```yaml
  api:
    volumes:
      - ./src:/app/src       # توسعه: کد محلی داخل container
      - /app/node_modules    # نگذار node_modules محلی روی container سایه بیندازد
```

شبکه:

```bash
docker network create app-net
docker run -d --network app-net --name db postgres:16-alpine
docker run -d --network app-net -e DB_HOST=db api:1.0
```

## ۷. بهینه‌سازی image

- از image پایه‌ی کوچک استفاده کنید (`alpine`, `-slim`, `distroless`).
- لایه‌های پرتغییر را پایین بگذارید.
- `RUN`های مرتبط را با `&&` ترکیب کنید و در پایان cache را پاک کنید.
- هیچ راز یا کلید API در image قرار ندهید — در زمان اجرا با env/secret بدهید.
- `docker history <image>` و `docker scout` برای بررسی لایه‌ها و آسیب‌پذیری.

اندازه‌ها:

```
node:22            ~۱۱۰۰MB
node:22-alpine     ~۱۳۰MB
node:22-alpine + multi-stage + --omit=dev  ~۶۰–۹۰MB
```

## ۸. اشکال‌زدایی

| مشکل | علت رایج |
| --- | --- |
| `ECONNREFUSED db:5432` | سرویس db هنوز آماده نیست → `healthcheck` + `condition` |
| `Cannot find module` | `dist` در stage build ساخته نشده یا `COPY` ناقص است |
| پورت اشغال است | `EADDRINUSE` → پورت میزبان را عوض کنید (`-p 4001:4000`) |
| تغییر کد اعمال نمی‌شود | image قدیمی؛ `--build` بزنید |
| Permission denied | `USER node` و مالکیت فایل‌های کپی‌شده (`--chown=node:node`) |

```dockerfile
COPY --chown=node:node --from=build /app/dist ./dist
```

## ۹. چک‌لیست production

- [ ] image چندمرحله‌ای و کوچک
- [ ] `USER` غیر root
- [ ] ‎.dockerignore کامل و شامل ‎.env
- [ ] HEALTHCHECK
- [ ] `restart: unless-stopped` (یا orchestrator)
- [ ] رازها از env/secret manager
- [ ] tag مشخص (نه `latest`) برای استقرار

## تمرین این درس

کانتینرسازی یک API نود + PostgreSQL: Dockerfile چندمرحله‌ای با کاربر غیر root، ‎.dockerignore، docker-compose با volume و healthcheck و endpoint سلامت. جزئیات در تب تمرین است.
