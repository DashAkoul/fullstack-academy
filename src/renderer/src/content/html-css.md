# HTML معنایی و CSS مدرن

> مرجع اصلی: [MDN — HTML](https://developer.mozilla.org/en-US/docs/Web/HTML) · [MDN — CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) · [web.dev — Learn CSS](https://web.dev/learn/css)

## در این درس چه یاد می‌گیرید؟

تا پایان این درس می‌توانید یک صفحه‌ی فرود کامل و واکنش‌گرا را **از صفر و بدون فریم‌ورک** بسازید: ساختار معنایی، شبکه‌ی ویژگی‌ها با Grid، نوار ناوبری با Flexbox، فرم معتبر، تم روشن/تاریک با متغیرهای CSS و صفحه‌ای که با کیبورد و صفحه‌خوان قابل استفاده باشد.

این درس پایه‌ی همه‌ی درس‌های بعدی است؛ اگر Flexbox و Grid را واقعاً بفهمید، ۸۰٪ دردسر چیدمان در React و Next.js هم حل می‌شود.

---

## ۱. اسکلت سند: هر خطش دلیل دارد

```html
<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="ابزار مدیریت پروژه برای تیم‌های کوچک" />
    <title>تسک‌یار | مدیریت پروژه بدون پیچیدگی</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/styles.css" />
    <script type="module" src="/main.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">رفتن به محتوای اصلی</a>
    <header>...</header>
    <main id="main">...</main>
    <footer>...</footer>
  </body>
</html>
```

| خط | چرا لازم است |
| --- | --- |
| `<!doctype html>` | مرورگر را از حالت quirks خارج می‌کند؛ بدون آن باکس‌مدل و برخی ویژگی‌ها متفاوت می‌شوند |
| `lang="fa"` | تلفظ صفحه‌خوان، شکستن خط، غلط‌گیر و ترجمه‌ی خودکار |
| `dir="rtl"` | جهت متن، اسکرول و چیدمان پیش‌فرض؛ برای فارسی حیاتی است |
| `charset="utf-8"` | بدون آن حروف فارسی ممکن است خراب شوند |
| `viewport` | پایه‌ی طراحی موبایل؛ بدون آن موبایل صفحه را ۹۸۰px فرض می‌کند |
| `description` | متن زیر عنوان در نتایج جستجو |
| `skip-link` | کاربر کیبورد در اولین Tab می‌تواند ناوبری تکراری را رد کند |

> **نکته:** `script` را با `type="module"` و `defer`-مانند (ماژول‌ها خودشان defer هستند) در `head` بگذارید؛ DOM قبل از اجرا آماده است و ترتیب importها حفظ می‌شود.

## ۲. معناشناسی: صفحه را «توصیف» کنید، نه فقط «بچینید»

مرورگر `div` را فقط یک جعبه می‌بیند. صفحه‌خوان‌ها و موتورهای جستجو از تگ‌های معنایی فهرست ناوبری می‌سازند.

```html
<body>
  <header>
    <a href="/" aria-label="صفحه اصلی تسک‌یار">تسک‌یار</a>
    <nav aria-label="ناوبری اصلی">
      <ul>
        <li><a href="#features">ویژگی‌ها</a></li>
        <li><a href="#pricing">تعرفه</a></li>
        <li><a href="#signup">شروع رایگان</a></li>
      </ul>
    </nav>
  </header>

  <main id="main">
    <section aria-labelledby="hero-title">
      <h1 id="hero-title">کار تیم را ساده کنید</h1>
      <p>برد، لیست وظیفه و گزارش روزانه در یک جا.</p>
      <a class="button" href="#signup">۱۴ روز رایگان</a>
    </section>

    <section id="features" aria-labelledby="features-title">
      <h2 id="features-title">چرا تسک‌یار؟</h2>
      <article class="card">
        <h3>برد کشیدنی</h3>
        <p>وضعیت کارها را با کشیدن تغییر دهید.</p>
      </article>
    </section>
  </main>

  <footer>
    <p>© ۱۴۰۵ تسک‌یار</p>
  </footer>
</body>
```

قواعدی که reviewer واقعی روی آن گیر می‌دهد:

1. **در هر صفحه فقط یک `h1`** و سلسله‌مراتب `h2` سپس `h3` بدون پرش.
2. هر `section` بهتر است `aria-labelledby` به عنوان خودش داشته باشد.
3. برای کلیک از `<button>` (عمل) یا `<a href>` (ناوبری) استفاده کنید، نه `div` با `onclick`.
4. هر تصویر `alt` دارد؛ تصویر تزئینی `alt=""`.
5. هر input یک `label` **مرتبط** دارد (`for` = `id`).
6. دکمه‌ی فقط-آیکون `aria-label` دارد.

## ۳. مدل جعبه و واحدها: منبع ۸۰٪ باگ‌های چیدمان

هر عنصر یک جعبه است: `content → padding → border → margin`.

```css
*, *::before, *::after {
  box-sizing: border-box;
}
```

- `content-box` (پیش‌فرض): `width: 300px` فقط محتوا را می‌گیرد؛ padding و border اضافه می‌شوند.
- `border-box`: `width` شامل padding و border است. تقریباً همیشه این را می‌خواهیم.

**حاشیه‌ها روی هم می‌افتند (margin collapsing):** دو `margin-bottom` و `margin-top` مجاور جمع نمی‌شوند، بزرگ‌ترشان اعمال می‌شود. به همین دلیل استفاده از `gap` در Flex/Grid و `padding` روی والد، پیش‌بینی‌پذیرتر است.

**واحدها:**

| واحد | کاربرد |
| --- | --- |
| `rem` | نسبت به فونت ریشه؛ برای فاصله و فونت (احترام به تنظیمات کاربر) |
| `em` | نسبت به فونت همان عنصر؛ برای padding دکمه‌ای که با فونتش بزرگ می‌شود |
| `%` | نسبت به والد؛ در ارتفاع نیازمند ارتفاع مشخص والد است |
| `vw/vh` | نسبت به viewport؛ برای hero؛ در موبایل با نوار آدرس رفتار عجیب دارد |
| `dvh` | ارتفاع واقعی viewport موبایل؛ بهتر از `vh` |
| `clamp()` | مقدار سیال با کف و سقف |

```css
h1 {
  font-size: clamp(1.75rem, 1rem + 3vw, 3rem);
  line-height: 1.25;
}
```

## ۴. Flexbox: چیدمان یک‌بعدی را کامل بفهمید

Flexbox برای **یک محور** است: یا ردیف یا ستون.

```css
.nav-list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}
```

- `main axis` همان جهت `flex-direction` است (پیش‌فرض `row`).
- `justify-content` در محور اصلی، `align-items` در محور عمود.
- `flex: 1` یعنی `flex-grow:1; flex-shrink:1; flex-basis:0%`.

**باگ کلاسیک:** متن بلند داخل آیتم Flex از عرض بیرون می‌زند چون حداقل اندازه‌ی خودکار محتوا `min-width: auto` است. راه‌حل:

```css
.nav-list li { min-width: 0; }
.nav-list li a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

**ستون با فوتر چسبیده به پایین:**

```css
body {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
main { flex: 1; }
```

## ۵. Grid: چیدمان دوبعدی و شبکه‌های واکنش‌گرا بدون Media Query

```css
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}
```

- `auto-fit` ستون‌های خالی را جمع می‌کند و آیتم‌ها کشیده می‌شوند؛ `auto-fill` جای خالی را نگه می‌دارد.
- `minmax(260px, 1fr)` یعنی هر ستون حداقل ۲۶۰px و در صورت جا، سهم مساوی.

**چیدمان با نام ناحیه:**

```css
.dashboard {
  display: grid;
  gap: 1rem;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 240px minmax(0, 1fr);
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}
.dashboard > header { grid-area: header; }
.dashboard > aside { grid-area: sidebar; }
.dashboard > main { grid-area: main; }
.dashboard > footer { grid-area: footer; }
```

**تراز کردن یک آیتم در ناحیه:**

```css
.hero {
  display: grid;
  place-items: center;      /* align + justify */
  min-height: 60dvh;
  text-align: center;
}
```

`minmax(0, 1fr)` جلوی سرریز شدن ستون به‌خاطر محتوای بلند را می‌گیرد (`1fr` به‌تنهایی حداقل خودکار دارد).

**Container Queries** — واکنش‌گرایی بر اساس عرض **کارت**، نه صفحه:

```css
.card-wrap { container-type: inline-size; }

@container (min-width: 420px) {
  .card { display: grid; grid-template-columns: 120px 1fr; gap: 1rem; }
}
```

## ۶. موقعیت‌دهی و لایه‌ها (به‌اندازه‌ی نیاز)

| مقدار | نسبت به | کاربرد |
| --- | --- | --- |
| `static` | جریان عادی | پیش‌فرض |
| `relative` | موقعیت اصلی خودش | مرجع برای فرزند absolute |
| `absolute` | نزدیک‌ترین والد position‌دار | بج، منوی کشویی |
| `fixed` | viewport | هدر شناور |
| `sticky` | والد اسکرول + آستانه | ستون کنار مقاله |

```css
.card { position: relative; }
.card .badge { position: absolute; inset-block-start: 0.75rem; inset-inline-end: 0.75rem; }
```

از `inset-inline-*` به‌جای `left/right` استفاده کنید تا در RTL درست باشد.

`z-index` فقط روی عناصر `position` غیر static و در یک **stacking context** اثر دارد. ساخت stacking context با `transform`، `opacity < 1`، `filter` و… باعث می‌شود `z-index: 9999` هم بیرون نزند. اگر مودال زیر منو ماند، دنبال والد دارای `transform` بگردید، نه عدد بزرگ‌تر.

## ۷. طراحی واکنش‌گرا و سیال

```css
img, video { max-width: 100%; height: auto; display: block; }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); }

