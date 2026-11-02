# OZAQ — ishga tushirish (Google Apps Script + Sheets + Vercel)

Arxitektura: **Vercel** (frontend, statik) → `fetch` → **Apps Script Web App** (server) → **Google Sheets** (baza).

## 1. Google Sheets va Apps Script
1. `OZAQ-DB.xlsx` ni Google Drive'ga yuklang → ustiga bosib **Google Sheets bilan oching** → **File → Save as Google Sheets** (nomi: `OZAQ DB`). Tayyor 9 ta varaq va sarlavhalar bor. (Xohlasangiz bo'sh Sheets ham ochishingiz mumkin, `setup()` varaqlarni o'zi yaratadi.)
2. **Extensions → Apps Script** → `apps-script/Code.gs` mazmunini to'liq joylang → saqlang.
3. Sheets havolasidan ID ni oling (`docs.google.com/spreadsheets/d/`**`ID`**`/edit`) va Code.gs boshidagi `SHEET_ID` ga yozing (bog'langan skriptda bo'sh qoldirsangiz ham ishlaydi).
4. `setGoogleClientId()` ichiga o'z Client ID ingizni yozing (pastdagi 2-bo'limda olinadi) va funksiyani bir marta ishga tushiring.
5. **setup()** ni, keyin **createFirstAdmin()** ni ishga tushiring (ruxsat so'ralganda ruxsat bering). Ishlatgach parolni koddan o'chiring.
6. **Deploy → New deployment → Web app**: *Execute as:* **Me**, *Who has access:* **Anyone** → URL ni nusxalang (`.../exec`).
   Kodni o'zgartirsangiz: Deploy → Manage deployments → Edit → **New version**.

Sheets ichida 9 ta varaq yaratiladi: Users, Clients, Groups, Mocks, MockStudents, Attempts, Sessions, Leads, Audit.
**Bu Sheets fayliga faqat o'zingiz kirishingiz kerak** (parol hash lari shu yerda). Uni hech kimga ulashmang.

## 2. Google OAuth (Google bilan kirish)
1. console.cloud.google.com → yangi loyiha → **APIs & Services → OAuth consent screen** (External) to'ldiring.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorized JavaScript origins** ga qo'shing: `https://SIZNING-LOYIHA.vercel.app` (va sinov uchun `http://localhost:8000`).
4. Client ID ni ham Apps Script (`setGoogleClientId`), ham `config.js` ga yozing.

## 3. Vercel
1. `config.js` ga `API_URL` va `GOOGLE_CLIENT_ID` ni yozing.
2. Shu papkani GitHub'ga yuklab Vercel'da *Import* qiling yoki `npx vercel --prod` ishlating.
   Framework: **Other**, build command yo'q, output: ildiz papka.
3. Vercel domenini 2-bosqichdagi Authorized origins ga qo'shishni unutmang.

## 4. Tekshirish
```
curl -L -X POST "APPS_SCRIPT_URL" -H "Content-Type: text/plain" -d '{"action":"ping"}'
```
Javob: `{"ok":true,"data":{"time":...}}`

## API amallari (action)
| Guruh | Amallar |
|---|---|
| Ochiq | `auth.register`, `auth.google`, `auth.login`, `exam.login`, `lead.create` |
| Hisob | `auth.me`, `auth.logout`, `auth.changePassword` |
| Admin | `admin.stats`, `admin.createClient`, `admin.listClients`, `admin.setClientStatus`, `admin.resetClientPassword`, `admin.listLeads`, `admin.setLeadStatus` |
| Direktor | `client.addTeacher` |
| Guruh | `group.create`, `group.list` |
| Mock | `mock.save`, `mock.get`, `mock.list`, `mock.setStatus` (draft→published→active→closed) |
| Mockka o'quvchi | `mock.addStudents`, `mock.students`, `mock.resetStudentPassword`, `mock.reopenStudent`, `mock.removeStudent` |
| Imtihon | `exam.start`, `exam.save`, `exam.flag`, `exam.submit` |
| Tahlil | `analytics.mock` |

## Cheklovlar (halol eslatma)
- Apps Script bir vaqtda ~30 ta so'rovni bajaradi va har so'rov 0.3–1.5 soniya oladi. **Yuzlab o'quvchi bir vaqtda** yechsa, `exam.save` ni har javobdan emas, har 10–15 soniyada paketlab (`items`) yuboring.
- Bitta katak 50 000 belgi: juda uzun test `mock.save` da xato beradi. Rasmlarni Sheets'ga emas, Drive/Cloudinary'ga yuklab, havolasini saqlang.
- Parollar sha-256 (100 aylanish, tuz bilan) hash qilinadi, bcrypt emas. Parollar kuchli va tasodifiy yaratilgani uchun yetarli, lekin katta ishlab chiqarish uchun keyin Supabase/Firebase'ga o'tishni o'ylang.
- Hozirgi dashboard ekranlari hali statik namuna: ularni `OZAQ.call(...)` ga ulash keyingi bosqich.
