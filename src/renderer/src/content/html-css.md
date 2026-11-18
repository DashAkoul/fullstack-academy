# HTML معنایی و CSS مدرن

> مرجع اصلی: [MDN — HTML](https://developer.mozilla.org/en-US/docs/Web/HTML) و [MDN — CSS](https://developer.mozilla.org/en-US/docs/Web/CSS)

در این درس یاد می‌گیرید یک رابط کاربری را طوری بسازید که هم درست باشد، هم سریع، هم برای همه قابل استفاده — همان چیزی که در یک تیم واقعی از یک فرانت‌اند‌کار انتظار می‌رود.

## ۱. سند HTML: اسکلت یک صفحه واقعی

```html
<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>آکادمی | یادگیری فول‌استک</title>
    <meta name="description" content="مسیر یادگیری از صفر تا فول‌استک" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <header>...</header>
    <main>...</main>
    <footer>...</footer>
  </body>
</html>
```

اجزای مهم:

| مورد | چرا مهم است |
| --- | --- |
| `lang` و `dir` | زبان و جهت متن؛ برای فارسی `dir="rtl"` ضروری است |
| `meta viewport` | پایه‌ی طراحی واکنش‌گرا روی موبایل |
| `title` و `description` | سئو و متن لینک در نتایج جستجو |
| `link` به CSS جدا | جداسازی محتوا از ظاهر |

## ۲. معناشناسی (Semantics) و دسترس‌پذیری

تگ‌ها معنا دارند؛ `div` معنایی ندارد. صفحه‌خوان (Screen Reader) و موتور جستجو از همین معنا استفاده می‌کنند.

```html
<header>
  <nav aria-label="ناوبری اصلی">
    <ul>
      <li><a href="#features">ویژگی‌ها</a></li>
      <li><a href="#pricing">تعرفه‌ها</a></li>
    </ul>
  </nav>
</header>

<main>
  <h1>مدیریت پروژه، ساده‌تر از همیشه</h1>
  <section id="features" aria-labelledby="features-title">
    <h2 id="features-title">ویژگی‌ها</h2>
    <article class="card">
      <h3>همکاری بلادرنگ</h3>
      <p>هم‌زمان با تیم خود روی یک برد کار کنید.</p>
    </article>
  </section>
</main>
```

قواعد طلایی:

- در هر صفحه فقط **یک `h1`**؛ سلسله‌مراتب `h2` → `h3` را نشکنید.
- هر `img` باید `alt` داشته باشد. اگر تصویر تزئینی است: `alt=""`.
- برای کلیک از `<button>` یا `<a>` استفاده کنید، نه `div` با `onclick`.
- هر `input` باید `label` مرتبط داشته باشد:

```html
<label for="email">ایمیل</label>
<input id="email" name="email" type="email" required autocomplete="email" />
```

- دکمه‌های صرفاً آیکونی باید `aria-label` داشته باشند.
- کنتراست متن و پس‌زمینه حداقل **4.5:1** باشد (WCAG AA).

## ۳. متغیرهای CSS (Custom Properties)

به‌جای تکرار رنگ‌ها، یک «سیستم طراحی» کوچک بسازید. این کار تغییر تم را یک‌خطی می‌کند.

```css
:root {
  --color-bg: #0b0f17;
  --color-surface: #111827;
  --color-text: #e5e7eb;
  --color-muted: #9ca3af;
  --color-primary: #6366f1;
  --radius: 12px;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-8: 2rem;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: system-ui, "Vazirmatn", sans-serif;
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: var(--space-4);
}
```

## ۴. Flexbox — چیدمان یک‌بعدی

برای نوار ناوبری، ردیف دکمه‌ها و تراز کردن آیتم‌ها در یک محور:

```css
.nav-list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
```

| ویژگی | کاربرد |
| --- | --- |
| `display: flex` | فعال‌سازی |
| `justify-content` | توزیع در محور اصلی |
| `align-items` | تراز در محور عمود |
| `gap` | فاصله بین آیتم‌ها (جایگزین margin) |
| `flex-wrap` | شکستن به خط بعد در فضای کم |

## ۵. Grid — چیدمان دوبعدی

برای شبکه‌ی کارت‌ها، داشبورد و هر چیزی که سطر و ستون دارد:

```css
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-8);
}
```

`auto-fit` + `minmax` یعنی: «تا جایی که جا هست ستون بساز؛ هر ستون حداقل ۲۶۰px». نتیجه: بدون حتی یک Media Query هم واکنش‌گراست.

برای چیدمان‌های دقیق‌تر با نام ناحیه:

```css
.layout {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}
header { grid-area: header; }
aside { grid-area: sidebar; }
main { grid-area: main; }
footer { grid-area: footer; }
```

## ۶. طراحی واکنش‌گرا

```css
@media (max-width: 640px) {
  .layout {
    grid-template-areas: "header" "main" "sidebar" "footer";
    grid-template-columns: 1fr;
  }
  .hero { font-size: 1.75rem; }
}
```

اصول:

- **Mobile-first**: استایل پایه برای موبایل، سپس با `min-width` بزرگ‌تر کنید.
- از واحدهای نسبی (`rem`, `%`, `clamp()`) استفاده کنید.
- `clamp(1.5rem, 4vw, 2.5rem)` برای تایپوگرافی سیال عالی است.
- تصاویر: `img { max-width: 100%; height: auto; }`

## ۷. باکس مدل و `box-sizing`

```css
*, *::before, *::after { box-sizing: border-box; }
```

با `border-box`، `width` شامل padding و border است — همان انتظاری که تقریباً همیشه داریم.

## ۸. ترنزیشن و تعامل

```css
button {
  background: var(--color-primary);
  transition: transform 150ms ease, filter 150ms ease;
}
button:hover { filter: brightness(1.1); }
button:active { transform: translateY(1px); }
button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

`focus-visible` هم دسترس‌پذیری با کیبورد را حفظ می‌کند، هم ظاهر کلیک ماوس را شلوغ نمی‌کند.

## چک‌لیست قبل از تحویل

- [ ] ساختار معنایی + یک `h1`
- [ ] همه تصاویر `alt` دارند
- [ ] فرم‌ها `label` و اعتبارسنجی بومی دارند
- [ ] رنگ‌ها و فاصله‌ها از متغیر CSS می‌آیند
- [ ] در عرض ۳۲۰px چیزی نمی‌شکند
- [ ] فقط با کیبورد (Tab) قابل استفاده است
- [ ] CSS در فایل جداگانه است

## تمرین این درس

صفحه فرود یک محصول SaaS را بدون فریم‌ورک بسازید: هدر با Flexbox، شبکه ویژگی‌ها با Grid، فرم عضویت در خبرنامه، و متغیرهای CSS. جزئیات و معیارهای پذیرش را در تب «تمرین» ببینید.