@media (min-width: 48rem) {
  .hero { grid-template-columns: 1.1fr 1fr; }
}
```

- **Mobile-first**: استایل پایه برای موبایل، سپس `min-width`.
- `min(260px, 100%)` از سرریز در صفحه‌های باریک‌تر از ۲۶۰px جلوگیری می‌کند.
- برای تصویر نسبت ثابت: `aspect-ratio: 16 / 9; object-fit: cover;`
- فونت سیال + `line-height` نسبی (۱.۵ تا ۱.۸ برای متن فارسی).

## ۸. سیستم طراحی با Custom Properties و Cascade Layers

```css
@layer reset, base, components, utilities;

@layer base {
  :root {
    --color-bg: #f8fafc;
    --color-surface: #ffffff;
    --color-text: #0f172a;
    --color-muted: #475569;
    --color-primary: #4f46e5;
    --color-primary-contrast: #ffffff;
    --radius: 12px;
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-4: 1rem;
    --space-8: 2rem;
    --shadow-card: 0 1px 2px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.08);
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --color-bg: #0b0f17;
      --color-surface: #111827;
      --color-text: #e5e7eb;
      --color-muted: #9ca3af;
      --color-primary: #818cf8;
      --color-primary-contrast: #0b0f17;
    }
  }

  html { color-scheme: light dark; }
  body { background: var(--color-bg); color: var(--color-text); font-family: system-ui, "Vazirmatn", sans-serif; }
}
```

- `@layer` ترتیب اعمال را قطعی می‌کند: `utilities` همیشه بر `components` غلبه می‌کند، بدون جنگ `!important`.
- تم دستی را با `data-theme="dark"` روی `<html>` و بازنویسی همان متغیرها پیاده کنید.
- از رنگ‌های معنایی استفاده کنید (`--color-danger`, `--color-success`) نه `--red`.

## ۹. دسترس‌پذیری: چیزهایی که در مصاحبه می‌پرسند

| موضوع | حداقل کار درست |
| --- | --- |
| کنتراست | متن معمولی ۴.۵:۱، متن بزرگ ۳:۱ (WCAG AA) |
| فوکوس | `:focus-visible` با outline واضح؛ هرگز `outline: none` بدون جایگزین |
| کیبورد | ترتیب Tab منطقی؛ مودال با Esc بسته شود و فوکوس داخل آن بماند |
| فرم | `label`، پیام خطای متصل با `aria-describedby`، `aria-invalid` |
| لینک | متن لینک گویا باشد («دانلود گزارش» نه «اینجا») |
| حرکت | `prefers-reduced-motion` را رعایت کنید |
| زبان | `lang` و `dir` درست |

```html
<div class="field">
  <label for="email">ایمیل کاری</label>
  <input id="email" name="email" type="email" autocomplete="email"
         required aria-describedby="email-help email-error" />
  <p id="email-help" class="hint">فقط ایمیل شرکتی.</p>
  <p id="email-error" class="error" role="alert" hidden>ایمیل معتبر وارد کنید.</p>
