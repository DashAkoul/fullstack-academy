# مبانی Node.js

> مرجع رسمی: [Node.js Learn](https://nodejs.org/en/learn) · [Event Loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick) · [Streams](https://nodejs.org/api/stream.html)

## در این درس چه یاد می‌گیرید؟

یاد می‌گیرید کد Node چه زمانی کل سرور را قفل می‌کند، چرا Streamها برای فایل‌های بزرگ حیاتی‌اند، چطور خطاها و سیگنال‌ها را درست مدیریت کنید و یک ابزار واقعی خط فرمان بسازید که یک فایل لاگ چند گیگابایتی را بدون پر کردن حافظه تحلیل کند.

---

## ۱. Event Loop: چرا یک رشته کافی است؟

Node یک thread برای اجرای جاوااسکریپت دارد و I/O را به سیستم‌عامل می‌سپارد. ترتیب تقریبی چرخه:

```
timers → pending callbacks → poll (I/O) → check (setImmediate) → close callbacks
                 ↕ microtasks (Promise, queueMicrotask) بین هر مرحله
```

```js
setTimeout(() => console.log('timeout'), 0)
setImmediate(() => console.log('immediate'))
Promise.resolve().then(() => console.log('promise'))
process.nextTick(() => console.log('nextTick'))
console.log('sync')

// sync → nextTick → promise → timeout/immediate (ترتیب دو مورد آخر به context بستگی دارد)
```

`process.nextTick` و microtaskها **قبل از** ادامه‌ی چرخه اجرا می‌شوند؛ حلقه‌ی بی‌پایان `nextTick` کل I/O را گرسنه می‌کند.

**نتیجه‌ی عملی:** عملیات CPU-سنگین را جدا کنید:

```js
// ❌ کل سرور برای همه قفل می‌شود
const hash = crypto.pbkdf2Sync(password, salt, 210_000, 64, 'sha512')

// ✅ نسخه‌ی غیرهمگام
import { pbkdf2 } from 'node:crypto'
import { promisify } from 'node:util'
const pbkdf2Async = promisify(pbkdf2)
const hash = await pbkdf2Async(password, salt, 210_000, 64, 'sha512')
```

برای کارهای واقعاً سنگین (پردازش تصویر، PDF، رمزنگاری انبوه) از `worker_threads` یا سرویس جدا استفاده کنید.

## ۲. ماژول‌ها و ESM

```json
{ "type": "module" }
```

```js
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
```

- پیشوند `node:` جلوگیری از اشتباه با پکیج npm است.
- در ESM پسوند فایل در import لازم است.
- `import.meta.url` جای `__dirname` را می‌گیرد.
- top-level `await` فقط در ESM.

## ۳. فایل‌ها: از کوچک تا بزرگ

```js
import { mkdir, writeFile, rename, stat } from 'node:fs/promises'
import path from 'node:path'

export async function saveJson(dir, name, data) {
  await mkdir(dir, { recursive: true })
  const target = path.join(dir, `${name}.json`)
  const tmp = `${target}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await rename(tmp, target)     // جایگزینی اتمیک
  return target
}

export async function exists(p) {
  try {
    await stat(p)
    return true
  } catch (e) {
    if (e.code === 'ENOENT') return false
    throw e
  }
}
```

- `writeFile` مستقیم اتمیک نیست؛ نوشتن در tmp و rename از فایل نیمه‌نوشته جلوگیری می‌کند.
- `path.join` برای سازگاری ویندوز/لینوکس.
- خطای `ENOENT` یک وضعیت قابل انتظار است، نه فاجعه.

## ۴. Stream و Backpressure

```js
import { createReadStream, createWriteStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

export async function forEachLine(file, onLine) {
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

await pipeline(createReadStream('access.log'), createGzip(), createWriteStream('access.log.gz'))
```

| روش | حافظه | مناسب |
| --- | --- | --- |
| `readFile` | کل فایل | فایل کوچک |
| `createReadStream` | بافر کوچک | فایل بزرگ |
| `pipeline` | بافر + backpressure | تبدیل/انتقال |

`pipeline` خطاها را منتقل و streamها را در صورت شکست می‌بندد؛ از `readable.pipe(writable)` خام در production پرهیز کنید.

## ۵. EventEmitter: انتشار رویداد

```js
import { EventEmitter } from 'node:events'

export class Analyzer extends EventEmitter {
  #lines = 0

  async run(file) {
    const total = await forEachLine(file, (line) => {
      this.#lines++
      if (this.#lines % 1000 === 0) this.emit('progress', this.#lines)
      this.emit('line', line)
    })
    this.emit('done', total)
    return total
  }
}

const analyzer = new Analyzer()
analyzer.on('progress', (n) => process.stderr.write(`\r${n} خط`))
analyzer.on('error', (e) => console.error(e))
await analyzer.run('./samples/access.log')
```

اگر رویداد `error` را emit کنید و شنونده نداشته باشید، فرایند crash می‌کند.

## ۶. پیکربندی و آرگومان‌ها

```js
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', short: 'o', default: 'report.json' },
    top: { type: 'string', default: '10' }
  }
})

