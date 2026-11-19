# NestJS: معماری ماژولار

> مراجع: [NestJS Docs](https://docs.nestjs.com/) · [Modules](https://docs.nestjs.com/modules) · [Pipes](https://docs.nestjs.com/pipes) · [Testing](https://docs.nestjs.com/fundamentals/testing)

## در این درس چه یاد می‌گیرید؟

می‌فهمید چرا Nest برای تیم‌های بزرگ انتخاب می‌شود: ماژول‌ها، تزریق وابستگی، DTO، Pipe/Guard/Interceptor/Filter و تست. در پایان، API وظایف را با ساختار ماژولار، اعتبارسنجی، احراز هویت نقش‌محور و تست e2e می‌سازید.

---

## ۱. سه بلوک اصلی

| بلوک | نقش | مثال |
| --- | --- | --- |
| Module | مرز و ترکیب | `TasksModule` |
| Controller | لایه‌ی HTTP | `TasksController` |
| Provider (Service) | منطق/دسترسی داده | `TasksService` |

```ts
// src/tasks/tasks.module.ts
import { Module } from '@nestjs/common'
import { TasksController } from './tasks.controller'
import { TasksService } from './tasks.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService]
})
export class TasksModule {}
```

`exports` فقط چیزی را که می‌خواهید ماژول‌های دیگر استفاده کنند صادر می‌کند. اگر `TasksService` را export نکنید، ماژول دیگر نمی‌تواند inject کند.

## ۲. تزریق وابستگی

```ts
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject('CLOCK') private readonly clock: Clock
  ) {}

  findAll(ownerId: string) {
    return this.prisma.task.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } })
  }
}
```

- Nest خودش نمونه می‌سازد و تزریق می‌کند؛ `new` نکنید.
- برای تست، provider را با fake جایگزین می‌کنید — همین دلیل اصلی DI است.
- provider سفارشی:

```ts
@Module({
  providers: [
    { provide: 'CLOCK', useValue: { now: () => new Date() } },
    {
      provide: 'MAILER',
      useFactory: (cfg: ConfigService) => new Mailer(cfg.getOrThrow('MAIL_URL')),
      inject: [ConfigService]
    }
  ]
})
```

## ۳. DTO و ValidationPipe

```ts
// src/tasks/dto/create-task.dto.ts
import { IsEnum, IsISO8601, IsOptional, IsString, Length } from 'class-validator'
import { Transform } from 'class-transformer'

export enum Priority { Low = 'low', Medium = 'medium', High = 'high' }

export class CreateTaskDto {
  @IsString()
  @Length(2, 120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority

  @IsOptional()
  @IsISO8601()
  dueDate?: string
}
```

```ts
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // فیلدهای اضافه حذف
  forbidNonWhitelisted: true, // یا خطا
  transform: true,
  transformOptions: { enableImplicitConversion: false }
}))
```

`whitelist` جلوی mass-assignment را می‌گیرد؛ بدون آن کاربر می‌تواند `ownerId` یا `role` بفرستد.

## ۴. Controller

```ts
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTasksDto) {
    return this.tasks.list(user.id, query)
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const task = await this.tasks.get(user.id, id)
    if (!task) throw new NotFoundException('وظیفه یافت نشد.')
    return task
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.create(user.id, dto)
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.update(user.id, id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.tasks.remove(user.id, id)
  }
}
```

`ParseUUIDPipe` قبل از رسیدن به سرویس، ورودی بد را ۴۰۰ می‌کند.

**Exceptionهای داخلی Nest** کد وضعیت درست را خودکار می‌سازند؛ بدنه‌ی خطا را دستی نسازید:

```ts
try {
  return await this.tasks.create(user.id, dto)
} catch (err) {
  if (isUniqueViolation(err)) throw new ConflictException('این عنوان قبلاً ثبت شده است.')
  throw err
}

// NotFoundException → 404، ConflictException → 409، ForbiddenException → 403,
// UnauthorizedException → 401، BadRequestException → 400
```

## ۵. ترتیب اجرای درخواست

```
Middleware → Guards → Interceptors (قبل) → Pipes → Handler
          → Interceptors (بعد) → Exception Filters
```

- **Guard**: اجازه/رد (auth، نقش).
- **Pipe**: تبدیل/اعتبارسنجی ورودی.
- **Interceptor**: تغییر پاسخ، زمان‌سنجی، تبدیل خروجی.
- **Filter**: قالب یکدست خطا.

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [ctx.getHandler(), ctx.getClass()])
    if (!roles?.length) return true
    const { user } = ctx.switchToHttp().getRequest()
    return roles.includes(user?.role)
  }
}
```

## ۶. فیلتر خطای یکدست

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    const status = exception instanceof HttpException ? exception.getStatus() : 500
    const body = exception instanceof HttpException ? exception.getResponse() : null

    if (status >= 500) this.logger.error({ exception }, req.url)

    res.status(status).json({
      error: {
        code: status >= 500 ? 'INTERNAL' : 'REQUEST_ERROR',
        message: status >= 500 ? 'خطای سرور.' : body,
        path: req.url,
        requestId: req.headers['x-request-id'] ?? null
      }
    })
  }
}
```