</div>
```

```css
:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

## ۱۰. فرم‌ها: اعتبارسنجی لایه‌ی اول رایگان است

```html
<form id="signup" novalidate>
  <label for="email">ایمیل</label>
  <input id="email" type="email" required minlength="5" autocomplete="email" />
  <button type="submit">شروع رایگان</button>
</form>
```

```js
const form = document.querySelector('#signup')
const email = form.querySelector('#email')

email.addEventListener('blur', () => {
  email.setAttribute('aria-invalid', String(!email.checkValidity()))
})

form.addEventListener('submit', (event) => {
  event.preventDefault()
  if (!form.reportValidity()) return   // پیام بومی مرورگر
  // ارسال به سرور
})
```

`novalidate` را بگذارید و `reportValidity()` را خودتان صدا بزنید تا بتوانید ظاهر خطا را کنترل کنید، ولی اعتبارسنجی بومی (نوع، الگو، طول) را از دست ندهید.

## ۱۱. عیب‌یابی: پنج مشکل واقعی و ریشه‌شان

| نشانه | ریشه | راه‌حل |
| --- | --- | --- |
| صفحه در موبایل زوم‌اوت است | `viewport` نیست | متاتگ viewport اضافه کنید |
| محتوا از عرض بیرون می‌زند | عرض ثابت یا `min-width:auto` در Flex/Grid | `max-width:100%`، `minmax(0,1fr)`، `min-width:0` |
| فاصله‌ها یکسان اعمال نمی‌شوند | margin collapsing | `gap` یا `padding` والد |
| دکمه با کیبورد فوکوس نمی‌شود | `div` به‌جای `button` | تگ معنایی یا `tabindex="0"` + نقش/کلیدها |
| متن روی پس‌زمینه کم‌رنگ است | کنتراست پایین | تست با DevTools → Accessibility → Contrast |
| تم تاریک نصفه اعمال می‌شود | رنگ‌های hard-code | همه‌ی رنگ‌ها را به متغیر تبدیل کنید |