const [logPath] = positionals
if (!logPath) {
  console.error('استفاده: node analyze.js <log> [-o report.json] [--top 10]')
  process.exitCode = 1
}
```

```bash
node --env-file=.env app.js        # Node 20.6+
```

برای اعتبارسنجی env از Zod استفاده کنید و در شروع برنامه fail-fast کنید.

## ۷. خطا و خاموشی تدریجی

```js
process.on('unhandledRejection', (reason) => {
  console.error('Promise مدیریت‌نشده:', reason)
  process.exitCode = 1
})

process.on('uncaughtException', (err) => {
  console.error('خطای کشنده:', err)
  process.exit(1)     // ادامه دادن با state نامعلوم خطرناک است
})

const server = app.listen(3000)

async function shutdown(signal) {
  console.log(`${signal}: خاموشی…`)
  server.close(async () => {
    await db.$disconnect()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()   // مهلت سخت
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

## ۸. کارایی: اندازه بگیرید

```js
import { performance } from 'node:perf_hooks'

const t0 = performance.now()
// ...
console.log(`${(performance.now() - t0).toFixed(1)}ms`)
```

```bash
node --cpu-prof analyze.js
node --inspect-brk analyze.js
```

- I/O موازی: `Promise.all` نه حلقه‌ی `await` سری.
- از buffering بی‌مورد پرهیز کنید؛ stream.
- کش فقط بعد از اندازه‌گیری و در نقطه‌ی درست.

## ۹. ساخت گام‌به‌گام تحلیل‌گر لاگ (تمرین)

**گام ۱ — نمونه:** یک فایل `samples/access.log` با ۵۰ خط با فرمت Nginx بسازید.

**گام ۲ — پارسر:**

```js
const LINE = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*)" (\d{3}) (\S+)$/

export function parseLine(line) {
  const m = LINE.exec(line)
  if (!m) return null
  return { ip: m[1], time: m[2], method: m[3], path: m[4], status: Number(m[5]) }
}
```

**گام ۳ — تحلیل:** شمارش کد وضعیت، ۱۰ مسیر پرتکرار، توزیع ساعتی؛ با `Map`.

**گام ۴ — stream:** `forEachLine` بخش ۴؛ گزارش پیشرفت با EventEmitter.

**گام ۵ — خروجی:** `saveJson` اتمیک؛ خلاصه در کنسول.

**گام ۶ — CLI:** `parseArgs`، مدیریت فایل ناموجود، `exitCode` درست.

**گام ۷ — تست:** پارسر را با چند خط معتبر/نامعتبر تست کنید.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `streams` | بخش ۴ و گام ۴ |
| `fs-promises` | بخش ۳ و گام ۵ |
| `events` | بخش ۵ |
| `errors` | بخش ۷ و گام ۶ |
| `esm` | بخش ۲ |

## ۱۰. عیب‌یابی

| نشانه | علت | راه‌حل |
| --- | --- | --- |
| `ERR_REQUIRE_ESM` | `require` در پروژه‌ی ESM | از `import` استفاده کنید |
| `Cannot use import` | بدون `"type":"module"` | بخش ۲ |
| حافظه پر می‌شود | `readFile`/جمع‌کردن در آرایه | stream |
| سرور در بار سنگین کند | کار CPU در thread اصلی | worker/سرویس جدا |
| فرایند با SIGTERM فوراً می‌میرد | بدون handler | بخش ۷ |
| `ECONNREFUSED` | سرویس مقصد بالا نیست | retry/healthcheck |

## ۱۱. آزمایش‌ها (با پاسخ)

**۱.** چرا `await` در حلقه برای ۱۰ درخواست مستقل بد است؟

**پاسخ:** سری اجرا می‌شود و مجموع زمان جمع می‌شود؛ `Promise.all` موازی است.

**۲.** تفاوت `setImmediate` و `setTimeout(...,0)`؟

**پاسخ:** setImmediate در مرحله‌ی check بعد از poll اجرا می‌شود؛ setTimeout در timers مرحله‌ی بعد (حداقل ~۱ms).

**۳.** چرا `writeFile` مستقیم ممکن است فایل خراب بسازد؟

**پاسخ:** کرش/قطع برق در میانه‌ی نوشتن؛ tmp + rename اتمیک.

**۴.** چه زمانی worker thread لازم است؟

**پاسخ:** کار CPU-bound طولانی که event loop را بلاک می‌کند.

## ۱۲. خودآزمایی

1. Event loop چه مراحلی دارد؟
2. Stream چه مشکلی را حل می‌کند؟
3. چرا `error` در EventEmitter حیاتی است؟
4. تفاوت `uncaughtException` و `unhandledRejection`؟
5. چطور خاموشی تدریجی را پیاده می‌کنید؟
6. `--env-file` چه زمانی کافی است و چه زمانی Zod لازم است؟

## ۱۳. چک‌لیست تحویل

- [ ] پردازش stream بدون بارگذاری کامل
- [ ] `fs/promises` و خطاهای ENOENT
- [ ] EventEmitter برای پیشرفت
- [ ] CLI با راهنما و exit code
- [ ] فایل نمونه در samples
- [ ] گزارش JSON اتمیک
- [ ] تست پارسر