```ts
app.useGlobalFilters(new AllExceptionsFilter())
```

## ۷. پیکربندی با اعتبارسنجی

```ts
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
    PORT: Joi.number().default(3000),
    DATABASE_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().min(32).required()
  })
})
```

برنامه در شروع با env ناقص **fail-fast** می‌شود؛ خیلی بهتر از خطای نیمه‌شب در production.

## ۸. تست: unit و e2e

```ts
// tasks.service.spec.ts
describe('TasksService', () => {
  let service: TasksService
  const prisma = { task: { findMany: vi.fn(), create: vi.fn() } }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TasksService, { provide: PrismaService, useValue: prisma }]
    }).compile()
    service = module.get(TasksService)
  })

  it('فقط وظایف مالک را برمی‌گرداند', async () => {
    prisma.task.findMany.mockResolvedValue([])
    await service.findAll('user-1')
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'user-1' } })
    )
  })
})
```

```ts
// test/tasks.e2e-spec.ts
it('/tasks (GET) بدون توکن → 401', () =>
  request(app.getHttpServer()).get('/tasks').expect(401))

it('POST با عنوان کوتاه → 400', () =>
  request(app.getHttpServer())
    .post('/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'a' })
    .expect(400))
```

## ۹. ساخت گام‌به‌گام API وظایف (تمرین)

**گام ۱ — پروژه**

```bash
npm i -g @nestjs/cli
nest new tasks-api --strict
nest g module tasks && nest g controller tasks && nest g service tasks
```

**گام ۲ — Prisma:** `PrismaModule` global، مدل `Task` با `ownerId`.

**گام ۳ — DTOها** با class-validator و `ValidationPipe` سراسری.

**گام ۴ — سرویس:** list/get/create/update/remove با فیلتر `ownerId`.

**گام ۵ — کنترلر:** مسیرها، `ParseUUIDPipe`، `HttpCode`، `Location` در صورت نیاز.

**گام ۶ — auth:** `JwtAuthGuard`، دکوراتور `@CurrentUser`، نقش `admin` با `RolesGuard`.

**گام ۷ — خطا:** فیلتر سراسری، `NotFoundException` و `ConflictException` برای داده‌ی تکراری.

**گام ۸ — تست:** unit برای سرویس با mock، e2e برای ۴۰۱/۴۰۰/۲۰۱.

**گام ۹ — مستندسازی:** `@nestjs/swagger` و `/docs`.

### اجرای واقعی: bootstrap و تست

```bash
nest new tasks-api --strict
cd tasks-api
npm run start:dev
# [Nest] 12345  - 10/10/2025, 1:00:00 PM     LOG [NestFactory] Starting Nest application...
# [Nest] 12345  - 10/10/2025, 1:00:00 PM     LOG [InstanceLoader] PrismaModule dependencies initialized
# [Nest] 12345  - 10/10/2025, 1:00:00 PM     LOG [RoutesResolver] TasksController {/tasks}:
# [Nest] 12345  - 10/10/2025, 1:00:00 PM     LOG [RouterExplorer] Mapped {/tasks, GET} route
# [Nest] 12345  - 10/10/2025, 1:00:00 PM     LOG [NestApplication] Nest application successfully started
```