ابزار: DevTools → Elements (نمای Grid/Flex)، Lighthouse → Accessibility، افزونه‌ی axe.

## ۱۲. ساخت گام‌به‌گام صفحه‌ی فرود تمرین

هدف تمرین: صفحه‌ی فرود یک SaaS با هدر، ویژگی‌ها، فرم و فوتر. این نقشه‌ی راه را دنبال کنید:

**گام ۱ — فایل‌ها**

```
fsa-01-landing-page/
├─ index.html
├─ styles.css
└─ assets/ (اختیاری)
```

**گام ۲ — اسکلت معنایی** (دقیقاً مثل بخش ۲): `header > nav`, `main > hero + features + signup`, `footer`.

**گام ۳ — توکن‌ها** در `:root` (رنگ، فاصله، شعاع، سایه) + `box-sizing` + استایل پایه‌ی `body`.

**گام ۴ — نوار ناوبری با Flexbox**: لوگو، لینک‌ها، دکمه؛ در موبایل `flex-wrap` یا منوی ساده‌ی عمودی.

**گام ۵ — بخش Hero**: یک `h1`، متن کوتاه، دکمه؛ روی دسکتاپ دو ستون (متن + تصویر) با Grid، روی موبایل یک ستون.

**گام ۶ — کارت‌های ویژگی با Grid**: سه کارت، هرکدام `article` با `h3` و متن؛ `repeat(auto-fit, minmax(min(260px,100%), 1fr))`.

