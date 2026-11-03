# OZAQ — mock testlar va analitika platformasi

Haqiqiy ishlaydigan tizim: **Vercel** (frontend) → **Google Apps Script** (server) → **Google Sheets** (baza).

| Fayl | Vazifasi |
|---|---|
| `index.html`, `app.js`, `api.js` | O’qituvchi paneli, mock muharriri, o’quvchi imtihoni, ro’yxatdan o’tish (email + Google) |
| `admin.html` | Super Admin paneli (Premium mijozlar, demo so’rovlar) |
| `config.js` | `API_URL` va `GOOGLE_CLIENT_ID` |
| `apps-script/Code.gs` | Backend (Apps Script) |
| `OZAQ-DB.xlsx` | Sheets uchun tayyor sarlavhalar |
| `prototype/` | Faqat dizayn namunalari (statik, backendga ulanmagan) |

To’liq sozlash: `DEPLOY.md`.
