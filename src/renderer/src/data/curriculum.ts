import type { Lesson, LessonMeta, Module } from './types'

// Lesson bodies live in Markdown files (content/<lessonId>.md) so code samples stay readable.
const bodies = import.meta.glob('../content/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

function body(id: string): string {
  return bodies[`../content/${id}.md`] ?? `# ${id}\n\nمحتوای این درس هنوز اضافه نشده است.`
}

interface ModuleDef {
  id: string
  title: string
  description: string
  icon: string
  lessons: LessonMeta[]
}

const MODULES: ModuleDef[] = [
  {
    id: 'frontend-basics',
    title: 'مبانی فرانت‌اند',
    description: 'HTML معنایی و دسترس‌پذیر، CSS مدرن (Flexbox/Grid)، جاوااسکریپت ES6+ و تایپ‌اسکریپت.',
    icon: 'Layout',
    lessons: [
      {
        id: 'html-css',
        title: 'HTML معنایی و CSS مدرن',
        summary: 'ساختار معنایی، دسترس‌پذیری، Flexbox، Grid، متغیرهای CSS و طراحی واکنش‌گرا.',
        minutes: 75,
        docs: [
          { title: 'MDN — HTML elements reference', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element' },
          { title: 'MDN — CSS Grid Layout', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout' },
          { title: 'MDN — Flexbox', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Flexbox' },
          { title: 'MDN — Accessibility', url: 'https://developer.mozilla.org/en-US/docs/Web/Accessibility' }
        ],
        exercise: {
          title: 'صفحه فرود محصول برای یک استارتاپ',
          scenario:
            'تیم مارکتینگ یک استارتاپ SaaS برای کمپین جدید به یک صفحه فرود (Landing Page) سریع و دسترس‌پذیر نیاز دارد. طراح فقط یک توضیح متنی داده و از شما می‌خواهد نسخه اول را بدون هیچ فریم‌ورکی پیاده کنید.',
          tasks: [
            'یک فایل index.html با ساختار معنایی کامل (header، nav، main، section، footer) بسازید.',
            'بخش «ویژگی‌ها» را با CSS Grid به‌صورت سه‌ستونه در دسکتاپ و تک‌ستونه در موبایل بچینید.',
            'نوار ناوبری را با Flexbox بسازید.',
            'رنگ‌ها و فاصله‌ها را با متغیرهای CSS (Custom Properties) تعریف کنید.',
            'یک فرم «عضویت در خبرنامه» با label و اعتبارسنجی بومی HTML اضافه کنید.'
          ],
          requirements: [
            { id: 'semantic', text: 'استفاده صحیح از تگ‌های معنایی header/nav/main/section/footer و فقط یک h1' },
            { id: 'grid', text: 'استفاده از CSS Grid برای چیدمان کارت‌های ویژگی' },
            { id: 'responsive', text: 'حداقل یک Media Query برای موبایل و چیدمان واکنش‌گرا' },
            { id: 'variables', text: 'تعریف رنگ‌ها/فاصله‌ها با CSS Custom Properties' },
            { id: 'a11y', text: 'فرم دارای label مرتبط با input، و تصاویر دارای alt معنادار' },
            { id: 'separation', text: 'CSS در فایل جداگانه (نه استایل inline)' }
          ],
          repoName: 'fsa-01-landing-page',
          hints: [
            'grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) اغلب بدون Media Query هم واکنش‌گراست.',
            'برای input از type="email" و ویژگی required استفاده کنید.'
          ]
        }
      },
      {
        id: 'javascript-es6',
        title: 'جاوااسکریپت مدرن (ES6+)',
        summary: 'let/const، توابع پیکانی، destructuring، ماژول‌ها، Promise و async/await، و Fetch API.',
        minutes: 90,
        docs: [
          { title: 'MDN — JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide' },
          { title: 'MDN — Using promises', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises' },
          { title: 'MDN — JavaScript modules', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules' },
          { title: 'MDN — Fetch API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch' }
        ],
        exercise: {
          title: 'داشبورد جستجوی کاربران GitHub',
          scenario:
            'مدیر فنی شما یک ابزار داخلی کوچک می‌خواهد: کاربر نام یک کاربر GitHub را جستجو کند و پروفایل و مخازن محبوبش را ببیند. پروژه باید بدون فریم‌ورک و با جاوااسکریپت ماژولار نوشته شود.',
          tasks: [
            'کد را حداقل در دو ماژول ES (مثلاً api.js و ui.js) تقسیم کنید.',
            'با fetch و async/await اطلاعات کاربر و مخازن را از api.github.com دریافت کنید.',
            'مخازن را بر اساس تعداد ستاره مرتب و ۵ مورد برتر را نمایش دهید (map/filter/sort).',
            'وضعیت‌های «در حال بارگذاری»، «کاربر پیدا نشد» و «خطای شبکه» را مدیریت کنید.',
            'جستجو را با debounce انجام دهید تا با هر کلید درخواست ارسال نشود.'
          ],
          requirements: [
            { id: 'modules', text: 'استفاده از import/export و تقسیم منطقی کد به ماژول‌ها' },
            { id: 'async', text: 'استفاده از async/await همراه با try/catch و بررسی response.ok' },
            { id: 'array-methods', text: 'استفاده از متدهای آرایه (sort/map/filter/slice) به‌جای حلقه‌های دستی' },
            { id: 'states', text: 'مدیریت وضعیت‌های loading، not found و error در رابط کاربری' },
            { id: 'debounce', text: 'پیاده‌سازی debounce برای ورودی جستجو' },
            { id: 'no-var', text: 'عدم استفاده از var؛ استفاده از const/let' }
          ],
          repoName: 'fsa-02-github-finder',
          hints: [
            'fetch در خطای 404 خطا پرتاب نمی‌کند؛ باید response.ok یا response.status را خودتان بررسی کنید.',
            'debounce را می‌توانید با setTimeout و clearTimeout در یک closure بسازید.'
          ]
        }
      },
      {
        id: 'typescript',
        title: 'مبانی تایپ‌اسکریپت',
        summary: 'انواع پایه، interface و type، Union و Narrowing، Generics و Utility Types.',
        minutes: 90,
        docs: [
          { title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/intro.html' },
          { title: 'Narrowing', url: 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html' },
          { title: 'Generics', url: 'https://www.typescriptlang.org/docs/handbook/2/generics.html' },
          { title: 'Utility Types', url: 'https://www.typescriptlang.org/docs/handbook/utility-types.html' }
        ],
        exercise: {
          title: 'هسته منطق سبد خرید فروشگاه آنلاین',
          scenario:
            'تیم فروشگاه اینترنتی قصد دارد منطق سبد خرید را از UI جدا کند تا در وب و موبایل مشترک باشد. شما مسئول نوشتن یک کتابخانه کوچک و کاملاً تایپ‌شده با تایپ‌اسکریپت هستید.',
          tasks: [
            'پروژه را با tsconfig و "strict": true راه‌اندازی کنید.',
            'انواع Product، CartItem و Cart را تعریف کنید.',
            'توابع addItem، removeItem، updateQuantity و calculateTotal را بنویسید (بدون تغییر مستقیم ورودی — immutable).',
            'تخفیف‌ها را به‌صورت Discriminated Union مدل کنید: درصدی، مبلغ ثابت، و «خرید X دریافت Y».',
            'یک تابع Generic به نام groupBy بنویسید و از آن برای گروه‌بندی محصولات بر اساس دسته استفاده کنید.'
          ],
          requirements: [
            { id: 'strict', text: 'tsconfig با strict فعال و نبودن any غیرضروری' },
            { id: 'types', text: 'تعریف صحیح انواع با interface/type و استفاده از readonly در جای مناسب' },
            { id: 'union', text: 'مدل‌سازی تخفیف با Discriminated Union و narrowing با switch (همراه بررسی exhaustive با never)' },
            { id: 'generic', text: 'پیاده‌سازی تابع Generic به نام groupBy با تایپ صحیح خروجی' },
            { id: 'immutable', text: 'توابع سبد خرید ورودی را mutate نمی‌کنند' },
            { id: 'utility', text: 'استفاده از حداقل یک Utility Type (Partial/Pick/Omit/Record)' }
          ],
          repoName: 'fsa-03-ts-cart-core',
          hints: [
            'برای بررسی exhaustive، در default بنویسید: const _never: never = discount',
            'امضای groupBy می‌تواند این باشد: groupBy<T, K extends PropertyKey>(items: T[], key: (t: T) => K): Record<K, T[]>'
          ]
        }
      }
    ]
  },
  {
    id: 'tools-architecture',
    title: 'ابزارها و معماری',
    description: 'کنترل نسخه با Git، مدیریت بسته‌ها با npm/pnpm/yarn و ابزار ساخت Vite.',
    icon: 'Wrench',
    lessons: [
      {
        id: 'git',
        title: 'Git و کنترل نسخه',
        summary: 'مدل ذهنی Git، شاخه‌ها، merge و rebase، Conventional Commits و جریان کاری Pull Request.',
        minutes: 70,
        docs: [
          { title: 'Pro Git Book', url: 'https://git-scm.com/book/en/v2' },
          { title: 'Git Reference', url: 'https://git-scm.com/docs' },
          { title: 'GitHub Flow', url: 'https://docs.github.com/en/get-started/using-github/github-flow' },
          { title: 'Conventional Commits', url: 'https://www.conventionalcommits.org/en/v1.0.0/' }
        ],
        exercise: {
          title: 'آماده‌سازی مخزن استاندارد تیمی',
          scenario:
            'به‌عنوان اولین وظیفه در شرکت جدید، از شما خواسته شده یک مخزن الگو (Template Repository) آماده کنید که همه پروژه‌های جدید تیم از آن شروع شوند و فرایند مشارکت را استاندارد کند.',
          tasks: [
            'یک README کامل با بخش‌های معرفی، نصب، اجرا و مشارکت بنویسید.',
            'فایل ‎.gitignore مناسب پروژه‌های Node.js اضافه کنید.',
            'فایل CONTRIBUTING.md شامل قواعد نام‌گذاری شاخه و Conventional Commits بنویسید.',
            'قالب Pull Request در ‎.github/pull_request_template.md و قالب Issue گزارش باگ اضافه کنید.',
            'حداقل یک شاخه feature بسازید و با Pull Request ادغام کنید؛ پیام‌های commit باید Conventional باشند.'
          ],
          requirements: [
            { id: 'readme', text: 'README.md ساختاریافته با دستورالعمل نصب و اجرا' },
            { id: 'gitignore', text: '‎.gitignore شامل node_modules، فایل‌های env و خروجی‌های build' },
            { id: 'contributing', text: 'CONTRIBUTING.md با قواعد شاخه‌بندی و نمونه پیام commit' },
            { id: 'templates', text: 'قالب Pull Request و Issue در پوشه ‎.github' },
            { id: 'commits', text: 'پیام آخرین commit از قالب Conventional Commits پیروی می‌کند' }
          ],
          repoName: 'fsa-04-team-template',
          hints: [
            'قالب Issue در مسیر ‎.github/ISSUE_TEMPLATE/bug_report.md قرار می‌گیرد.',
            'نمونه پیام: feat(auth): add login form validation'
          ]
        }
      },
      {
        id: 'package-managers',
        title: 'مدیریت بسته‌ها: npm، pnpm و yarn',
        summary: 'package.json، نسخه‌بندی معنایی، lockfile، اسکریپت‌ها، workspaceها و امنیت وابستگی‌ها.',
        minutes: 60,
        docs: [
          { title: 'npm Docs — package.json', url: 'https://docs.npmjs.com/cli/configuring-npm/package-json' },
          { title: 'npm — About semantic versioning', url: 'https://docs.npmjs.com/about-semantic-versioning' },
          { title: 'pnpm — Workspaces', url: 'https://pnpm.io/workspaces' },
          { title: 'Yarn Docs', url: 'https://yarnpkg.com/getting-started' }
        ],
        exercise: {
          title: 'ابزار خط فرمان (CLI) برای تبدیل واحد',
          scenario:
            'تیم پشتیبانی بارها به تبدیل واحدها (دما، طول، وزن) نیاز دارد. از شما خواسته شده یک ابزار CLI قابل نصب با npm بسازید که بعداً در رجیستری داخلی منتشر شود.',
          tasks: [
            'یک package.json کامل با name، version، description، bin، engines و license بسازید.',
            'فایل اجرایی CLI را با shebang بنویسید و آرگومان‌ها را از process.argv بخوانید (یا از یک کتابخانه مثل commander استفاده کنید).',
            'اسکریپت‌های start، test و lint تعریف کنید.',
            'وابستگی‌های زمان توسعه را در devDependencies قرار دهید.',
            'lockfile را commit کنید و در README نحوه نصب سراسری را توضیح دهید.'
          ],
          requirements: [
            { id: 'package-json', text: 'package.json معتبر با فیلدهای bin، engines، scripts و license' },
            { id: 'deps', text: 'تفکیک صحیح dependencies و devDependencies' },
            { id: 'cli', text: 'فایل CLI دارای shebang و مدیریت آرگومان نامعتبر با پیام راهنما و exit code غیرصفر' },
            { id: 'lockfile', text: 'وجود lockfile در مخزن (package-lock.json یا pnpm-lock.yaml یا yarn.lock)' },
            { id: 'tests', text: 'حداقل چند تست برای توابع تبدیل (مثلاً با node:test)' }
          ],
          repoName: 'fsa-05-unit-cli',
          hints: [
            'خط اول فایل اجرایی: ‎#!/usr/bin/env node',
            'Node.js از نسخه 18 اجراکننده تست داخلی دارد: node --test'
          ]
        }
      },
      {
        id: 'vite',
        title: 'Vite و ابزارهای ساخت',
        summary: 'سرور توسعه، HMR، متغیرهای محیطی، alias، ساخت production و تقسیم کد.',
        minutes: 55,
        docs: [
          { title: 'Vite — Guide', url: 'https://vite.dev/guide/' },
          { title: 'Vite — Env Variables and Modes', url: 'https://vite.dev/guide/env-and-mode' },
          { title: 'Vite — Config', url: 'https://vite.dev/config/' },
          { title: 'Vite — Building for Production', url: 'https://vite.dev/guide/build' }
        ],
        exercise: {
          title: 'مهاجرت ویجت آب‌وهوا به Vite',
          scenario:
            'یک ویجت آب‌وهوای قدیمی با تگ‌های script پراکنده نوشته شده و کلید API را در کد قرار داده است. شما باید آن را به یک پروژه Vite + TypeScript مهاجرت دهید و پیکربندی را حرفه‌ای کنید.',
          tasks: [
            'پروژه را با create-vite و قالب vanilla-ts بسازید.',
            'آدرس API و کلید را از متغیرهای محیطی با پیشوند VITE_ بخوانید و فایل ‎.env.example بسازید.',
            'در vite.config.ts یک alias به نام @ برای پوشه src تعریف کنید.',
            'بخش «پیش‌بینی ۷ روزه» را با import() پویا به‌صورت lazy بارگذاری کنید.',
            'اسکریپت‌های dev، build و preview را داشته باشید.'
          ],
          requirements: [
            { id: 'vite-config', text: 'vite.config.ts با alias تعریف‌شده و تنظیم tsconfig paths مطابق آن' },
            { id: 'env', text: 'استفاده از import.meta.env با پیشوند VITE_ و وجود ‎.env.example (بدون commit کردن ‎.env)' },
            { id: 'types-env', text: 'تعریف نوع متغیرهای محیطی در vite-env.d.ts' },
            { id: 'code-split', text: 'استفاده از import() پویا برای تقسیم کد' },
            { id: 'no-secrets', text: 'هیچ کلید یا راز واقعی در کد commit نشده است' }
          ],
          repoName: 'fsa-06-vite-weather',
          hints: [
            'interface ImportMetaEnv را در src/vite-env.d.ts گسترش دهید.',
            'API رایگان Open-Meteo نیاز به کلید ندارد و برای تمرین مناسب است.'
          ]
        }
      }
    ]
  },
  {
    id: 'advanced-web',
    title: 'توسعه وب پیشرفته',
    description: 'React با Hooks، مدیریت State با Context/Zustand/Redux، و Next.js با App Router.',
    icon: 'Atom',
    lessons: [
      {
        id: 'react-hooks',
        title: 'React و Hooks',
        summary: 'کامپوننت‌ها، props، useState، useEffect، useRef، useMemo و Custom Hooks.',
        minutes: 100,
        docs: [
          { title: 'React — Learn', url: 'https://react.dev/learn' },
          { title: 'React — Built-in Hooks', url: 'https://react.dev/reference/react/hooks' },
          { title: 'You Might Not Need an Effect', url: 'https://react.dev/learn/you-might-not-need-an-effect' },
          { title: 'Reusing Logic with Custom Hooks', url: 'https://react.dev/learn/reusing-logic-with-custom-hooks' }
        ],
        exercise: {
          title: 'برد کانبان مدیریت وظایف',
          scenario:
            'یک تیم کوچک محصول به یک برد کانبان ساده (To Do / In Progress / Done) نیاز دارد. شما باید آن را با React و TypeScript بسازید به‌طوری‌که داده‌ها پس از رفرش حفظ شوند.',
          tasks: [
            'پروژه را با Vite و قالب react-ts بسازید.',
            'کامپوننت‌های Board، Column و TaskCard را با props تایپ‌شده بسازید.',
            'افزودن، ویرایش، حذف و جابه‌جایی وظیفه بین ستون‌ها را پیاده کنید.',
            'یک Custom Hook به نام useLocalStorage بنویسید و state را در localStorage نگه دارید.',
            'جستجوی وظایف را با useMemo بهینه کنید و فوکوس فیلد افزودن را با useRef مدیریت کنید.'
          ],
          requirements: [
            { id: 'components', text: 'تقسیم UI به کامپوننت‌های کوچک با props تایپ‌شده' },
            { id: 'state', text: 'به‌روزرسانی immutable وضعیت و استفاده از key پایدار (نه index) در لیست‌ها' },
            { id: 'custom-hook', text: 'Custom Hook به نام useLocalStorage با تایپ Generic' },
            { id: 'effects', text: 'استفاده صحیح از useEffect با آرایه وابستگی درست (یا اجتناب از Effect غیرضروری)' },
            { id: 'memo-ref', text: 'استفاده بجا از useMemo و useRef' }
          ],
          repoName: 'fsa-07-react-kanban',
          hints: [
            'برای شناسه پایدار از crypto.randomUUID() استفاده کنید.',
            'مقدار اولیه useState می‌تواند یک تابع باشد (lazy initializer) تا localStorage فقط یک بار خوانده شود.'
          ]
        }
      },
      {
        id: 'react-state',
        title: 'مدیریت State: Context، Zustand و Redux',
        summary: 'Prop drilling، Context API، useReducer، Zustand و Redux Toolkit و انتخاب ابزار مناسب.',
        minutes: 90,
        docs: [
          { title: 'React — Passing Data Deeply with Context', url: 'https://react.dev/learn/passing-data-deeply-with-context' },
          { title: 'React — Scaling Up with Reducer and Context', url: 'https://react.dev/learn/scaling-up-with-reducer-and-context' },
          { title: 'Zustand Docs', url: 'https://zustand.docs.pmnd.rs/getting-started/introduction' },
          { title: 'Redux Toolkit — Quick Start', url: 'https://redux-toolkit.js.org/tutorials/quick-start' }
        ],
        exercise: {
          title: 'فروشگاه کوچک با سبد خرید سراسری',
          scenario:
            'یک کسب‌وکار محلی می‌خواهد کاتالوگ محصولاتش را آنلاین کند. صفحه محصولات، سبد خرید و تم تیره/روشن باید در کل برنامه هماهنگ باشند.',
          tasks: [
            'لیست محصولات را از https://fakestoreapi.com/products یا یک فایل JSON محلی بارگذاری کنید.',
            'تم تیره/روشن را با Context API پیاده کنید.',
            'سبد خرید را با Zustand (یا Redux Toolkit) و middleware ذخیره‌سازی (persist) پیاده کنید.',
            'با selectorها فقط بخش لازم state را در هر کامپوننت بخوانید.',
            'در README توضیح دهید چرا برای هر بخش ابزار متفاوتی انتخاب کرده‌اید.'
          ],
          requirements: [
            { id: 'context', text: 'Context با Provider و Custom Hook (مثلاً useTheme) با بررسی استفاده خارج از Provider' },
            { id: 'store', text: 'Store سبد خرید با Zustand یا Redux Toolkit شامل actionهای افزودن/حذف/تغییر تعداد' },
            { id: 'selectors', text: 'استفاده از selector برای جلوگیری از رندرهای اضافی' },
            { id: 'persist', text: 'ماندگاری سبد خرید پس از رفرش' },
            { id: 'derived', text: 'مقادیر مشتق (جمع کل، تعداد) محاسبه می‌شوند و جداگانه در state ذخیره نمی‌شوند' }
          ],
          repoName: 'fsa-08-react-store',
          hints: [
            'در Zustand: const count = useCart((s) => s.items.length)',
            'Context برای داده‌های کم‌تغییر (تم، زبان) مناسب است؛ برای state پرتغییر از store استفاده کنید.'
          ]
        }
      },
      {
        id: 'nextjs',
        title: 'Next.js و App Router',
        summary: 'Server و Client Components، مسیریابی فایل‌محور، SSR، SSG، ISR، Server Actions و Metadata.',
        minutes: 110,
        docs: [
          { title: 'Next.js Docs', url: 'https://nextjs.org/docs' },
          { title: 'Server and Client Components', url: 'https://nextjs.org/docs/app/getting-started/server-and-client-components' },
          { title: 'Fetching Data', url: 'https://nextjs.org/docs/app/getting-started/fetching-data' },
          { title: 'Updating Data (Server Actions)', url: 'https://nextjs.org/docs/app/getting-started/updating-data' }
        ],
        exercise: {
          title: 'وبلاگ شرکتی با Next.js',
          scenario:
            'واحد محتوای شرکت یک وبلاگ سریع و سئوپسند می‌خواهد. صفحات مقاله باید ایستا تولید شوند، صفحه اصلی هر ۶۰ ثانیه تازه شود و فرم تماس بدون API جداگانه کار کند.',
          tasks: [
            'پروژه را با create-next-app و App Router و TypeScript بسازید.',
            'مسیر پویا app/blog/[slug]/page.tsx با generateStaticParams برای تولید ایستا بسازید.',
            'برای هر مقاله generateMetadata پیاده کنید.',
            'صفحه اصلی را با revalidate = 60 (ISR) پیکربندی کنید.',
            'فرم تماس را با Server Action و اعتبارسنجی سمت سرور پیاده کنید.',
            'فایل‌های loading.tsx، error.tsx و not-found.tsx را اضافه کنید.'
          ],
          requirements: [
            { id: 'app-router', text: 'استفاده از ساختار app/ با layout.tsx و مسیر پویا [slug]' },
            { id: 'ssg', text: 'استفاده از generateStaticParams برای صفحات مقاله' },
            { id: 'metadata', text: 'پیاده‌سازی generateMetadata یا export metadata' },
            { id: 'server-client', text: 'تفکیک درست Server و Client Components ("use client" فقط در جای لازم)' },
            { id: 'server-action', text: 'فرم تماس با Server Action ("use server") و اعتبارسنجی ورودی' },
            { id: 'ui-states', text: 'وجود loading.tsx/error.tsx/not-found.tsx و فراخوانی notFound() برای slug نامعتبر' }
          ],
          repoName: 'fsa-09-next-blog',
          hints: [
            'در Next.js 15+ پارامترهای params یک Promise هستند: const { slug } = await params',
            'error.tsx باید Client Component باشد.'
          ]
        }
      }
    ]
  },
  {
    id: 'mobile',
    title: 'توسعه موبایل',
    description: 'React Native با Expo، مسیریابی با Expo Router و دسترسی به APIهای بومی دستگاه.',
    icon: 'Smartphone',
    lessons: [
      {
        id: 'expo-basics',
        title: 'React Native و Expo: مبانی',
        summary: 'کامپوننت‌های هسته، StyleSheet، Flexbox در موبایل، FlatList و تفاوت‌ها با وب.',
        minutes: 90,
        docs: [
          { title: 'Expo — Get started', url: 'https://docs.expo.dev/get-started/introduction/' },
          { title: 'React Native — Core Components', url: 'https://reactnative.dev/docs/components-and-apis' },
          { title: 'React Native — Flexbox', url: 'https://reactnative.dev/docs/flexbox' },
          { title: 'React Native — FlatList', url: 'https://reactnative.dev/docs/flatlist' }
        ],
        exercise: {
          title: 'اپ ردیاب عادت‌ها (Habit Tracker)',
          scenario:
            'یک استارتاپ سلامت روان، نسخه اولیه (MVP) یک اپ ثبت عادت‌های روزانه را می‌خواهد تا روی iOS و Android تست کاربر بگیرد.',
          tasks: [
            'پروژه را با create-expo-app و TypeScript بسازید.',
            'لیست عادت‌ها را با FlatList نمایش دهید و امکان علامت‌زدن انجام روزانه را فراهم کنید.',
            'فرم افزودن عادت با TextInput و اعتبارسنجی ساده بسازید.',
            'داده‌ها را با ‎@react-native-async-storage/async-storage ذخیره کنید.',
            'استایل‌ها را با StyleSheet.create بنویسید و SafeAreaView را رعایت کنید.'
          ],
          requirements: [
            { id: 'expo-ts', text: 'پروژه Expo با TypeScript و app.json/app.config پیکربندی‌شده' },
            { id: 'flatlist', text: 'استفاده از FlatList با keyExtractor (نه map داخل ScrollView برای لیست پویا)' },
            { id: 'styles', text: 'استفاده از StyleSheet.create و چیدمان Flexbox' },
            { id: 'storage', text: 'ماندگاری داده با AsyncStorage همراه با مدیریت خطا' },
            { id: 'safe-area', text: 'رعایت Safe Area و قابلیت لمس مناسب (Pressable با حداقل اندازه)' }
          ],
          repoName: 'fsa-10-habit-tracker',
          hints: [
            'npx expo install برای نصب نسخه سازگار کتابخانه‌ها با SDK استفاده کنید.',
            'از react-native-safe-area-context برای SafeAreaView استفاده کنید.'
          ]
        }
      },
      {
        id: 'expo-router',
        title: 'مسیریابی با Expo Router',
        summary: 'مسیریابی فایل‌محور، Stack و Tabs، مسیرهای پویا، layoutها و Deep Linking.',
        minutes: 70,
        docs: [
          { title: 'Expo Router — Introduction', url: 'https://docs.expo.dev/router/introduction/' },
          { title: 'Expo Router — Layouts', url: 'https://docs.expo.dev/router/basics/layout/' },
          { title: 'Expo Router — Navigation', url: 'https://docs.expo.dev/router/basics/navigation/' },
          { title: 'Expo — Linking', url: 'https://docs.expo.dev/linking/overview/' }
        ],
        exercise: {
          title: 'اپ منوی رستوران',
          scenario:
            'یک رستوران زنجیره‌ای اپی می‌خواهد که مشتری منو را ببیند، جزئیات غذا را بخواند و سفارش را در تب جداگانه مدیریت کند. لینک مستقیم به هر غذا باید از طریق Deep Link کار کند.',
          tasks: [
            'ساختار app/ با (tabs)/_layout.tsx شامل تب‌های «منو»، «سفارش» و «پروفایل» بسازید.',
            'صفحه جزئیات پویا app/menu/[id].tsx بسازید و پارامتر را با useLocalSearchParams بخوانید.',
            'با Link و router.push بین صفحات حرکت کنید.',
            'scheme اپ را در app.json تنظیم کنید تا Deep Link کار کند.',
            'یک صفحه +not-found.tsx اضافه کنید.'
          ],
          requirements: [
            { id: 'tabs', text: 'استفاده از Tabs در یک گروه مسیر (tabs) با _layout.tsx' },
            { id: 'dynamic', text: 'مسیر پویا [id] و خواندن پارامتر با تایپ مناسب' },
            { id: 'navigation', text: 'استفاده از Link یا useRouter برای ناوبری' },
            { id: 'scheme', text: 'تنظیم scheme در app.json برای Deep Linking' },
            { id: 'not-found', text: 'مدیریت مسیر نامعتبر و آیتم ناموجود' }
          ],
          repoName: 'fsa-11-restaurant-menu',
          hints: [
            'const { id } = useLocalSearchParams<{ id: string }>()',
            'برای تست Deep Link: npx uri-scheme open myapp://menu/3 --ios'
          ]
        }
      },
      {
        id: 'native-apis',
        title: 'APIهای بومی و Native Modules',
        summary: 'مجوزها، دوربین، موقعیت مکانی، اعلان‌ها، SecureStore و ماژول‌های بومی با Expo Modules API.',
        minutes: 85,
        docs: [
          { title: 'Expo — Permissions', url: 'https://docs.expo.dev/guides/permissions/' },
          { title: 'Expo Location', url: 'https://docs.expo.dev/versions/latest/sdk/location/' },
          { title: 'Expo ImagePicker', url: 'https://docs.expo.dev/versions/latest/sdk/imagepicker/' },
          { title: 'Expo Modules API', url: 'https://docs.expo.dev/modules/overview/' }
        ],
        exercise: {
          title: 'اپ گزارش خرابی شهری',
          scenario:
            'شهرداری می‌خواهد شهروندان خرابی‌ها (چاله، چراغ خاموش) را با عکس و موقعیت مکانی گزارش دهند. اپ باید مجوزها را محترمانه درخواست کند و در صورت رد شدن هم کار کند.',
          tasks: [
            'با expo-image-picker امکان گرفتن عکس یا انتخاب از گالری را فراهم کنید.',
            'موقعیت فعلی را با expo-location دریافت و نمایش دهید.',
            'برای همه مجوزها، حالت «رد شده» را مدیریت و راه رفتن به تنظیمات را پیشنهاد کنید.',
            'توکن فرضی کاربر را با expo-secure-store ذخیره کنید.',
            'توضیحات مجوزها (usage descriptions) را در app.json از طریق config plugins تنظیم کنید.'
          ],
          requirements: [
            { id: 'permissions', text: 'درخواست مجوز درست قبل از استفاده و مدیریت حالت denied' },
            { id: 'camera', text: 'استفاده صحیح از ImagePicker و نمایش پیش‌نمایش عکس' },
            { id: 'location', text: 'دریافت موقعیت با مدیریت خطا و حالت بارگذاری' },
            { id: 'secure', text: 'ذخیره اطلاعات حساس با SecureStore (نه AsyncStorage)' },
            { id: 'config', text: 'متن توضیح مجوزها در app.json/app.config' }
          ],
          repoName: 'fsa-12-city-reporter',
          hints: [
            'Linking.openSettings() کاربر را به تنظیمات اپ می‌برد.',
            'هرگز مجوز را هنگام باز شدن اپ درخواست نکنید؛ در لحظه نیاز درخواست کنید.'
          ]
        }
      }
    ]
  },
  {
    id: 'backend',
    title: 'بک‌اند و پایگاه داده',
    description: 'Node.js، Express و NestJS، طراحی REST API، GraphQL، PostgreSQL و Prisma.',
    icon: 'Server',
    lessons: [
      {
        id: 'nodejs',
        title: 'مبانی Node.js',
        summary: 'Event Loop، ماژول‌ها، fs/promises، Streamها، EventEmitter و متغیرهای محیطی.',
        minutes: 80,
        docs: [
          { title: 'Node.js — Learn', url: 'https://nodejs.org/en/learn' },
          { title: 'The Node.js Event Loop', url: 'https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick' },
          { title: 'Node.js API — fs', url: 'https://nodejs.org/api/fs.html' },
          { title: 'Node.js API — Stream', url: 'https://nodejs.org/api/stream.html' }
        ],
        exercise: {
          title: 'تحلیل‌گر فایل‌های لاگ سرور',
          scenario:
            'تیم عملیات روزانه چند گیگابایت لاگ Nginx تولید می‌کند و می‌خواهد گزارشی از پرتکرارترین مسیرها، کدهای خطا و ساعات اوج داشته باشد. اسکریپت باید روی فایل‌های بزرگ بدون پر شدن حافظه کار کند.',
          tasks: [
            'فایل لاگ را با Stream و readline خط به خط بخوانید (نه readFile).',
            'آمار کدهای وضعیت، ۱۰ مسیر پرتکرار و توزیع ساعتی را محاسبه کنید.',
            'خروجی را به فرمت JSON در فایل با fs/promises بنویسید.',
            'پیشرفت پردازش را با EventEmitter گزارش دهید.',
            'مسیر فایل ورودی را از آرگومان یا متغیر محیطی بخوانید و خطای فایل ناموجود را مدیریت کنید.'
          ],
          requirements: [
            { id: 'streams', text: 'پردازش فایل با Stream/readline بدون بارگذاری کامل در حافظه' },
            { id: 'fs-promises', text: 'استفاده از fs/promises و async/await برای عملیات فایل' },
            { id: 'events', text: 'استفاده از EventEmitter (یا کلاسی که از آن ارث می‌برد)' },
            { id: 'errors', text: 'مدیریت خطا برای فایل ناموجود و خطوط نامعتبر' },
            { id: 'esm', text: 'استفاده از ES Modules یا ساختار ماژولار تمیز با import از node:' }
          ],
          repoName: 'fsa-13-log-analyzer',
          hints: [
            'readline.createInterface({ input: fs.createReadStream(path) }) و for await...of',
            'یک فایل لاگ نمونه در پوشه samples قرار دهید.'
          ]
        }
      },
      {
        id: 'express-rest',
        title: 'Express و طراحی REST API',
        summary: 'مسیرها، middleware، اعتبارسنجی، مدیریت خطای متمرکز، کدهای وضعیت HTTP و صفحه‌بندی.',
        minutes: 100,
        docs: [
          { title: 'Express — Guide', url: 'https://expressjs.com/en/guide/routing.html' },
          { title: 'Express — Error Handling', url: 'https://expressjs.com/en/guide/error-handling.html' },
          { title: 'MDN — HTTP response status codes', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status' },
          { title: 'Zod — Documentation', url: 'https://zod.dev/' }
        ],
        exercise: {
          title: 'API مدیریت کتابخانه',
          scenario:
            'یک کتابخانه عمومی برای اپ موبایل جدیدش به یک REST API نیاز دارد: مدیریت کتاب‌ها، جستجو و صفحه‌بندی. تیم موبایل منتظر یک API تمیز و مستند است.',
          tasks: [
            'یک سرور Express با TypeScript راه‌اندازی کنید و ساختار routes/controllers/services داشته باشید.',
            'CRUD کامل برای ‎/api/books با کدهای وضعیت صحیح (200، 201، 204، 400، 404) پیاده کنید.',
            'ورودی‌ها را با Zod اعتبارسنجی کنید.',
            'صفحه‌بندی (page/limit) و فیلتر جستجو با query string اضافه کنید.',
            'یک middleware مدیریت خطای متمرکز و یک middleware لاگ درخواست بنویسید.',
            'endpointها را در README یا با فایل OpenAPI مستند کنید.'
          ],
          requirements: [
            { id: 'structure', text: 'ساختار لایه‌ای (route/controller/service) و عدم قرار دادن همه کد در یک فایل' },
            { id: 'rest', text: 'متدها و کدهای وضعیت HTTP مطابق اصول REST' },
            { id: 'validation', text: 'اعتبارسنجی ورودی با Zod یا ابزار مشابه و پاسخ 400 با پیام مناسب' },
            { id: 'error-mw', text: 'middleware مدیریت خطای متمرکز با چهار پارامتر (err, req, res, next)' },
            { id: 'pagination', text: 'صفحه‌بندی و جستجو از طریق query params' },
            { id: 'docs', text: 'مستندسازی endpointها' }
          ],
          repoName: 'fsa-14-library-api',
          hints: [
            'در Express 5، خطاهای Promise در handlerها خودکار به middleware خطا می‌رسند.',
            'برای 204 بدنه پاسخ ارسال نکنید: res.status(204).end()'
          ]
        }
      },
      {
        id: 'nestjs',
        title: 'NestJS: معماری ماژولار بک‌اند',
        summary: 'Module، Controller و Provider، تزریق وابستگی، DTO و ValidationPipe، Guardها.',
        minutes: 90,
        docs: [
          { title: 'NestJS — First steps', url: 'https://docs.nestjs.com/first-steps' },
          { title: 'NestJS — Providers', url: 'https://docs.nestjs.com/providers' },
          { title: 'NestJS — Validation', url: 'https://docs.nestjs.com/techniques/validation' },
          { title: 'NestJS — Guards', url: 'https://docs.nestjs.com/guards' }
        ],
        exercise: {
          title: 'سرویس رزرو نوبت کلینیک',
          scenario:
            'یک کلینیک دندان‌پزشکی سیستم رزرو آنلاین می‌خواهد. تیم شما NestJS را برای ساختار قابل‌نگهداری انتخاب کرده و شما ماژول «نوبت‌ها» را می‌سازید.',
          tasks: [
            'پروژه را با Nest CLI بسازید و ماژول appointments را با controller و service ایجاد کنید.',
            'DTOهای ایجاد و ویرایش نوبت را با class-validator تعریف و ValidationPipe سراسری را فعال کنید.',
            'جلوگیری از رزرو تداخلی (دو نوبت هم‌زمان برای یک پزشک) را در service پیاده کنید و ConflictException برگردانید.',
            'یک Guard ساده بر اساس هدر x-api-key برای مسیرهای مدیریتی بسازید.',
            'برای service تست واحد با ‎@nestjs/testing بنویسید.'
          ],
          requirements: [
            { id: 'modules', text: 'ساختار Module/Controller/Service و تزریق وابستگی از طریق constructor' },
            { id: 'dto', text: 'DTO با decoratorهای class-validator و ValidationPipe با whitelist' },
            { id: 'exceptions', text: 'استفاده از Exceptionهای HTTP داخلی Nest (NotFound/Conflict)' },
            { id: 'guard', text: 'پیاده‌سازی Guard با CanActivate' },
            { id: 'tests', text: 'تست واحد برای منطق تداخل نوبت' }
          ],
          repoName: 'fsa-15-clinic-booking',
          hints: [
            'app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))',
            'دو بازه [a,b) و [c,d) زمانی تداخل دارند که a < d && c < b'
          ]
        }
      },
      {
        id: 'postgres-prisma',
        title: 'PostgreSQL و Prisma',
        summary: 'مدل‌سازی رابطه‌ای، SQL پایه، Prisma Schema، مهاجرت‌ها، روابط، تراکنش‌ها و ایندکس.',
        minutes: 100,
        docs: [
          { title: 'PostgreSQL Tutorial', url: 'https://www.postgresql.org/docs/current/tutorial.html' },
          { title: 'Prisma — Schema', url: 'https://www.prisma.io/docs/orm/prisma-schema' },
          { title: 'Prisma — Relations', url: 'https://www.prisma.io/docs/orm/prisma-schema/data-model/relations' },
          { title: 'Prisma — Transactions', url: 'https://www.prisma.io/docs/orm/prisma-client/queries/transactions' }
        ],
        exercise: {
          title: 'پایگاه داده سیستم فروش بلیت رویداد',
          scenario:
            'یک پلتفرم فروش بلیت کنسرت با مشکل «فروش بیش از ظرفیت» مواجه شده است. شما باید لایه داده را با PostgreSQL و Prisma از نو طراحی کنید.',
          tasks: [
            'مدل‌های User، Event، Ticket و Order را با روابط مناسب در schema.prisma تعریف کنید.',
            'مهاجرت‌ها را با prisma migrate بسازید و در مخزن commit کنید.',
            'خرید بلیت را در یک تراکنش پیاده کنید تا ظرفیت هرگز منفی نشود.',
            'یک فایل seed برای داده‌های نمونه بنویسید.',
            'برای ستون‌های پرجستجو ایندکس تعریف کنید و یک docker-compose برای PostgreSQL اضافه کنید.'
          ],
          requirements: [
            { id: 'schema', text: 'schema.prisma با روابط one-to-many/many-to-many و ‎@relation صحیح' },
            { id: 'migrations', text: 'پوشه prisma/migrations در مخزن موجود است' },
            { id: 'transaction', text: 'خرید بلیت در prisma.$transaction با بررسی/کاهش اتمیک ظرفیت' },
            { id: 'seed', text: 'اسکریپت seed' },
            { id: 'indexes', text: 'تعریف ‎@@index یا ‎@unique برای ستون‌های مناسب' },
            { id: 'env', text: 'DATABASE_URL از متغیر محیطی و وجود ‎.env.example' }
          ],
          repoName: 'fsa-16-ticketing-db',
          hints: [
            'updateMany با where: { id, capacity: { gte: qty } } و decrement، به‌روزرسانی اتمیک می‌دهد؛ count را بررسی کنید.',
            'مبالغ پولی را با Decimal یا عدد صحیح (ریال) ذخیره کنید، نه Float.'
          ]
        }
      },
      {
        id: 'graphql',
        title: 'GraphQL',
        summary: 'Schema و Typeها، Query و Mutation، Resolverها، مسئله N+1 و DataLoader.',
        minutes: 85,
        docs: [
          { title: 'GraphQL — Learn', url: 'https://graphql.org/learn/' },
          { title: 'Apollo Server — Get started', url: 'https://www.apollographql.com/docs/apollo-server/getting-started' },
          { title: 'GraphQL — Best Practices', url: 'https://graphql.org/learn/best-practices/' },
          { title: 'DataLoader', url: 'https://github.com/graphql/dataloader' }
        ],
        exercise: {
          title: 'API گراف‌کیوال برای پلتفرم آموزش آنلاین',
          scenario:
            'تیم فرانت‌اند از چندین endpoint REST برای صفحه دوره خسته شده است. از شما خواسته شده یک لایه GraphQL بسازید که دوره‌ها، مدرسان و دیدگاه‌ها را با یک درخواست برگرداند.',
          tasks: [
            'Schema شامل typeهای Course، Instructor و Review با روابط بین آن‌ها تعریف کنید.',
            'Queryهای courses (با صفحه‌بندی) و course(id) و Mutation افزودن دیدگاه پیاده کنید.',
            'برای جلوگیری از مسئله N+1 از DataLoader استفاده کنید.',
            'ورودی Mutation را با input type تعریف و اعتبارسنجی کنید.',
            'خطاها را با GraphQLError و extensions.code مناسب برگردانید.'
          ],
          requirements: [
            { id: 'schema', text: 'Schema با typeها، روابط و Non-Null مناسب' },
            { id: 'resolvers', text: 'Resolverهای Query/Mutation و field resolver برای روابط' },
            { id: 'dataloader', text: 'استفاده از DataLoader با ساخت نمونه جدید در هر درخواست (context)' },
            { id: 'inputs', text: 'استفاده از input type برای Mutation و اعتبارسنجی' },
            { id: 'errors', text: 'مدیریت خطا با GraphQLError و کد خطا' }
          ],
          repoName: 'fsa-17-graphql-courses',
          hints: [
            'DataLoader را در تابع context بسازید تا کش بین کاربران مشترک نشود.',
            'برای صفحه‌بندی می‌توانید الگوی cursor-based (Connection) را امتحان کنید.'
          ]
        }
      }
    ]
  },
  {
    id: 'devops-testing',
    title: 'DevOps و تست',
    description: 'Docker، امنیت برنامه‌های وب، تست واحد با Jest و تست End-to-End با Playwright.',
    icon: 'ShieldCheck',
    lessons: [
      {
        id: 'docker',
        title: 'مبانی Docker',
        summary: 'Image و Container، Dockerfile چندمرحله‌ای، لایه‌ها و کش، Volume، شبکه و Docker Compose.',
        minutes: 90,
        docs: [
          { title: 'Docker — Get started', url: 'https://docs.docker.com/get-started/' },
          { title: 'Dockerfile reference', url: 'https://docs.docker.com/reference/dockerfile/' },
          { title: 'Multi-stage builds', url: 'https://docs.docker.com/build/building/multi-stage/' },
          { title: 'Docker Compose', url: 'https://docs.docker.com/compose/' }
        ],
        exercise: {
          title: 'کانتینرسازی یک سرویس Full-Stack',
          scenario:
            'تیم شما هر بار برای راه‌اندازی محیط توسعه یک روز وقت تلف می‌کند. باید یک API نود و پایگاه داده PostgreSQL را طوری کانتینری کنید که با یک دستور بالا بیایند.',
          tasks: [
            'یک API ساده Node.js (یا پروژه تمرین‌های قبلی) با endpoint سلامت ‎/health داشته باشید.',
            'Dockerfile چندمرحله‌ای (build و runtime) با image پایه سبک بنویسید.',
            'برنامه را با کاربر غیر root اجرا کنید.',
            'فایل ‎.dockerignore اضافه کنید.',
            'docker-compose.yml با سرویس api و db، volume برای داده و healthcheck بنویسید.'
          ],
          requirements: [
            { id: 'multistage', text: 'Dockerfile چندمرحله‌ای با کپی package*.json قبل از سورس برای استفاده از کش' },
            { id: 'non-root', text: 'اجرای کانتینر با کاربر غیر root' },
            { id: 'dockerignore', text: '‎.dockerignore شامل node_modules و ‎.env' },
            { id: 'compose', text: 'docker-compose.yml با دو سرویس، volume و depends_on با condition: service_healthy' },
            { id: 'config', text: 'پیکربندی از متغیرهای محیطی و نبود رمز واقعی در فایل‌ها' }
          ],
          repoName: 'fsa-18-dockerized-api',
          hints: [
            'در image رسمی node کاربر node از قبل وجود دارد: USER node',
            'برای production از npm ci --omit=dev استفاده کنید.'
          ]
        }
      },
      {
        id: 'security',
        title: 'امنیت برنامه‌های وب',
        summary: 'OWASP Top 10، XSS، SQL Injection، CSRF، هش رمز عبور، JWT، Rate Limiting و هدرهای امنیتی.',
        minutes: 95,
        docs: [
          { title: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
          { title: 'OWASP Cheat Sheet Series', url: 'https://cheatsheetseries.owasp.org/' },
          { title: 'Express — Security Best Practices', url: 'https://expressjs.com/en/advanced/best-practice-security.html' },
          { title: 'MDN — Web security', url: 'https://developer.mozilla.org/en-US/docs/Web/Security' }
        ],
        exercise: {
          title: 'سرویس احراز هویت امن',
          scenario:
            'پس از یک حادثه امنیتی، CTO از شما خواسته سرویس احراز هویت شرکت را از نو و مطابق توصیه‌های OWASP بسازید.',
          tasks: [
            'endpointهای ثبت‌نام، ورود، خروج و دریافت پروفایل را با Express پیاده کنید.',
            'رمز عبور را با argon2 یا bcrypt هش کنید.',
            'نشست را با JWT کوتاه‌مدت در کوکی httpOnly، secure و sameSite ارسال کنید.',
            'Rate limiting روی مسیر ورود و هدرهای امنیتی با helmet اضافه کنید.',
            'ورودی‌ها را اعتبارسنجی و پیام خطای ورود را عمومی نگه دارید (عدم افشای وجود کاربر).'
          ],
          requirements: [
            { id: 'hashing', text: 'هش رمز عبور با argon2/bcrypt (هرگز ذخیره متن ساده)' },
            { id: 'cookies', text: 'توکن در کوکی httpOnly + secure + sameSite یا توجیه مستند جایگزین' },
            { id: 'rate-limit', text: 'محدودیت نرخ درخواست برای ورود' },
            { id: 'headers', text: 'استفاده از helmet یا تنظیم دستی هدرهای امنیتی و CORS محدود' },
            { id: 'secrets', text: 'رازها (JWT secret) فقط از متغیر محیطی و عدم commit آن‌ها' },
            { id: 'enumeration', text: 'پیام خطای یکسان برای نام کاربری/رمز اشتباه' }
          ],
          repoName: 'fsa-19-secure-auth',
          hints: [
            'JWT را در localStorage نگه ندارید؛ در برابر XSS آسیب‌پذیر است.',
            'express-rate-limit و helmet دو بسته استاندارد این کار هستند.'
          ]
        }
      },
      {
        id: 'jest',
        title: 'تست واحد با Jest',
        summary: 'ساختار تست، matcherها، Mock و Spy، تست کد ناهمگام، پوشش کد و TDD.',
        minutes: 80,
        docs: [
          { title: 'Jest — Getting Started', url: 'https://jestjs.io/docs/getting-started' },
          { title: 'Jest — Mock Functions', url: 'https://jestjs.io/docs/mock-functions' },
          { title: 'Jest — Testing Asynchronous Code', url: 'https://jestjs.io/docs/asynchronous' },
          { title: 'Testing Library — React', url: 'https://testing-library.com/docs/react-testing-library/intro/' }
        ],
        exercise: {
          title: 'تست ماژول پرداخت',
          scenario:
            'ماژول محاسبه فاکتور و پرداخت فروشگاه بدون تست است و هر تغییر آن باعث باگ در production شده. شما باید با TDD آن را بازنویسی و پوشش تست را بالا ببرید.',
          tasks: [
            'ماژول invoice شامل محاسبه جمع، مالیات و تخفیف کوپن را بنویسید.',
            'سرویس payment که به یک درگاه خارجی (ماژول gateway) وابسته است را بنویسید.',
            'برای invoice تست‌های جدول‌محور با test.each بنویسید.',
            'gateway را با jest.mock شبیه‌سازی و سناریوهای موفق، ناموفق و timeout را تست کنید.',
            'پوشش کد را با آستانه حداقل ۸۰٪ در jest.config تنظیم کنید.'
          ],
          requirements: [
            { id: 'structure', text: 'تست‌ها با describe/it ساختارمند و نام‌گذاری توصیفی' },
            { id: 'table', text: 'استفاده از test.each برای موارد مرزی' },
            { id: 'mocks', text: 'Mock کردن وابستگی خارجی با jest.mock/jest.fn و بررسی فراخوانی‌ها' },
            { id: 'async', text: 'تست صحیح کد async با await و expect(...).rejects' },
            { id: 'coverage', text: 'coverageThreshold در پیکربندی Jest' }
          ],
          repoName: 'fsa-20-payment-tests',
          hints: [
            'برای timeout می‌توانید از jest.useFakeTimers() استفاده کنید.',
            'تست خوب: Arrange → Act → Assert'
          ]
        }
      },
      {
        id: 'playwright',
        title: 'تست End-to-End با Playwright',
        summary: 'locatorها، assertionهای خودکارانتظار، Page Object Model، fixtureها و اجرای CI.',
        minutes: 85,
        docs: [
          { title: 'Playwright — Getting started', url: 'https://playwright.dev/docs/intro' },
          { title: 'Playwright — Locators', url: 'https://playwright.dev/docs/locators' },
          { title: 'Playwright — Page Object Models', url: 'https://playwright.dev/docs/pom' },
          { title: 'Playwright — CI', url: 'https://playwright.dev/docs/ci-intro' }
        ],
        exercise: {
          title: 'مجموعه تست E2E برای اپ Todo',
          scenario:
            'تیم QA می‌خواهد تست‌های دستی تکراری اپ وظایف را خودکار کند و در هر Pull Request اجرا شوند. شما مجموعه تست E2E و خط لوله CI آن را می‌سازید.',
          tasks: [
            'روی اپ دمو https://demo.playwright.dev/todomvc یا اپ React خودتان تست بنویسید.',
            'سناریوهای افزودن، تکمیل، فیلتر و حذف وظیفه را پوشش دهید.',
            'از locatorهای کاربرمحور (getByRole، getByPlaceholder) استفاده کنید.',
            'الگوی Page Object Model را پیاده کنید.',
            'یک GitHub Actions workflow برای اجرای تست‌ها و آپلود گزارش بسازید.'
          ],
          requirements: [
            { id: 'config', text: 'playwright.config.ts با baseURL و حداقل دو مرورگر/پروژه' },
            { id: 'locators', text: 'استفاده از locatorهای کاربرمحور به‌جای selectorهای شکننده CSS/XPath' },
            { id: 'pom', text: 'پیاده‌سازی Page Object Model' },
            { id: 'assertions', text: 'استفاده از web-first assertions (await expect(locator).toHave...) و نبود waitForTimeout' },
            { id: 'ci', text: 'فایل workflow در ‎.github/workflows برای اجرای تست‌ها' }
          ],
          repoName: 'fsa-21-e2e-suite',
          hints: [
            'npm init playwright@latest قالب workflow را هم برای شما می‌سازد.',
            'page.waitForTimeout در تست‌های واقعی نشانه بوی بد کد است.'
          ]
        }
      }
    ]
  }
]

let counter = 0
export const modules: Module[] = MODULES.map((m) => ({
  ...m,
  lessons: m.lessons.map((l) => ({ ...l, moduleId: m.id, index: counter++, content: body(l.id) }))
}))

export const lessons: Lesson[] = modules.flatMap((m) => m.lessons)

export const lessonById = (id: string): Lesson | undefined => lessons.find((l) => l.id === id)
export const moduleById = (id: string): Module | undefined => modules.find((m) => m.id === id)
