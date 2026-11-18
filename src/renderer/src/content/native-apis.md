# APIهای بومی و Native Modules

> مراجع: [Expo Permissions](https://docs.expo.dev/guides/permissions/) · [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/) · [Expo Modules API](https://docs.expo.dev/modules/overview/)

اپ موبایل واقعی با سخت‌افزار حرف می‌زند: دوربین، موقعیت، اعلان، اثر انگشت. این درس الگوی درست و محترمانه‌ی این کار را می‌آموزد.

## ۱. اصل اول: مجوز در لحظه‌ی نیاز

هرگز هنگام باز شدن اپ همه‌ی مجوزها را درخواست نکنید. کاربر باید بفهمد **چرا** الان این اجازه را می‌خواهید.

```tsx
async function askCamera() {
  const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync()
  if (status === 'granted') return openCamera()
  if (!canAskAgain)
    Alert.alert(
      'دسترسی به دوربین بسته است',
      'برای گرفتن عکس، در تنظیمات اپ اجازه‌ی دوربین را فعال کنید.',
      [{ text: 'باز کردن تنظیمات', onPress: () => Linking.openSettings() }, { text: 'بعداً' }]
    )
}
```

## ۲. دوربین و گالری

```bash
npx expo install expo-image-picker
```

```tsx
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'

export function PhotoInput({ onPicked }: { onPicked: (uri: string) => void }) {
  const [uri, setUri] = useState<string | null>(null)

  async function pick(from: 'camera' | 'library') {
    const perm = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return

    const result = from === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })

    if (!result.canceled) {
      const asset = result.assets[0]
      setUri(asset.uri)
      onPicked(asset.uri)
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {uri && <Image source={{ uri }} style={{ width: 200, height: 200, borderRadius: 12 }} />}
      <Pressable onPress={() => pick('camera')}><Text>گرفتن عکس</Text></Pressable>
      <Pressable onPress={() => pick('library')}><Text>انتخاب از گالری</Text></Pressable>
    </View>
  )
}
```

## ۳. موقعیت مکانی

```bash
npx expo install expo-location
```

```ts
import * as Location from 'expo-location'

export async function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  const services = await Location.hasServicesEnabledAsync()
  if (!services) {
    Alert.alert('GPS خاموش است', 'برای ثبت موقعیت، مکان‌یابی گوشی را روشن کنید.')
    return null
  }

  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return null

  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return { lat: pos.coords.latitude, lng: pos.coords.longitude }
  } catch (e) {
    console.warn('خطای موقعیت', e)
    return null
  }
}
```

- `requestForegroundPermissionsAsync` برای استفاده در زمان باز بودن اپ.
- `requestBackgroundPermissionsAsync` فقط اگر واقعاً لازم است (نیاز به توضیح در App Store و مصرف باتری).
- همیشه `timeout` و حالت خطا داشته باشید — داخل ساختمان GPS ممکن است دقیق نباشد.

## ۴. ذخیره‌ی امن: SecureStore

```bash
npx expo install expo-secure-store
```

```ts
import * as SecureStore from 'expo-secure-store'

export const tokenStore = {
  async save(token: string) {
    await SecureStore.setItemAsync('auth_token', token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED
    })
  },
  get: () => SecureStore.getItemAsync('auth_token'),
  clear: () => SecureStore.deleteItemAsync('auth_token')
}
```

| داده | ابزار |
| --- | --- |
| توکن احراز هویت | SecureStore (Keychain/Keystore) |
| تنظیمات ساده‌ی UI | AsyncStorage |
| داده‌ی بزرگ/ساختاریافته | SQLite (expo-sqlite) |

## ۵. اعلان‌ها

```bash
npx expo install expo-notifications
```

```ts
import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
})

export async function scheduleDailyReminder(hour = 20, minute = 0) {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return null

  await Notifications.cancelAllScheduledNotificationsAsync()
  return Notifications.scheduleNotificationAsync({
    content: { title: 'یادآوری', body: 'عادت‌های امروز را ثبت کردی؟' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute }
  })
}
```

برای push واقعی نیاز به توکن Expo و سرور دارید؛ برای یادآوری محلی همین کافی است.

## ۶. تنظیم توضیح مجوزها

در `app.json` (یا `app.config.ts`):

```json
{
  "expo": {
    "plugins": [
      ["expo-image-picker", {
        "photosPermission": "برای انتخاب عکس خرابی از گالری شما استفاده می‌کنیم.",
        "cameraPermission": "برای ثبت عکس خرابی به دوربین نیاز داریم."
      }],
      ["expo-location", {
        "locationWhenInUsePermission": "موقعیت شما برای ثبت دقیق محل خرابی استفاده می‌شود."
      }]
    ],
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "برای ثبت عکس خرابی به دوربین نیاز داریم."
      }
    }
  }
}
```

متن باید **مشخص و کاربرمحور** باشد؛ متن‌های عمومی باعث رد شدن در بازبینی App Store می‌شوند.

## ۷. وقتی کتابخانه‌ی آماده نیست: Expo Modules API

اگر به API بومی دسترسی نیاز دارید که پکیج ندارد (یا مجبورید SDK داخلی شرکت را وصل کنید) با Expo Modules یک ماژول بومی بنویسید:

```bash
npx create-expo-module@latest --local my-sdk
```

```swift
// ios/MySdkModule.swift
import ExpoModulesCore

public class MySdkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MySdk")
    Function("greet") { (name: String) -> String in
      return "سلام \(name)"
    }
  }
}
```

```kotlin
// android/.../MySdkModule.kt
class MySdkModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MySdk")
    Function("greet") { name: String -> "سلام $name" }
  }
}
```

```ts
import { requireNativeModule } from 'expo-modules-core'
const MySdk = requireNativeModule<{ greet(name: string): string }>('MySdk')
```

> ماژول بومی با Expo Go کار نمی‌کند؛ نیاز به development build دارید: `npx expo run:ios` یا `npx expo run:android`.

## ۸. عادت‌های حرفه‌ای

- هر مجوز را در یک Custom Hook بسته‌بندی کنید (`useCameraPermission`).
- یک «حالت رد شده» طراحی کنید که اپ را بلاک نکند.
- به‌جای polling برای موقعیت، از `watchPositionAsync` با فاصله‌ی زمانی معقول استفاده کنید.
- مصرف باتری و داده را در README ذکر کنید.
- تست روی دستگاه واقعی؛ شبیه‌ساز دوربین و GPS را کامل شبیه‌سازی نمی‌کند.

## تمرین این درس

اپ گزارش خرابی شهری: عکس با ImagePicker، موقعیت با expo-location، مدیریت کامل حالت رد شدن مجوز، ذخیره‌ی توکن با SecureStore و توضیح مجوزها در app.json. جزئیات در تب تمرین است.
