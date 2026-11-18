# جاوااسکریپت مدرن (ES6+)

> مرجع اصلی: [MDN — JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)

جاوااسکریپت زبانی است که با آن *رفتار* را می‌سازیم. در این درس روی چیزهایی تمرکز می‌کنیم که هر روز در کد کاری استفاده می‌شوند.

## ۱. `const` و `let` — نه `var`

```js
const MAX_RETRIES = 3          // ارجاع ثابت؛ قابل تخصیص مجدد نیست
let attempts = 0               // قابل تغییر
attempts += 1
```

- `const` را پیش‌فرض بگیرید؛ فقط وقتی مقدار عوض می‌شود `let`.
- `var` محدوده‌ی تابعی دارد و hoisting گیج‌کننده‌ای می‌سازد — استفاده نکنید.
- `const` یعنی «این نام به این مقدار اشاره می‌کند»؛ محتوای آبجکت هنوز تغییرپذیر است.

```js
const user = { name: 'Sara' }
user.name = 'Sara A.'       // ✅ مجاز
// user = {}                // ❌ TypeError
```

## ۲. توابع پیکانی و `this`

```js
const double = (n) => n * 2
const items = [1, 2, 3].map((n) => n * 2)
```

تفاوت مهم: تابع پیکانی `this` خودش را ندارد و `this` محیط بیرونی را می‌گیرد. برای callbackها عالی است.

```js
const timer = {
  seconds: 0,
  start() {
    setInterval(() => { this.seconds++ }, 1000) // this درست کار می‌کند
  }
}
```

## ۳. Destructuring — خواندن تمیز داده

```js
const { name, email, role = 'user' } = user
const [first, , third] = ['a', 'b', 'c']

// در پارامتر تابع
function render({ title, body }) { /* ... */ }

// برای پاسخ API
const { data, error } = await fetchJson(url)
```

## ۴. Spread و Rest

```js
const merged = { ...defaults, ...options }       // کپی کم‌عمق + override
const copy = [...items, newItem]                 // آرایه جدید (immutable)
const { password, ...safeUser } = user           // حذف یک فیلد
function sum(...nums) { return nums.reduce((a, b) => a + b, 0) }
```

> نکته‌ی امنیتی: `...` فقط سطح اول را کپی می‌کند (shallow copy). برای آبجکت تودرتو از `structuredClone(obj)` استفاده کنید.

## ۵. متدهای آرایه که ۹۰٪ کار را انجام می‌دهند

```js
const repos = [
  { name: 'a', stars: 12, fork: false },
  { name: 'b', stars: 340, fork: true },
  { name: 'c', stars: 88, fork: false }
]

const top = repos
  .filter((r) => !r.fork)                 // فقط مخازن اصلی
  .sort((a, b) => b.stars - a.stars)      // نزولی
  .slice(0, 2)                            // دو مورد اول
  .map((r) => r.name)                     // فقط نام‌ها

const totalStars = repos.reduce((sum, r) => sum + r.stars, 0)
```

هشدارهای رایج:

- `sort` آرایه را **در جا** تغییر می‌دهد؛ اگر نباید mutate شود از `toSorted()` (مدرن) یا `[...arr].sort()` استفاده کنید.
- `map` وقتی نتیجه را نمی‌خواهید استفاده نکنید؛ `forEach` برای side effect است.
- `filter().map()` را می‌توانید گاهی با یک حلقه یا `flatMap` ساده‌تر کنید، اما خوانایی مقدم است.

## ۶. Promise و async/await

```js
async function getUser(username) {
  const res = await fetch(`https://api.github.com/users/${username}`, {
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`) // fetch خودش خطا نمی‌دهد!
  return res.json()
}
```

سه نکته‌ی حیاتی:

1. `fetch` فقط در خطای شبکه reject می‌کند. **همیشه `res.ok` را بررسی کنید.**
2. `await` را در `try/catch` بگذارید تا خطا مدیریت شود.
3. درخواست‌های مستقل را موازی کنید:

```js
const [profile, repos] = await Promise.all([getUser(u), getRepos(u)])
```

## ۷. مدیریت خطای واقعی

```js
try {
  const user = await getUser(name)
  renderUser(user)
} catch (err) {
  if (err instanceof Error && err.message.includes('404')) {
    showState('کاربری با این نام پیدا نشد')
  } else {
    showState('خطا در ارتباط با سرور')
    console.error(err)
  } finally {
    setLoading(false)
  }
}
```

## ۸. ماژول‌های ES

```js
// api.js
export async function searchUsers(q) { /* ... */ }
export const BASE_URL = 'https://api.github.com'

// ui.js
import { searchUsers } from './api.js'   // در مرورگر پسوند لازم است
export function initSearch(form) { /* ... */ }

// main.js
import { initSearch } from './ui.js'
initSearch(document.querySelector('#search-form'))
```

مزیت: هر فایل مسئولیت مشخص، بدون متغیرهای گلوبال. در HTML: `<script type="module" src="./main.js"></script>`.

## ۹. Closure و debounce

Closure یعنی تابع به متغیرهای محیطی که در آن ساخته شده دسترسی دارد. کاربرد کلاسیک: debounce.

```js
export function debounce(fn, delay = 400) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

const onSearch = debounce((q) => searchUsers(q), 400)
input.addEventListener('input', (e) => onSearch(e.target.value))
```

## ۱۰. Optional chaining و Nullish coalescing

```js
const city = user?.address?.city ?? 'نامشخص'   // فقط null/undefined را جایگزین می‌کند
const count = 0
console.log(count || 5)   // 5  ← اشتباه رایج
console.log(count ?? 5)   // 0  ← درست
```

## ۱۱. الگوی وضعیت UI

هر درخواست شبکه سه/چهار حالت دارد. از همان ابتدا آن‌ها را مدل کنید:

```js
const state = { status: 'idle', data: null, error: null }
// idle | loading | success | empty | error
```

اگر این کار را نکنید، بعداً با ترکیب‌های عجیب `loading && error` مواجه می‌شوید.

## تمرین این درس

داشبورد جستجوی کاربران GitHub را با ماژول‌های ES، `async/await`، `Promise.all`، debounce و مدیریت کامل وضعیت‌های UI بسازید. جزئیات در تب تمرین است.
