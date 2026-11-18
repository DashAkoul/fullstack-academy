# مبانی Node.js

> مرجع رسمی: [Node.js Learn](https://nodejs.org/en/learn)

Node.js اجرای جاوااسکریپت خارج از مرورگر است: یک event loop تک‌رشته‌ای با I/O غیرهمگام. درک این مدل، تفاوت بین کد سریع و کد مسدودکننده را می‌سازد.

## ۱. Event Loop در یک نگاه

```
   ┌───────────────────────────┐
┌─>│           timers          │  setTimeout/setInterval
│  ├───────────────────────────┤
│  │     pending callbacks     │
│  ├───────────────────────────┤
│  │       poll (I/O)          │  ← بیشتر وقت اینجاست
│  ├───────────────────────────┤
│  │           check           │  setImmediate
│  ├───────────────────────────┤
│  │      close callbacks      │
└──┤───────────────────────────┘
```

نتیجه‌ی عملی: کد CPU-heavy (حلقه‌ی بزرگ، JSON خیلی بزرگ، رمزنگاری سنگین) کل سرور را متوقف می‌کند. برای این کارها از `worker_threads` یا سرویس جدا استفاده کنید.

```js
// ❌ سرور را برای همه قفل می‌کند
const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512')

// ✅ نسخه‌ی غیرهمگام
const hash = await promisify(crypto.pbkdf2)(password, salt, 100_000, 64, 'sha512')
```

## ۲. ماژول‌های ESM

```js
// math.js
export const add = (a, b) => a + b
export default function multiply(a, b) { return a * b }

// app.js
import multiply, { add } from './math.js'   // پسوند لازم است
```

در `package.json` مقدار `"type": "module"` را بگذارید. ماژول‌های داخلی را با پیشوند `node:` ایمپورت کنید تا با پکیج‌های npm اشتباه نشوند:

```js
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
```

## ۳. فایل‌ها با `fs/promises`

```js
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

export async function saveJson(dir, name, data) {
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, `${name}.json`)
  await writeFile(file, JSON.stringify(data, null, 2), 'utf8')
  return file
}

export async function fileExists(p) {
  try {
    await stat(p)
    return true
  } catch (e) {
    if (e.code === 'ENOENT') return false
    throw e
  }
}
```

- `writeFile` اتمیک نیست؛ برای ایمنی، در فایل موقت بنویسید و بعد `rename` کنید.
- مسیرها را همیشه با `path.join` بسازید، نه چسباندن رشته با `/`.
- کد خطای `ENOENT` را مدیریت کنید؛ «فایل نیست» یک خطای قابل انتظار است.

## ۴. استریم‌ها: پردازش داده‌ی بزرگ

```js
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

export async function processLines(file, onLine) {
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity
  })
  let n = 0
  for await (const line of rl) {
    if (line.trim()) await onLine(line, n++)
  }
  return n
}
```

مقایسه:

| روش | حافظه | مناسب |
| --- | --- | --- |
| `readFile` | کل فایل | فایل کوچک (< چند MB) |
| `createReadStream` | بافر کوچک | فایل بزرگ / نامحدود |
| `pipeline` | بافر کوچک + backpressure | انتقال/تبدیل داده |

```js
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

await pipeline(createReadStream('big.log'), createGzip(), createWriteStream('big.log.gz'))
```

## ۵. EventEmitter — الگوی رویداد

```js
import { EventEmitter } from 'node:events'

export class LogAnalyzer extends EventEmitter {
  #count = 0

  async run(file) {
    const total = await processLines(file, (line) => {
      this.#count++
      if (this.#count % 1000 === 0) this.emit('progress', this.#count)
      this.emit('line', line)
    })
    this.emit('done', total)
    return total
  }
}

const analyzer = new LogAnalyzer()
analyzer.on('progress', (n) => console.log(`پردازش ${n} خط`))
analyzer.on('line', (line) => { /* ... */ })
await analyzer.run('./samples/access.log')
```

نکته: اگر `error` را emit کنید و شنونده نداشته باشید، فرایند crash می‌کند. همیشه `on('error')` بگذارید.

## ۶. متغیرهای محیطی

```js
const port = Number(process.env.PORT ?? 3000)
const logPath = process.argv[2] ?? process.env.LOG_PATH

if (!logPath) {
  console.error('استفاده: node analyze.js <path-to-log>')
  process.exitCode = 1
}
```

از Node 20.6 به بعد:

```bash
node --env-file=.env app.js
```

برای اعتبارسنجی قطعی env از Zod استفاده کنید (در درس Express بیشتر می‌بینیم).

## ۷. ابزارهای عملیاتی

```bash
node --watch app.js            # ری‌استارت خودکار در توسعه
node --test                    # اجرای تست‌های داخلی
node --inspect-brk app.js      # دیباگ با Chrome DevTools
node -e "console.log(process.version)"
```

```js
import { performance } from 'node:perf_hooks'
const t0 = performance.now()
// ...
console.log(`${(performance.now() - t0).toFixed(1)}ms`)
```

## ۸. مدیریت خطای سطح فرایند

```js
process.on('unhandledRejection', (reason) => {
  console.error('Promise مدیریت‌نشده:', reason)
  process.exitCode = 1
})

process.on('SIGTERM', async () => {
  console.log('خاموشی تدریجی…')
  await server.close()
  process.exit(0)
})
```

یک سرور production باید بتواند «تدریجی» خاموش شود: اتصال جدید نپذیرد، درخواست‌های در جریان تمام شوند.

## ۹. کارایی: چند قاعده

- I/O را موازی کنید (`Promise.all`) نه سری.
- از `JSON.parse` روی ورودی چند صد مگابایتی پرهیز کنید؛ استریم کنید.
- `structuredClone` برای کپی عمیق، `Object.freeze` را برای قراردادهای داخلی در نظر بگیرید.
- Cache را در جایی بگذارید که واقعاً گلوگاه است — ابتدا اندازه بگیرید.

## تمرین این درس

تحلیل‌گر لاگ: خواندن استریمی فایل لاگ بزرگ، آمار کدهای وضعیت/مسیرهای پرتکرار/توزیع ساعتی، خروجی JSON با `fs/promises`، گزارش پیشرفت با EventEmitter و مدیریت خطای ورودی. جزئیات در تب تمرین است.
