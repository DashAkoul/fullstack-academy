# Vite و ابزارهای ساخت

> مرجع رسمی: [Vite Guide](https://vite.dev/guide/) و [Vite Config](https://vite.dev/config/)

Vite دو نقش دارد: سرور توسعه‌ی فوق‌سریع با HMR، و bundler برای خروجی production. در سال‌های اخیر استاندارد واقعی اکوسیستم React/Vue/Svelte شده است.

## ۱. چرا سریع است؟

- در حالت توسعه، به‌جای باندل کردن همه چیز، فایل‌ها را با **ESM بومی مرورگر** سرو می‌کند (no-bundle dev).
- وابستگی‌های تغییرناپذیر را یک بار با **esbuild** پیش‌باندل می‌کند.
- HMR فقط بخش تغییرکرده را جایگزین می‌کند، نه reload کامل.
- build تولیدی از **Rollup** استفاده می‌کند (tree-shaking و تقسیم کد قوی).

## ۲. شروع

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app && npm i && npm run dev
```

ساختار معمول:

```
my-app/
├─ index.html          ← ورودی واقعی (نه src/main.tsx)
├─ vite.config.ts
├─ public/             ← فایل‌های بدون پردازش (favicon، robots.txt)
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   └─ vite-env.d.ts
```

نکته‌ی مهم: `index.html` در Vite نقطه‌ی ورود است و اسکریپت را باید با `type="module"` لینک کند.

## ۳. پیکربندی نمونه

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022'
  }
})
```

alias بدون تنظیم tsconfig کار IDE را می‌شکند:

```json
// tsconfig.json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
```

## ۴. متغیرهای محیطی

Vite فقط متغیرهایی را که با `VITE_` شروع شوند به کلاینت می‌دهد.

```bash
# .env.local  (در git نباشد)
VITE_API_URL=https://api.example.com
VITE_MAPS_KEY=abc123
```

```ts
const api = import.meta.env.VITE_API_URL
if (!api) throw new Error('VITE_API_URL تنظیم نشده است')
const dev = import.meta.env.DEV
const mode = import.meta.env.MODE   // 'development' | 'production' | custom
```

فایل‌های env بر اساس اولویت: `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`

تایپ‌دهی:

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_MAPS_KEY: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

> ⚠️ هر چیزی که در باندل کلاینت قرار می‌گیرد برای کاربر قابل خواندن است. کلید سرویس‌های حساس (Stripe secret، Gemini key) هرگز نباید در env فرانت باشد — همان چیزی که این اپلیکیشن با BYOK و پروسه‌ی main حل می‌کند.

## ۵. تقسیم کد (Code Splitting)

```tsx
import { lazy, Suspense } from 'react'

const ForecastChart = lazy(() => import('./ForecastChart'))

export function Panel() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ForecastChart />
    </Suspense>
  )
}
```

همچنین:
- پویا کردن مسیرها در React Router → هر صفحه یک chunk.
- `import()` تنها وقتی انجام می‌شود که واقعاً به آن رسیده باشید.

بررسی خروجی:

```bash
npm run build
npx vite-bundle-visualizer
```

## ۶. assetها

```tsx
import logo from './assets/logo.svg'                 // → URL
import './styles/global.css'                         // → تزریق CSS
const url = new URL('./assets/font.woff2', import.meta.url).href
```

- فایل‌های کوچک (کمتر از 4KB به‌صورت پیش‌فرض) به base64 تبدیل می‌شوند.
- فایل‌های بزرگ‌تر با hash در پوشه‌ی assets کپی می‌شوند (کش طولانی‌مدت امن).

## ۷. PWA و تحلیل باندل

```bash
npm i -D vite-plugin-pwa
```

```ts
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig({
  plugins: [VitePWA({ registerType: 'autoUpdate' })]
})
```

## ۸. عیب‌یابی رایج

| مشکل | علت/راه‌حل |
| --- | --- |
| `import.meta.env.X is undefined` | پیشوند `VITE_` ندارد یا سرور را ری‌استارت نکرده‌اید |
| alias در Vite کار می‌کند ولی IDE خطا می‌دهد | `paths` در tsconfig تنظیم نشده |
| صفحه‌ی سفید بعد از build | مسیرهای مطلق بدون `base` (برای Electron `base: './'`) |
| HMR کار نمی‌کند | پروکسی/فایل‌سیستم شبکه یا import سمت سرور |
| باندل بزرگ | dependency سنگین؛ lazy load یا جایگزین سبک‌تر |

برای Electron (مثل همین اپ) مهم است:

```ts
export default defineConfig({
  base: './',                 // مسیرهای نسبی برای loadFile
  build: { outDir: 'dist' }
})
```

## ۹. محیط‌ها و حالت‌ها

```bash
vite build --mode staging
```

```ts
// vite.config.ts
export default defineConfig(({ mode }) => ({
  define: { __APP_ENV__: JSON.stringify(mode) }
}))
```

## تمرین این درس

ویجت آب‌وهوای قدیمی را به Vite + TypeScript منتقل کنید: env با `VITE_`، alias، فایل ‎.env.example، تایپ env، و lazy loading بخش پیش‌بینی. جزئیات در تب تمرین است.
