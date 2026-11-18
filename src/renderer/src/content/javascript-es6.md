# جاوااسکریپت مدرن (ES6+)

> مرجع اصلی: [MDN — JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide) · [javascript.info](https://javascript.info/) · [MDN — Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

## در این درس چه یاد می‌گیرید؟

این درس فقط فهرست سینتکس نیست؛ قرار است بتوانید یک ابزار واقعی با داده‌ی شبکه بسازید: جستجوی کاربر GitHub، نمایش پروفایل و مخازن، مدیریت کامل حالت‌های بارگذاری/خطا، و کدی که با AbortController و debounce در برابر رفتار واقعی کاربر مقاوم است.

اگر «چرا»ی event loop و Promise را بفهمید، باگ‌های عجیب React و Node هم برایتان قابل توضیح می‌شود.

---

## ۱. اجرای کد: Scope، Hoisting و Closure

```js
function outer() {
  let counter = 0
  return function inner() {
    counter += 1
    return counter
  }
}

const next = outer()
next() // 1
next() // 2
next() // 3
```

تابع برگشتی به متغیر `counter` دسترسی دارد حتی بعد از پایان `outer`. به این **closure** می‌گویند؛ پایه‌ی debounce، هوک‌های React و ماژول‌های خصوصی.

**Hoisting:**

```js
console.log(a) // undefined  ← var بالا می‌رود ولی مقدار نه
var a = 1

console.log(b) // ReferenceError (TDZ)
let b = 2

sayHi()        // ✅ کار می‌کند (function declaration)
function sayHi() {}
```

**دام کلاسیک closure در حلقه:**

```js
// ❌ همه ۳ چاپ می‌کنند
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0)

// ✅ با let (هر تکرار scope جدا دارد)
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i), 0)
```

`let` در هر تکرار حلقه یک binding جدید می‌سازد؛ `var` یک متغیر در scope تابع.

## ۲. Event Loop در سه خط

```js
console.log('1')
setTimeout(() => console.log('2'), 0)
Promise.resolve().then(() => console.log('3'))
console.log('4')
// خروجی: 1 4 3 2
```

- کد همگام کامل اجرا می‌شود (`1`, `4`).
- سپس **microtask**ها: callbackهای Promise (`3`).
- سپس **macrotask**ها: تایمرها، I/O (`2`).

نتیجه‌ی عملی: `await` بقیه‌ی کد همان تابع را «مکث» می‌دهد ولی رشته‌ی اصلی را قفل نمی‌کند. عملیات CPU-سنگین (حلقه‌ی میلیونی، رمزنگاری sync) همه چیز را متوقف می‌کند.

```js
const t0 = performance.now()
await new Promise((r) => setTimeout(r, 100))
console.log(performance.now() - t0 >= 100) // true
```

## ۳. `this` و تفاوت تابع معمولی با پیکانی

```js
const timer = {
  seconds: 0,
  startClassic() {
    setInterval(function () {
      this.seconds++ // ❌ this = window/undefined
    }, 1000)
  },
  startArrow() {
    setInterval(() => {
      this.seconds++ // ✅ this = timer
    }, 1000)
  }
}
```

- تابع معمولی: `this` را در **زمان فراخوانی** می‌گیرد.
- پیکانی: `this` را از **محیط تعریف** می‌گیرد (و `arguments` ندارد).
- متد آبجکت را با پیکانی تعریف نکنید؛ `this` به آبجکت اشاره نمی‌کند.

## ۴. آرایه‌ها و آبجکت‌ها: تغییرناپذیری (Immutability)

```js
const repos = [
  { name: 'a', stars: 12, fork: false },
  { name: 'b', stars: 340, fork: true },
  { name: 'c', stars: 88, fork: false }
]

const topNames = repos
  .filter((r) => !r.fork)
  .toSorted((a, b) => b.stars - a.stars)   // درجای تغییر نمی‌دهد
  .slice(0, 2)
  .map((r) => r.name)                       // ['c', 'a'] → سپس مرتب‌شده

const totalStars = repos.reduce((sum, r) => sum + r.stars, 0)
const byFork = Object.groupBy(repos, (r) => (r.fork ? 'fork' : 'own'))

const updated = repos.map((r) => (r.name === 'a' ? { ...r, stars: 13 } : r))
const cloned = structuredClone(updated)     // کپی عمیق
```

| متد | تغییر می‌دهد؟ | خروجی |
| --- | --- | --- |
| `map` | نه | آرایه‌ی جدید هم‌طول |
| `filter` | نه | زیرمجموعه |
| `sort` | **بله** | همان آرایه (از `toSorted` استفاده کنید) |
| `splice` | **بله** | آیتم‌های حذف‌شده |
| `toSorted/toReversed/toSpliced` | نه | کپی تغییر‌یافته |

> `...` فقط سطح اول را کپی می‌کند. `{ ...a }` با `a.nested` مشترک است؛ برای کپی عمیق `structuredClone` (با محدودیت توابع).

## ۵. Promise: وضعیت‌ها، ترکیب و خطا

```js
const p = fetch('/api/user')   // pending
```

سه وضعیت: `pending` → `fulfilled` یا `rejected`. `finally` همیشه اجرا می‌شود.

```js
// موازی، نه سری
const [profile, repos] = await Promise.all([getUser(u), getRepos(u)])

// هر کدام زودتر آماده شد
const fastest = await Promise.race([mirrorA(), mirrorB()])

// تحمل خطا: آرایه‌ی {status, value|reason}
const results = await Promise.allSettled([a(), b()])
for (const r of results) {
  if (r.status === 'fulfilled') console.log(r.value)
  else console.warn(r.reason)
}
```

**دام:** `Promise.all` با اولین rejection رد می‌شود، ولی بقیه‌ی Promiseها متوقف نمی‌شوند (فقط نتیجه‌شان نادیده گرفته می‌شود). برای لغو واقعی از AbortController استفاده کنید.

## ۶. async/await و خطاهای واقعی

```js
async function getUser(username, { signal } = {}) {
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal
  })

  if (!res.ok) {
    if (res.status === 404) throw new NotFoundError('کاربر پیدا نشد')
    if (res.status === 403) throw new RateLimitError('سقف درخواست GitHub')
    throw new HttpError(res.status, await res.text())
  }
  return res.json()
}
```

سه قانون:

1. `fetch` فقط در خطای **شبکه** reject می‌شود؛ ۴۰۴ و ۵۰۰ یک Promise موفق هستند. `res.ok` را بررسی کنید.
2. `await` را داخل `try/catch` بگذارید یا خطا را به لایه‌ی بالاتر بدهید.
3. درخواست‌های مستقل را با `Promise.all` موازی کنید.

```js
class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}
```

کلاس خطا باعث می‌شود لایه‌ی UI بتواند بین «کاربر نیست»، «محدودیت نرخ» و «خطای شبکه» تفاوت بگذارد — چیزی که پیام «خطا رخ داد» هرگز نمی‌دهد.

## ۷. لغو درخواست و debounce

```js
export function debounce(fn, delay = 400) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
```

```js
let controller

async function onSearch(query) {
  controller?.abort()                 // درخواست قبلی را لغو کن
  controller = new AbortController()
  setState({ status: 'loading' })

  try {
    const users = await searchUsers(query, controller.signal)
    setState({ status: 'success', data: users })
  } catch (e) {
    if (e.name === 'AbortError') return   // لغو عمدی، خطا نیست
    setState({ status: 'error', message: toMessage(e) })
  }
}

const input = document.querySelector('#q')
input.addEventListener('input', debounce((e) => onSearch(e.target.value.trim()), 400))
```

بدون `abort`، پاسخ کندِ جستجوی قبلی می‌تواند بعد از جستجوی جدید برسد و نتیجه‌ی اشتباه نمایش دهد (race condition).

## ۸. ماژول‌های ES و مرز مسئولیت‌ها

```js
// api.js — فقط شبکه، بدون DOM
export class NotFoundError extends Error {}
export async function searchUsers(q, signal) { /* ... */ }

// state.js — فقط داده
export function createStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch }
      listeners.forEach((fn) => fn(state))
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    }
  }
}

// ui.js — فقط رندر، بدون fetch
export function render(root, state) { /* ... */ }

// main.js — اتصال
import { searchUsers } from './api.js'
import { createStore } from './state.js'
import { render } from './ui.js'
```

در مرورگر: `<script type="module" src="./main.js"></script>`. ماژول‌ها خودشان defer هستند، scope جدا دارند و یک بار اجرا می‌شوند.

## ۹. رندر امن DOM

```js
// ❌ XSS: ورودی کاربر به‌عنوان HTML اجرا می‌شود
card.innerHTML = `<h2>${repo.name}</h2>`

// ✅ متن
const h2 = document.createElement('h2')
h2.textContent = repo.name
card.append(h2)
```

با `textContent` نیازی به escape دستی نیست. `innerHTML` فقط با HTML ثابت یا sanitize‌شده.

## ۱۰. الگوی وضعیت UI به‌صورت ماشین حالت

به‌جای چند boolean پراکنده (`loading`, `error`, `hasData`) یک وضعیت صریح داشته باشید:

```js
const initialState = { status: 'idle' } // idle | loading | success | empty | error
```

```js
function render(root, state) {
  root.replaceChildren()
  const el = document.createElement('div')

  switch (state.status) {
    case 'idle':
      el.textContent = 'نام کاربری را جستجو کنید.'
      break
    case 'loading':
      el.setAttribute('aria-busy', 'true')
      el.textContent = 'در حال بارگذاری…'
      break
    case 'empty':
      el.textContent = 'کاربری با این نام پیدا نشد.'
      break
    case 'error':
      el.setAttribute('role', 'alert')
      el.textContent = state.message
      break
    case 'success':
      el.append(renderProfile(state.data))
      break
  }
  root.append(el)
}
```

مزیت: هر وضعیت دقیقاً یک ظاهر دارد و ترکیب‌های ناممکن (`loading && error`) حذف می‌شوند. همین الگو را در React با union type تکرار می‌کنیم.

## ۱۱. ساخت گام‌به‌گام ابزار GitHub Finder (تمرین)

**گام ۱ — فایل‌ها:** `index.html`، `styles.css`، `main.js`، `api.js`، `ui.js`، `state.js`.

**گام ۲ — `api.js`:** تابع `getUser(username, signal)` و `getRepos(username, signal)` با `res.ok`، کلاس‌های خطا و `Promise.all`. تست کنید: یک نام موجود و یک نام ناموجود.

**گام ۳ — `state.js`:** store کوچک بالا. وضعیت اولیه `{ status: 'idle' }`.

**گام ۴ — `ui.js`:** `render(root, state)` با switch. `renderProfile` نام، آواتار (`alt`)، تعداد مخازن و ۵ مخزن برتر (مرتب بر اساس star، حذف forkها).

**گام ۵ — `main.js`:** خواندن input با debounce، ساخت AbortController، فراخوانی store، subscribe برای رندر.

**گام ۶ — حالت‌های مرزی:** ورودی خالی → `idle`؛ کاربر نبود → `empty`؛ نرخ GitHub → پیام راهنما.

**گام ۷ — دسترس‌پذیری:** `aria-busy`، `role="alert"` برای خطا، فوکوس بعد از جستجو.

**گام ۸ — بازبینی:** تب‌زنی سریع باید فقط نتیجه‌ی آخر را نشان دهد؛ Network را ببینید و مطمئن شوید درخواست‌های قبلی `canceled` هستند.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `modules` | بخش ۸ و گام ۱ |
| `async` | بخش ۶ |
| `array-methods` | بخش ۴ و گام ۴ |
| `states` | بخش ۱۰ و گام ۶ |
| `debounce` | بخش ۷ |
| `no-var` | بخش ۱ |

## ۱۲. عیب‌یابی

| نشانه | علت رایج | راه‌حل |
| --- | --- | --- |
| `Cannot use import statement outside a module` | script بدون `type="module"` | `type="module"` اضافه کنید |
| `Failed to resolve module specifier` | مسیر بدون `./` | `import { x } from './api.js'` |
| CORS error | درخواست از مبدأ دیگر | از APIهای دارای CORS یا پروکسی سرور استفاده کنید |
| `res.json()` خطا می‌دهد | پاسخ HTML (صفحه‌ی خطا) بود | `res.headers.get('content-type')` را بررسی کنید |
| UI نتیجه‌ی قدیمی را نشان می‌دهد | نبود abort/شماره‌ی درخواست | AbortController یا requestId |
| `undefined` از destructuring | پاسخ API شکل دیگری دارد | console.log ساختار، سپس تایپ/اعتبارسنجی |

## ۱۳. آزمایش‌ها (با پاسخ)

**۱.** خروجی چیست؟

```js
async function f() {
  console.log('a')
  await null
  console.log('b')
}
f()
console.log('c')
```

**پاسخ:** `a c b` — بدنه تا اولین `await` همگام اجرا می‌شود، سپس ادامه در microtask.

**۲.** چرا `[1,2,3].map(Number).sort()` روی `[10,9,1]` نتیجه‌ی اشتباه می‌دهد؟

**پاسخ:** `sort()` پیش‌فرض رشته‌ای مقایسه می‌کند. `toSorted((a,b) => a-b)` لازم است.

**۳.** این کد چه زمانی باگ می‌دهد؟

```js
const user = { settings: { theme: 'dark' } }
const copy = { ...user }
copy.settings.theme = 'light'
console.log(user.settings.theme)
```

**پاسخ:** `light` — کپی سطحی است؛ `settings` مشترک است. `structuredClone` یا کپی صریح لایه‌ی داخلی لازم است.

**۴.** چطور مطمئن شوید فقط پاسخ آخرین جستجو نمایش داده می‌شود؟

**پاسخ:** AbortController برای لغو + بررسی `signal.aborted` قبل از setState؛ یا مقایسه‌ی شماره‌ی درخواست با آخرین شماره.

## ۱۴. خودآزمایی

1. تفاوت microtask و macrotask با مثال؟
2. چرا `fetch` برای ۵۰۰ خطا throw نمی‌کند؟
3. `Promise.all` و `Promise.allSettled` چه تفاوتی دارند؟
4. Closure چطور در debounce استفاده می‌شود؟
5. چرا `sort` می‌تواند state را ناخواسته تغییر دهد؟
6. چرا `innerHTML` با ورودی کاربر خطرناک است؟

## ۱۵. چک‌لیست تحویل

- [ ] ماژول‌های ES با مسئولیت روشن
- [ ] `async/await` + `try/catch` + بررسی `res.ok`
- [ ] AbortController برای درخواست‌های تکراری
- [ ] debounce روی ورودی
- [ ] ماشین حالت UI با چهار/پنج وضعیت
- [ ] رندر امن با `textContent`
- [ ] بدون `var`
- [ ] پیام خطای مشخص و فارسی
- [ ] تست دستی: کاربر موجود، ناموجود، آفلاین، تایپ سریع
