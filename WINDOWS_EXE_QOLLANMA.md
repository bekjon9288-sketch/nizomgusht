# GO'SHT MARKAZI POS — Windows .exe (Offline Monoblok) Qo'llanma

Bu loyihaga endi **Windows uchun o'rnatiladigan .exe dastur** yasash imkoniyati
qo'shildi. Dastur touchscreen monoblokka o'rnatiladi va **internetsiz (offline)
ham to'liq ishlaydi** — barcha ma'lumotlar avval kompyuterning o'zida
(localStorage + Firestore offline keshi) saqlanadi, keyin internet paydo
bo'lganda avtomatik ravishda bulutga (Firestore) sinxronlashadi.

## 1. .exe faylni avtomatik yasash (GitHub Actions orqali — tavsiya etiladi)

Bu loyihada `.github/workflows/build-windows.yml` fayli bor. U GitHubga har safar
kod yuklanganda (yoki qo'lda ishga tushirilganda) Windows kompyuterda avtomatik
ravishda `.exe` o'rnatuvchi faylni yasab beradi — sizning kompyuteringizda hech
narsa o'rnatishingiz shart emas.

**Qadamlar:**

1. Ushbu loyihani (butun papkani) o'zingizning GitHub repositoriyingizga yuklang
   (push qiling).
2. GitHub'da repository sahifasiga o'ting → **Actions** bo'limi → chapdan
   **"Build Windows EXE (GO'SHT MARKAZI POS)"** workflow'ni tanlang → o'ng
   tomondan **"Run workflow"** tugmasini bosing.
3. Bir necha daqiqadan so'ng (odatda 3-6 daqiqa) build tugaydi. Tugagan
   workflow ustiga bosing → pastda **"Artifacts"** bo'limidan
   **`goshtmarkazi-pos-windows`** faylni yuklab oling — bu ZIP ichida tayyor
   `.exe` o'rnatuvchi bor.
4. Agar rasmiy versiya chiqarmoqchi bo'lsangiz, Git orqali `v1.0.0` kabi tag
   yuborsangiz (`git tag v1.0.0 && git push origin v1.0.0`), workflow avtomatik
   ravishda GitHub **Releases** bo'limida tayyor `.exe` bilan versiya yaratadi
   — undan to'g'ridan-to'g'ri link orqali yuklab olsa bo'ladi.

## 2. .exe faylni Windows monoblokka o'rnatish

1. Yuklab olingan `.exe` faylni (masalan `GOSHT-MARKAZI-POS-Setup-1.0.0.exe`)
   monoblokka nusxalang (fleshka yoki tarmoq orqali).
2. Faylni ikki marta bosing — o'rnatish oynasi ochiladi (administrator
   ruxsati so'ralishi mumkin — "Ha" deb tasdiqlang).
3. O'rnatish tugagach, ish stolida va Start menyusida **"GO'SHT MARKAZI POS"**
   yorlig'i paydo bo'ladi.
4. Dasturni ochganda u **butun ekranga (fullscreen)** yoyiladi — bu
   touchscreen monoblok uchun mo'ljallangan, sichqonsiz, faqat barmoq bilan
   ishlatsa bo'ladi.

### Foydali klaviatura tugmalari (administrator uchun)
- **F11** — to'liq ekran rejimini yoqish/o'chirish
- **Ctrl+Q** — dasturdan chiqish
- **Ctrl+Shift+R** — dasturni qayta yuklash (masalan yangilanishdan keyin)

### Dastur avtomatik ishga tushishi (ixtiyoriy)
Agar monoblok yoqilganda dastur o'zi avtomatik ochilishini xohlasangiz:
`Win+R` → `shell:startup` → shu papkaga dastur yorlig'ini (Desktop'dagi
"GO'SHT MARKAZI POS" belgisini nusxalab) joylashtiring.

## 3. Offline ishlash haqida

- Dastur internetga ulanmasdan ham **to'liq ishlaydi**: savdo qilish, mahsulot
  qo'shish, yuk xati orqali kirim qilish — hammasi lokal saqlanadi.
- Internet qaytganda, barcha ma'lumotlar avtomatik ravishda bulutli bazaga
  (Firestore) sinxronlanadi — hech qanday qo'shimcha amal talab qilinmaydi.
- Agar bir nechta monoblok/kassa bir-biriga ulanishi kerak bo'lsa (masalan
  filial va bosh do'kon), internet orqali barchasi bitta umumiy bazaga
  sinxronlanadi.

## 4. Loyihani o'zingiz (qo'lda) build qilish

Agar Windows kompyuteringizda Node.js (v20+) o'rnatilgan bo'lsa:

```
npm install
npm run electron:build:win
```

Tayyor `.exe` fayl `release/` papkasida paydo bo'ladi.

Testdan o'tkazish uchun (o'rnatmasdan, to'g'ridan-to'g'ri ishga tushirish):

```
npm run electron:start
```