```bash
curl -s -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"a"}'
# {"message":["title must be longer than or equal to 2 characters"],"error":"Bad Request","statusCode":400}
```

```bash
curl -s http://localhost:3000/tasks \
  -H "Authorization: Bearer $TOKEN"
# [{"id":"...","title":"نوشتن تست","ownerId":"user-1"}]
```

**ایست بازرسی ۱ — DI:** اگر خطای زیر آمد:

```text
Nest can't resolve dependencies of the TasksService (?, PrismaService).
```

یعنی `PrismaModule` در `imports` ماژول نیست یا `PrismaService` ارائه/export نشده است.

**ایست بازرسی ۲ — ValidationPipe:** اگر فیلد `role: "admin"` در بدنه پذیرفته شد، `whitelist: true` را فراموش کرده‌اید. با آن، فیلد ناخواسته حذف می‌شود (یا با `forbidNonWhitelisted` خطای ۴۰۰ می‌گیرید).

**ایست بازرسی ۳ — Guard:** بدون توکن:

```bash
curl -i http://localhost:3000/tasks
# HTTP/1.1 401 Unauthorized
```

اگر ۲۰۰ گرفتید، `@UseGuards` روی کنترلر نیست یا Guard به‌درستی `false` برنمی‌گرداند.

**تست واقعی:**

```bash
npm run test
# PASS  src/tasks/tasks.service.spec.ts
#   TasksService
#     ✓ فقط وظایف مالک را برمی‌گرداند (8 ms)
#
# Test Suites: 1 passed, 1 total
# Tests:       1 passed, 1 total
```

اگر تست به DB واقعی وصل شد، provider را با `useValue` جایگزین نکرده‌اید.

### نگاشت به معیارهای پذیرش

| معیار | کجای درس |
| --- | --- |
| `modules` | بخش ۱ |
| `dto` | بخش ۳ |
| `exceptions` | بخش ۴ (Exceptionهای HTTP) و بخش ۶ |
| `guard` | بخش ۵ |
| `tests` | بخش ۸ |

## ۱۰. عیب‌یابی

| خطا | علت | راه‌حل |
| --- | --- | --- |
| `Nest can't resolve dependencies` | provider در module ثبت نشده | providers/imports |
| اعتبارسنجی اجرا نمی‌شود | `ValidationPipe` ثبت نشده | `useGlobalPipes` |
| فیلد اضافه پذیرفته می‌شود | بدون `whitelist` | بخش ۳ |
| `401` حتی با توکن | guard/strategy | ترتیب و secret |
| تست به DB واقعی می‌زند | mock نکردن | useValue |
| env ناقص در runtime | بدون validationSchema | بخش ۷ |

## ۱۱. آزمایش‌ها (با پاسخ)

**۱.** چرا `exports` لازم است؟

**پاسخ:** provider فقط داخل ماژول خودش قابل inject است مگر export شود.

**۲.** تفاوت Guard و Pipe؟

**پاسخ:** Guard اجازه‌ی دسترسی؛ Pipe تبدیل/اعتبارسنجی داده.

**۳.** `whitelist: true` چه خطری را رفع می‌کند؟

**پاسخ:** mass assignment؛ فیلدهای ناخواسته مثل `role` حذف می‌شوند.

**۴.** چرا تست سرویس با mock از e2e سریع‌تر است؟

**پاسخ:** بدون HTTP/DB؛ فقط منطق. e2e برای مسیرهای حیاتی.

## ۱۲. خودآزمایی

1. Module، Controller، Provider چه تفاوتی دارند؟
2. DI چه فایده‌ای برای تست دارد؟
3. ترتیب Guard/Pipe/Interceptor/Filter؟
4. چطور نقش‌محور دسترسی می‌دهید؟
5. چرا env باید در شروع اعتبارسنجی شود؟
6. تفاوت unit و e2e در Nest؟

## ۱۳. چک‌لیست تحویل

- [ ] ساختار module/controller/service
- [ ] DTO با class-validator و whitelist
- [ ] Guard و دکوراتور کاربر
- [ ] فیلتر خطای یکدست
- [ ] ConfigModule با validation
- [ ] تست unit + e2e
- [ ] Swagger در `/docs`
- [ ] بدون منطق در controller
