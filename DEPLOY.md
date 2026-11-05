# OZAQ — ishga tushirish

## 1. Google Sheets + Apps Script
1. `OZAQ-DB.xlsx` ni Drive'ga yuklang → **Google Sheets bilan oching** → **File → Save as Google Sheets**.
2. **Extensions → Apps Script** → `apps-script/Code.gs` ni to’liq joylang.
3. Kod boshidagi `SHEET_ID` ga Sheets havolasidagi ID ni yozing (`/d/ID/edit`). Bog’langan skriptda bo’sh qoldirsangiz ham ishlaydi.
4. `setGoogleClientId()` ichiga OAuth Client ID ni yozib bir marta ishga tushiring (2-bo’lim).
5. `createFirstAdmin()` ichiga admin login va kuchli parolni yozing → **setup()**, keyin **createFirstAdmin()** ni ishga tushiring. Ishlatgach parolni koddan o’chiring.
6. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone** → `.../exec` URL ni `config.js` dagi `API_URL` ga yozing.
   Kodni o’zgartirsangiz: Deploy → Manage deployments → Edit → **New version**.

Sheets fayliga faqat siz kiring (parol hash lari va test javoblari shu yerda).

## 2. Google bilan kirish
1. console.cloud.google.com → **APIs & Services → OAuth consent screen** (External) → to’ldiring va **Publish app**.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorized JavaScript origins**: `https://SIZNING.vercel.app` (va sinov uchun `http://localhost:8000`).
4. Client ID ni Apps Script (`setGoogleClientId`) va `config.js` (`GOOGLE_CLIENT_ID`) ga yozing.

## 3. Vercel
Repo ni Vercel'ga *Import* qiling (Framework: **Other**, build command yo’q). Domen chiqqach 2-bo’limdagi origins ga qo’shing.

## 4. Tekshiruv ro’yxati
1. `curl -L -X POST "API_URL" -H "Content-Type: text/plain" -d '{"action":"ping"}'` → `{"ok":true,...}`
2. Saytda **Ro’yxatdan o’tish** (email) va **Google bilan** kirish.
3. **Yangi mock** → savollar qo’shing (har savolga mavzu kiriting) → **Saqlash** → **Nashr qilish** → **Faollashtirish**.
4. **O’quvchilar va kirish** → ismlarni yozing → login/parol yaratiladi.
5. Boshqa brauzerda `https://SIZNING.vercel.app/#exam` → o’quvchi login/paroli bilan kirib testni yechadi.
6. **Natijalar** tabida tahlil.
7. Bosh sahifada (`/`) **Demo so’rash** formasini to’ldiring → `admin.html` → **Demo so’rovlar** da ko’rinadi.
8. `admin.html` da admin login bilan Premium mijoz yarating → mijoz login/paroli bilan kiring → **O’qituvchilar** bo’limida o’qituvchi qo’shing.
9. Premium o’qituvchi bilan **Uzun javob** savoli qo’shing, o’quvchi yozsin, **Natijalar** tabida ball qo’ying.
10. **Guruhlar** bo’limida guruh yarating (Freemium: 2 tagacha) va o’quvchi qo’shishda tanlang.

## Cheklovlar
- Apps Script so’rovlarni ketma-ket bajaradi (~0.3–1.5 s/so’rov). Bir vaqtda o’nlab o’quvchi muammosiz; yuzlab bo’lsa, javoblar har 10 soniyada paketlanib yuboriladi, lekin kechikish bo’lishi mumkin.
- Bitta Sheets katagi 50 000 belgi: juda uzun test saqlanmaydi. Rasmlarni faqat https havola sifatida qo’shing (fayl yuklash yo’q).
- Tarjima (UZ/RU/EN), moslashtirish savoli, filiallar taqqoslash va PDF/Excel hisobotlar hali yo’q.
- Parollar sha-256 (tuz + 100 aylanish) bilan saqlanadi; 5 ta xato urinishdan keyin 10 daqiqaga bloklanadi.
