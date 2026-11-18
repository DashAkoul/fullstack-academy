# NestJS: معماری ماژولار بک‌اند

> مرجع رسمی: [docs.nestjs.com](https://docs.nestjs.com/)

NestJS یک فریم‌ورک «نظرپذیر» (opinionated) است: ساختار مشخص، تزریق وابستگی، و الگوهای جاافتاده. برای تیم‌های متوسط و بزرگ انتخاب پیش‌فرض معقولی است.

## ۱. ساخت پروژه

```bash
npm i -g @nestjs/cli
nest new clinic-booking
cd clinic-booking && npm run start:dev
```

```
src/
├─ app.module.ts        ← ریشه
├─ main.ts
└─ appointments/
   ├─ appointments.module.ts
   ├─ appointments.controller.ts
   ├─ appointments.service.ts
   ├─ dto/
   └─ entities/
```

## ۲. سه مفهوم اصلی

| مفهوم | مسئولیت |
| --- | --- |
| **Module** | مرز و دامنه؛ چه چیزهایی را عرضه/ایمپورت می‌کند |
| **Controller** | لایه‌ی HTTP؛ مسیر، ورودی، خروجی |
| **Provider/Service** | منطق و وابستگی‌ها؛ تست‌پذیر |

```ts
// appointments.module.ts
import { Module } from '@nestjs/common'
import { AppointmentsController } from './appointments.controller'
import { AppointmentsService } from './appointments.service'

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService]
})
export class AppointmentsModule {}
```

## ۳. Controller و Service

```ts
// appointments.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'
import { CreateAppointmentDto } from './dto/create-appointment.dto'
import { UpdateAppointmentDto } from './dto/update-appointment.dto'
import { AdminGuard } from '../auth/admin.guard'

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}  // DI

  @Get()
  findAll() {
    return this.service.findAll()
  }

  @Post()
  create(@Body() dto: CreateAppointmentDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.service.update(id, dto)
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
```

```ts
// appointments.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateAppointmentDto } from './dto/create-appointment.dto'

export interface Appointment {
  id: string
  doctorId: string
  patientName: string
  startsAt: Date
  endsAt: Date
}

@Injectable()
export class AppointmentsService {
  private readonly items: Appointment[] = []

  findAll(doctorId?: string) {
    return doctorId ? this.items.filter((a) => a.doctorId === doctorId) : this.items
  }

  create(dto: CreateAppointmentDto): Appointment {
    const startsAt = new Date(dto.startsAt)
    const endsAt = new Date(startsAt.getTime() + dto.durationMinutes * 60_000)

    const conflict = this.items.some(
      (a) => a.doctorId === dto.doctorId && startsAt < a.endsAt && a.startsAt < endsAt
    )
    if (conflict) throw new ConflictException('این بازه برای پزشک قبلاً رزرو شده است')

    const appointment: Appointment = {
      id: crypto.randomUUID(),
      doctorId: dto.doctorId,
      patientName: dto.patientName,
      startsAt,
      endsAt
    }
    this.items.push(appointment)
    return appointment
  }

  remove(id: string) {
    const index = this.items.findIndex((a) => a.id === id)
    if (index === -1) throw new NotFoundException('نوبت پیدا نشد')
    return this.items.splice(index, 1)[0]
  }
}
```

> دو بازه‌ی `[aStart, aEnd)` و `[bStart, bEnd)` زمانی تداخل دارند که `aStart < bEnd && bStart < aEnd`. این یک تست واحد ارزشمند است.

## ۴. DTO و ValidationPipe

```bash
npm i class-validator class-transformer
```

```ts
// dto/create-appointment.dto.ts
import { IsInt, IsISO8601, IsString, Length, Max, Min } from 'class-validator'

export class CreateAppointmentDto {
  @IsString()
  @Length(1, 64)
  doctorId!: string

  @IsString()
  @Length(2, 80)
  patientName!: string

  @IsISO8601()
  startsAt!: string

  @IsInt()
  @Min(5)
  @Max(240)
  durationMinutes!: number
}
```

```ts
// main.ts
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,             // حذف فیلدهای تعریف‌نشده
      forbidNonWhitelisted: true,  // یا خطا دادن
      transform: true,             // تبدیل نوع خودکار
      transformOptions: { enableImplicitConversion: false }
    })
  )
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') })
  await app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
```

## ۵. Guard

```ts
// auth/admin.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>()
    const key = req.header('x-api-key')
    if (!key) throw new UnauthorizedException('کلید دسترسی لازم است')
    if (key !== process.env.ADMIN_API_KEY) throw new UnauthorizedException('کلید نامعتبر')
    return true
  }
}
```

به‌جای تکرار در کنترلرها، می‌توانید آن را در سطح ماژول/کنترلر یا با `APP_GUARD` سراسری اعمال کنید.

## ۶. تست واحد

```ts
// appointments.service.spec.ts
import { Test } from '@nestjs/testing'
import { ConflictException } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'

describe('AppointmentsService', () => {
  let service: AppointmentsService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AppointmentsService]
    }).compile()
    service = moduleRef.get(AppointmentsService)
  })

  it('در صورت تداخل بازه، ConflictException می‌دهد', () => {
    service.create({
      doctorId: 'd1',
      patientName: 'علی',
      startsAt: '2030-01-01T10:00:00.000Z',
      durationMinutes: 30
    })

    expect(() =>
      service.create({
        doctorId: 'd1',
        patientName: 'سارا',
        startsAt: '2030-01-01T10:15:00.000Z',
        durationMinutes: 30
      })
    ).toThrow(ConflictException)
  })

  it('پزشک دیگر در همان زمان آزاد است', () => {
    service.create({ doctorId: 'd1', patientName: 'علی', startsAt: '2030-01-01T10:00:00.000Z', durationMinutes: 30 })
    expect(() =>
      service.create({ doctorId: 'd2', patientName: 'سارا', startsAt: '2030-01-01T10:00:00.000Z', durationMinutes: 30 })
    ).not.toThrow()
  })
})
```

## ۷. پیکربندی و ماژول‌های آماده

```bash
npm i @nestjs/config
```

```ts
import { ConfigModule } from '@nestjs/config'
import { z } from 'zod'

ConfigModule.forRoot({
  isGlobal: true,
  validate: (raw) =>
    z.object({
      PORT: z.coerce.number().default(3000),
      DATABASE_URL: z.string().url(),
      ADMIN_API_KEY: z.string().min(16)
    }).parse(raw)
})
```

اکوسیستم Nest: `@nestjs/typeorm`, `@nestjs/mongoose`, `@nestjs/prisma` (غیررسمی), `@nestjs/graphql`, `@nestjs/bull` (صف), `@nestjs/swagger`.

## ۸. Express یا Nest؟

| معیار | Express | NestJS |
| --- | --- | --- |
| شروع سریع | ✅ | متوسط |
| ساختار تیمی | خودتان می‌سازید | از پیش تعریف‌شده |
| تزریق وابستگی | ندارد | ✅ |
| منحنی یادگیری | کم | بیشتر |
| مناسب | API کوچک، سرویس ساده | دامنه‌ی پیچیده، تیم بزرگ |

## تمرین این درس

ماژول نوبت‌دهی کلینیک در NestJS: DTO با class-validator، ValidationPipe سراسری، جلوگیری از تداخل با ConflictException، Guard با `x-api-key` و تست واحد منطق تداخل. جزئیات در تب تمرین است.
