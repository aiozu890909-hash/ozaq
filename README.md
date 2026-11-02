# OZAQ sayti (statik prototip)

- `index.html` — yagona kirish nuqtasi (router). Chap-pastdagi "Ekranlar" tugmasi barcha 15 ekranni ochadi.
- `screens/*.html` — har bir ekran alohida fayl (Stitch dizaynidan, Tailwind CDN bilan).

Google bilan ro’yxatdan o’tish: `screens/r-register.html` ichidagi `GOOGLE_CLIENT_ID` ga OAuth Client ID ni qo’ying (Google Cloud Console, Web client, sayt manzili Authorized JavaScript origins da bo’lsin). Token serverda tekshirilishi shart.

Ishga tushirish: `python3 -m http.server 8000` va http://localhost:8000 ni oching.
