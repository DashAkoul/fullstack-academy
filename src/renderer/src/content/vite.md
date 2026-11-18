# Vite و ابزارهای ساخت

> مرجع رسمی: [Vite Guide](https://vite.dev/guide/) · [Config Reference](https://vite.dev/config/) · [Env & Modes](https://vite.dev/guide/env-and-mode)

## در این درس چه یاد می‌گیرید؟

می‌فهمید Vite در حالت توسعه چطور بدون باندل‌کردن سریع است، HMR چه زمانی state را حفظ می‌کند، env و modeها چطور کار می‌کنند و چطور پروژه را برای production و Electron پیکربندی کنید. در پایان، ویجت آب‌وهوای تمرین را با alias، متغیر محیطی، proxy و تقسیم کد می‌سازید.

---

## ۱. دو حالت کاملاً متفاوت

**توسعه (dev):**

```
مرورگر ──درخواست /src/main.tsx──▶ Vite (تبدیل سریع) ──▶ ESM
```

- Vite فایل‌ها را **باندل نمی‌کند**؛ هر import یک درخواست HTTP است و مرورگر خودش ESM را اجرا می‌کند.
- وابستگی‌های `node_modules` یک بار با **esbuild** پیش‌باندل می‌شوند (`.vite/deps`) تا صدها درخواست تکی نداشته باشیم.
- فایل‌های `.ts`، `.tsx`، `.css`، `.vue` در لحظه به چیزی که مرورگر می‌فهمد تبدیل می‌شوند.

**Production (build):**

- Rollup کل گراف را tree-shake و باندل می‌کند، hash می‌زند و فشرده می‌کند.
- خروجی در `dist/` قرار می‌گیرد و باید با یک سرور استاتیک سرو شود (نه `file://`).

## ۲. نقطه‌ی ورود `index.html` است

```
my-app/
├─ index.html          ← ورودی واقعی
├─ vite.config.ts
├─ public/             ← فایل‌های بدون پردازش، کپی خام
│  └─ robots.txt
└─ src/
   ├─ main.tsx
   ├─ vite-env.d.ts
   └─ assets/
```

```html
<script type="module" src="/src/main.tsx"></script>
```

مسیرهای داخل HTML نسبت به ریشه‌ی پروژه تفسیر می‌شوند. `public/` برای فایل‌هایی است که نامشان باید ثابت بماند (favicon، robots، manifest).

## ۳. پیکربندی واقعی

```ts
// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    base: './',
    resolve: {
      alias: { '@': resolve(__dirname, 'src') }
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.API_TARGET ?? 'http://localhost:4000',
          changeOrigin: true
        }
      }
    },
    preview: { port: 4173 },
    build: {
      outDir: 'dist',
      sourcemap: true,
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom']
          }
        }
      }
    }
  }
})
```

- `base: './'` برای Electron یا سرو زیر مسیر نسبی ضروری است.
- alias بدون `paths` در `tsconfig` باعث خطای IDE می‌شود:

```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } } }
```

### Proxy چه مشکلی را حل می‌کند؟

در توسعه، فرانت روی `localhost:5173` و API روی `localhost:4000` است. مرورگر درخواست به `5173/api` می‌زند و Vite آن را به ۴۰۰۰ می‌فرستد؛ نتیجه: بدون CORS و بدون هاردکد کردن آدرس در کد.

## ۴. متغیرهای محیطی و Modeها

```bash
# .env.local  (commit نشود)
VITE_API_URL=https://api.example.com
API_TARGET=http://localhost:4000
```

```ts
const api = import.meta.env.VITE_API_URL
const isDev = import.meta.env.DEV
const mode = import.meta.env.MODE
```

قواعد:

- فقط متغیرهای با پیشوند **`VITE_`** به کلاینت تزریق می‌شوند.
- متغیر بدون این پیشوند فقط در `vite.config` (سمت Node) قابل استفاده است — مثل `API_TARGET` بالا.
- هر چیزی که به باندل برسد برای کاربر **قابل خواندن** است؛ کلید سرویس پولی هرگز در فرانت نباشد.
- ترتیب بارگذاری: `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`.

تایپ:

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

```bash
vite build --mode staging
```

## ۵. دارایی‌ها و import

```tsx
import logo from './assets/logo.svg'          // → URL نهایی با hash
import './styles/global.css'                  // → تزریق/باندل CSS
const url = new URL('./assets/font.woff2', import.meta.url).href
```

- فایل کوچک‌تر از `assetsInlineLimit` (پیش‌فرض ۴KB) به data URL تبدیل می‌شود.
- فایل‌های بزرگ‌تر با hash در `assets/` کپی می‌شوند؛ کش طولانی‌مدت امن.

## ۶. تقسیم کد: صفحه‌ی اول سریع

```tsx
import { lazy, Suspense } from 'react'

const Forecast = lazy(() => import('./Forecast'))

export function Panel() {
  return (
    <Suspense fallback={<p>در حال بارگذاری نمودار…</p>}>
      <Forecast />
    </Suspense>
  )
}
```

- هر `import()` یک chunk جدا می‌سازد.
- مسیرهای React Router را lazy کنید.
- کتابخانه‌های سنگین (chart، editor، PDF) را lazy کنید.
- `manualChunks` برای جدا کردن vendor مفید است، ولی افراط در آن درخواست‌های زیاد می‌سازد.

بررسی خروجی:

```bash
npm run build
npx vite-bundle-visualizer
```

## ۷. HMR: چه زمانی state از دست می‌رود؟

- تغییر یک کامپوننت React → معمولاً فقط همان ماژول جایگزین می‌شود و state حفظ می‌شود.
- تغییر فایل والد (مثلاً تغییر export) → رفرش کامل.
- تغییر فایل غیرکامپوننت (store، util) → بسته به importها ممکن است کل صفحه reload شود.
- خطای سینتکس یا خطای runtime ماژول → overlay و توقف HMR.

اگر HMR کار نمی‌کند: پروژه را برای اجرای دو Vite هم‌زمان، فایل شبکه‌ای/OneDrive، یا import با مسیر مطلق سیستم بررسی کنید.

## ۸. Vite برای Electron

در پروژه‌ای مثل همین اپ، رندرر با `loadFile` باز می‌شود و مسیرها باید نسبی باشند:

```ts
export default defineConfig({
  base: './',
  build: { outDir: 'dist' }
})
```

همچنین در Electron باید رندرر به Node دسترسی نداشته باشد و IPC از طریق preload انجام شود — Vite فقط بیلد را انجام می‌دهد.

## ۹. ساخت گام‌به‌گام ویجت آب‌وهوا (تمرین)

هدف: تبدیل یک صفحه‌ی تک‌فایلی به پروژه‌ی Vite + TypeScript حرفه‌ای.

**گام ۱ — پروژه**

```bash
npm create vite@latest weather -- --template vanilla-ts
cd weather && npm i && npm run dev
```

**گام ۲ — map فایل‌های قدیمی:** HTML به `index.html`، JS به `src/main.ts`، CSS به `src/styles.css`، توابع API به `src/api.ts`.

**گام ۳ — alias** در `vite.config.ts` + `paths` در `tsconfig`؛ importها را به `@/api` تغییر دهید و مطمئن شوید IDE خطا نمی‌دهد.

**گام ۴ — env:** فایل `.env.example` با `VITE_API_URL=https://api.open-meteo.com/v1` (بدون کلید)؛ `.env.local` و `.env` را در `.gitignore` نگه دارید.

**گام ۵ — لایه‌ی API:**

```ts
const BASE = import.meta.env.VITE_API_URL

export interface CurrentWeather {
  temperature: number
  windSpeed: number
  code: number
}

export async function getCurrent(lat: number, lon: number): Promise<CurrentWeather> {
  const url = new URL(`${BASE}/forecast`)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', 'temperature_2m,wind_speed_10m,weather_code')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { current: { temperature_2m: number; wind_speed_10m: number; weather_code: number } }
  return { temperature: json.current.temperature_2m, windSpeed: json.current.wind_speed_10m, code: json.current.weather_code }
}
```

**گام ۶ — lazy loading:** بخش پیش‌بینی ۷ روزه را در `src/forecast.ts` جدا کنید و با `await import('./forecast')` وقتی کاربر دکمه را زد بارگذاری کنید.

**گام ۷ — حالت‌های UI:** loading / success / error / empty، با پیام فارسی.

**گام ۸ — build و بازبینی:** `npm run build && npm run preview`؛ حجم chunkها را ببینید و مطمئن شوید `forecast` جدا شده است.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `vite-config` | بخش ۳ و گام ۳ |
| `env` | بخش ۴ و گام ۴ |
| `types-env` | بخش ۴ |
| `code-split` | بخش ۶ و گام ۶ |
| `no-secrets` | بخش ۴ |

## ۱۰. عیب‌یابی

| نشانه | علت | راه‌حل |
| --- | --- | --- |
| `import.meta.env.X undefined` | پیشوند `VITE_` ندارد یا سرور ری‌استارت نشده | نام/ری‌استارت |
| alias در Vite کار می‌کند، IDE خطا می‌دهد | `paths` تنظیم نشده | بخش ۳ |
| صفحه‌ی سفید بعد از build | base مطلق + `file://` | `base: './'` |
| ۴۰۴ روی رفرش مسیرهای SPA | سرور تاریخچه‌ی کلاینت را نمی‌شناسد | fallback به `index.html` |
| CORS در توسعه | مستقیم به API دیگر | proxy |
| HMR قطع می‌شود | شبکه/فایل‌سیستم/دو سرور | localhost و یک نمونه |
| باندل بزرگ | وابستگی سنگین | lazy + visualizer |

## ۱۱. آزمایش‌ها (با پاسخ)

**۱.** چرا در dev، تغییری در یک util ممکن است کل صفحه را reload کند؟

**پاسخ:** HMR مرزهای قابل‌قبول (accept) را دنبال می‌کند؛ ماژول غیرکامپوننت مرز ندارد، پس به بالاترین مرز (کل صفحه) می‌رسد.

**۲.** `VITE_` را از متغیرهای سمت Node جدا می‌کنیم؛ چرا؟

**پاسخ:** هر چیزی با `VITE_` به باندل کلاینت می‌رود و عمومی است. متغیر سروری برای proxy/config باید خصوصی بماند.

**۳.** چطور مطمئن شوید بیلد روی زیرمسیر `/app/` کار می‌کند؟

**پاسخ:** `base: '/app/'` در config و سرو کردن `dist` زیر همان مسیر.

## ۱۲. خودآزمایی

1. چرا dev در Vite سریع است؟
2. esbuild در dev و Rollup در build چه نقشی دارند؟
3. proxy چه زمانی لازم است؟
4. تفاوت `public/` و `src/assets/`؟
5. چطور یک صفحه را lazy کنید؟
6. برای Electron چه تنظیماتی در build لازم است؟

## ۱۳. چک‌لیست تحویل

- [ ] `vite.config` با alias + tsconfig paths هم‌راستا
- [ ] env با `VITE_` و ‎.env.example
- [ ] تایپ `ImportMetaEnv`
- [ ] حداقل یک `import()` پویا
- [ ] بدون کلید واقعی در کد
- [ ] `npm run build` و `preview` بدون خطا
- [ ] stateهای UI کامل
- [ ] مستند نصب در README