**گام ۷ — فرم خبرنامه**: `label` + `input type="email"` + دکمه؛ پیام موفقیت با `role="status"`.

**گام ۸ — فوتر** و `skip-link`.

**گام ۹ — تم تاریک** با `prefers-color-scheme` و بازنویسی متغیرها.

**گام ۱۰ — بازبینی**: Tab زدن، تغییر عرض، Lighthouse، کنتراست.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `semantic` | بخش ۲ |
| `grid` | بخش ۵ و گام ۶ |
| `responsive` | بخش ۷ |
| `variables` | بخش ۸ |
| `a11y` | بخش ۹ و ۱۰ و گام ۷ |
| `separation` | ساختار فایل‌ها در گام ۱ |

## ۱۳. آزمایش‌های کوچک (با پاسخ)

**آزمایش ۱:** چرا این چیدمان در عرض ۳۲۰px اسکرول افقی می‌دهد؟

```css
.grid { display: grid; grid-template-columns: 300px 300px; gap: 1rem; }
```

**پاسخ:** دو ستون ثابت ۳۰۰px + gap = ۶۱۶px. از `repeat(auto-fit, minmax(min(260px,100%),1fr))` یا `grid-template-columns: 1fr` در media query استفاده کنید.

**آزمایش ۲:** این دکمه چرا با Tab فوکوس نمی‌شود؟

```html
<div class="btn" onclick="save()">ذخیره</div>
```

**پاسخ:** div قابل فوکوس نیست و نقش دکمه هم ندارد. `<button type="button">ذخیره</button>` درست است (فرم را هم ناخواسته ارسال نمی‌کند).

**آزمایش ۳:** چرا `z-index: 9999` روی مودال کار نمی‌کند؟

**پاسخ:** والد آن یک stacking context ساخته (مثلاً `transform: translateZ(0)`)، پس مودال فقط داخل همان لایه بالا می‌رود. مودال را به `body` منتقل کنید یا والد را از transform خلاص کنید.

**آزمایش ۴:** متن فارسی داخل یک `input` چپ‌چین است. چرا؟

**پاسخ:** `dir` روی سند باید `rtl` باشد؛ اگر فقط بخشی از صفحه LTR است، `dir="ltr"` را روی همان عنصر بگذارید. برای ورودی ایمیل/شماره عمداً `dir="ltr"` می‌گذاریم.

## ۱۴. خودآزمایی

1. تفاوت `auto-fit` و `auto-fill`؟
2. چه زمانی `flex` و چه زمانی `grid`؟
3. چرا `border-box` پیش‌فرض نمی‌شود؟
4. سه کاری که یک صفحه را برای صفحه‌خوان قابل استفاده می‌کند؟
5. تفاوت `rem` و `em` با یک مثال؟
6. چطور بدون Media Query شبکه را واکنش‌گرا می‌کنید؟

## ۱۵. چک‌لیست تحویل

- [ ] `lang`، `dir`، `charset` و `viewport`
- [ ] ساختار `header/nav/main/section/footer` + یک `h1`
- [ ] همه‌ی تصاویر `alt` (تزئینی: خالی)
- [ ] فرم با `label`، `autocomplete` و اعتبارسنجی
- [ ] تمام رنگ/فاصله‌ها از متغیر CSS
- [ ] Grid برای ویژگی‌ها، Flex برای ناوبری
- [ ] بدون اسکرول افقی در ۳۲۰px
- [ ] دسترسی کامل با Tab و `focus-visible`
- [ ] CSS جدا از HTML
- [ ] Lighthouse Accessibility بالای ۹۰
