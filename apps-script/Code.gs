/**
 * OZAQ backend — Google Apps Script + Google Sheets
 * Bitta Google Sheets fayliga bog'langan (Extensions → Apps Script) skript sifatida joylang.
 * Sozlash: DEPLOY.md ga qarang. Dastlab setup() va createFirstAdmin() ni qo'lda ishga tushiring.
 */
// Google Sheets ID: havoladagi /d/ va /edit orasidagi qism (https://docs.google.com/spreadsheets/d/ID/edit).
// Bo'sh qoldirsangiz, skript bog'langan (Extensions → Apps Script) Sheets fayli ishlatiladi.
const SHEET_ID = 'SHU_YERGA_SHEETS_ID';
const CFG = { SESSION_HOURS: 12, FREE_MAX_GROUPS: 2, FREE_MAX_STUDENTS: 30, HIGH: 85, MID: 55, MAX_CELL: 45000 };
const SCHEMA = {
  Users: ['id','role','name','email','login','salt','hash','clientId','googleSub','picture','status','mustChangePw','createdAt'],
  Clients: ['id','name','type','region','contactName','phone','email','groupLimit','studentLimit','features','startsAt','endsAt','status','manager','createdAt'],
  Groups: ['id','ownerId','clientId','name','createdAt'],
  Mocks: ['id','ownerId','clientId','title','subject','status','settings','doc','questions','createdAt','updatedAt'],
  MockStudents: ['id','mockId','groupId','name','login','salt','hash','state','attemptId','createdAt'],
  Attempts: ['id','mockId','studentId','startedAt','submittedAt','score','maxScore','answers','timings','perq','flags','manual'],
  Sessions: ['token','userId','role','mockId','expiresAt'],
  Leads: ['id','name','org','phone','status','createdAt'],
  Audit: ['at','actor','action','detail']
};

// ---------- HTTP ----------
function doGet() { return out_({ ok: true, service: 'OZAQ API' }); }
function doPost(e) {
  let res;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const req = JSON.parse(e.postData.contents);
    res = { ok: true, data: route_(req) };
  } catch (err) {
    res = { ok: false, error: String(err && err.message || err) };
  } finally { try { lock.releaseLock(); } catch (_) {} }
  return out_(res);
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

const PUBLIC = { 'ping': 1, 'auth.register': 1, 'auth.google': 1, 'auth.login': 1, 'exam.login': 1, 'lead.create': 1 };
function route_(r) {
  const a = r.action;
  if (a === 'ping') return { time: Date.now() };
  const H = HANDLERS[a];
  if (!H) throw new Error('Noma\'lum amal: ' + a);
  const s = PUBLIC[a] ? null : session_(r.token);
  return H(r, s);
}

// ---------- DB helpers ----------
let _ss = null;
function ss_() {
  if (!_ss) _ss = (SHEET_ID && SHEET_ID.indexOf('SHU_YERGA') !== 0) ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!_ss) throw new Error('Sheets topilmadi: SHEET_ID ni kiriting yoki skriptni Sheets ichidan oching');
  return _ss;
}
function sh_(n) { const x = ss_().getSheetByName(n); if (!x) throw new Error('"' + n + '" varag\'i yo\'q. Avval setup() ni ishga tushiring.'); return x; }
function toObj_(n, row, r) { const o = { __r: r }; SCHEMA[n].forEach((k, j) => o[k] = row[j] instanceof Date ? row[j].toISOString() : row[j]); return o; }
function all_(n) {
  const v = sh_(n).getDataRange().getValues(); const o = [];
  for (let i = 1; i < v.length; i++) o.push(toObj_(n, v[i], i + 1));
  return o;
}
function one_(n, col, val) {
  const sh = sh_(n), last = sh.getLastRow(); if (last < 2) return null;
  const c = SCHEMA[n].indexOf(col) + 1;
  const f = sh.getRange(2, c, last - 1, 1).createTextFinder(String(val)).matchEntireCell(true).matchCase(true).findNext();
  if (!f) return null;
  return toObj_(n, sh.getRange(f.getRow(), 1, 1, SCHEMA[n].length).getValues()[0], f.getRow());
}
function add_(n, o) { sh_(n).appendRow(SCHEMA[n].map(k => o[k] === undefined ? '' : o[k])); return o; }
function upd_(n, o) {
  const h = SCHEMA[n];
  if (!o.__r) { const cur = one_(n, h[0], o[h[0]]); o.__r = cur.__r; }
  sh_(n).getRange(o.__r, 1, 1, h.length).setValues([h.map(k => o[k] === undefined ? '' : o[k])]);
}
function id_(p) { return p + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function now_() { return Date.now(); }
function log_(actor, action, detail) { add_('Audit', { at: new Date().toISOString(), actor: actor, action: action, detail: String(detail || '').slice(0, 500) }); }
function jparse_(s, d) { try { return s ? JSON.parse(s) : d; } catch (_) { return d; } }
function jstr_(o) { const s = JSON.stringify(o); if (s.length > CFG.MAX_CELL) throw new Error('Ma\'lumot juda katta (Sheets katak chegarasi). Testni qisqartiring.'); return s; }

// ---------- crypto / ids ----------
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function randStr_(n, alpha) {
  alpha = alpha || ALPHA; let s = '';
  while (s.length < n) {
    const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
    for (let i = 0; i < d.length && s.length < n; i++) s += alpha[(d[i] & 255) % alpha.length];
  }
  return s;
}
function hash_(salt, pw) {
  let h = salt + pw;
  for (let i = 0; i < 100; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt));
  return h;
}
function setPw_(o, pw) { o.salt = randStr_(16); o.hash = hash_(o.salt, pw); }
function checkPw_(o, pw) { return o && o.hash && hash_(o.salt, String(pw)) === o.hash; }
function slug_(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10) || 'user'; }
function uniqueLogin_(sheet, base) {
  for (let i = 0; i < 20; i++) { const l = base + randStr_(4, '0123456789'); if (!one_(sheet, 'login', l)) return l; }
  throw new Error('Login yaratib bo\'lmadi');
}
function cleanHtml_(h) {
  return String(h || '').replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, '');
}
function shuffle_(arr, seed) {
  let t = parseInt(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, seed).slice(0, 4).map(b => (b & 255).toString(16).padStart(2, '0')).join(''), 16) || 1;
  const rnd = () => { t += 0x6D2B79F5; let x = Math.imul(t ^ t >>> 15, 1 | t); x ^= x + Math.imul(x ^ x >>> 7, 61 | x); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- sessions / auth ----------
function guard_(key) {
  const c = CacheService.getScriptCache(), k = 'f_' + key, n = Number(c.get(k)) || 0;
  if (n >= 5) throw new Error("Juda ko'p noto'g'ri urinish. 10 daqiqadan keyin qayta urining.");
  return { fail: function () { c.put(k, String(n + 1), 600); }, pass: function () { c.remove(k); } };
}
function newSession_(userId, role, mockId) {
  const token = randStr_(48, 'abcdef0123456789');
  add_('Sessions', { token: token, userId: userId, role: role, mockId: mockId || '', expiresAt: now_() + CFG.SESSION_HOURS * 3600e3 });
  return token;
}
function session_(token) {
  if (!token) throw new Error('Kirish talab qilinadi');
  const s = one_('Sessions', 'token', token);
  if (!s || Number(s.expiresAt) < now_()) throw new Error('Sessiya tugagan, qayta kiring');
  if (s.role === 'student') {
    const st = one_('MockStudents', 'id', s.userId); if (!st) throw new Error('O\'quvchi topilmadi');
    return { role: 'student', id: st.id, student: st, mockId: s.mockId, token: token };
  }
  const u = one_('Users', 'id', s.userId);
  if (!u || u.status === 'blocked') throw new Error('Akkaunt bloklangan');
  return { role: u.role, id: u.id, user: u, token: token };
}
function planOf_(u) {
  if (u.role === 'admin') return 'premium';
  if (!u.clientId) return 'free';
  const c = one_('Clients', 'id', u.clientId);
  if (!c || c.status !== 'active') return 'free';
  if (c.endsAt && Date.parse(c.endsAt) < now_()) return 'free';
  return 'premium';
}
function profile_(u) { return { id: u.id, role: u.role, name: u.name, email: u.email, login: u.login, picture: u.picture, clientId: u.clientId, plan: planOf_(u), mustChangePw: !!u.mustChangePw }; }
function need_(s, roles) { if (roles.indexOf(s.role) < 0) throw new Error('Ruxsat yo\'q'); }

// ---------- grading ----------
function eqSet_(a, b) { a = (a || []).map(String).sort(); b = (b || []).map(String).sort(); return a.length === b.length && a.every((x, i) => x === b[i]); }
function norm_(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); }
function grade_(q, a, partial) {
  const p = Number(q.points) || 1;
  if (a === undefined || a === null || a === '' || (Array.isArray(a) && !a.length)) return 0;
  switch (q.type) {
    case 'single': case 'tf': return eqSet_([a], q.correct) ? p : 0;
    case 'multi': {
      if (eqSet_(a, q.correct)) return p;
      if (!partial) return 0;
      const hit = a.filter(x => q.correct.indexOf(x) >= 0).length, bad = a.length - hit;
      return Math.max(0, (hit - bad) / q.correct.length) * p;
    }
    case 'short': {
      const na = norm_(a);
      return (q.accept || []).some(x => norm_(x) === na || (!isNaN(+x) && !isNaN(+a) && Math.abs(+x - +a) < 1e-9)) ? p : 0;
    }
    case 'match': { const m = q.correctMap || {}; const k = Object.keys(m); return k.length && k.every(x => a && a[x] === m[x]) ? p : 0; }
    default: return null; // 'long' — qo'lda baholanadi
  }
}
function publicQ_(q) { const c = JSON.parse(JSON.stringify(q)); delete c.correct; delete c.accept; delete c.correctMap; delete c.explanation; return c; }
function finalize_(att, mock) {
  const qs = jparse_(mock.questions, []), ans = jparse_(att.answers, {}), set = jparse_(mock.settings, {});
  let score = 0, max = 0, manual = 0; const perq = {};
  qs.forEach(q => { const g = grade_(q, ans[q.id], set.partial); max += Number(q.points) || 1; if (g === null) { manual++; perq[q.id] = null; } else { score += g; perq[q.id] = g; } });
  att.score = Math.round(score * 100) / 100; att.maxScore = max; att.perq = jstr_(perq); att.manual = manual; att.submittedAt = now_();
  upd_('Attempts', att);
  const st = one_('MockStudents', 'id', att.studentId); st.state = 'submitted'; upd_('MockStudents', st);
}

// ---------- access ----------
function mockFor_(s, id) {
  const m = one_('Mocks', 'id', id); if (!m) throw new Error('Test topilmadi');
  const u = s.user;
  if (u.role !== 'admin' && m.ownerId !== u.id && !(u.clientId && m.clientId === u.clientId && u.role === 'director')) throw new Error('Bu test sizniki emas');
  return m;
}

// ---------- handlers ----------
const HANDLERS = {
  // ---- auth ----
  'auth.register': (r) => {
    const email = norm_(r.email), name = String(r.name || '').trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || String(r.password || '').length < 8) throw new Error('Ma\'lumotlar noto\'g\'ri');
    if (one_('Users', 'email', email)) throw new Error('Bu email allaqachon ro\'yxatdan o\'tgan');
    const u = { id: id_('u'), role: 'teacher', name: name, email: email, login: email, status: 'active', createdAt: new Date().toISOString() };
    setPw_(u, r.password); add_('Users', u); log_(u.id, 'register', email);
    return { token: newSession_(u.id, u.role), user: profile_(u) };
  },
  'auth.google': (r) => {
    const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(r.credential), { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('Google tokeni yaroqsiz');
    const t = JSON.parse(resp.getContentText());
    const cid = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
    if (!cid || t.aud !== cid) throw new Error('Google Client ID mos kelmadi');
    if (String(t.email_verified) !== 'true') throw new Error('Email tasdiqlanmagan');
    const email = norm_(t.email); let u = one_('Users', 'email', email);
    if (!u) {
      u = { id: id_('u'), role: 'teacher', name: t.name || email, email: email, login: email, googleSub: t.sub, picture: t.picture || '', status: 'active', createdAt: new Date().toISOString() };
      add_('Users', u); log_(u.id, 'register.google', email);
    } else if (u.status === 'blocked') throw new Error('Akkaunt bloklangan');
    else if (!u.googleSub) { u.googleSub = t.sub; u.picture = u.picture || t.picture || ''; upd_('Users', u); }
    return { token: newSession_(u.id, u.role), user: profile_(u) };
  },
  'auth.login': (r) => {
    const g = guard_('u_' + norm_(r.login)), u = one_('Users', 'login', norm_(r.login));
    if (!u || !checkPw_(u, r.password)) { g.fail(); throw new Error('Login yoki parol noto\'g\'ri'); }
    if (u.status === 'blocked') throw new Error('Akkaunt bloklangan');
    g.pass();
    return { token: newSession_(u.id, u.role), user: profile_(u) };
  },
  'auth.me': (r, s) => { need_(s, ['admin', 'teacher', 'director']); return profile_(s.user); },
  'auth.logout': (r, s) => { const x = one_('Sessions', 'token', s.token); if (x) { x.expiresAt = 0; upd_('Sessions', x); } return true; },
  'auth.changePassword': (r, s) => {
    need_(s, ['admin', 'teacher', 'director']);
    if (!checkPw_(s.user, r.oldPassword) || String(r.newPassword || '').length < 8) throw new Error('Parol noto\'g\'ri yoki juda qisqa');
    setPw_(s.user, r.newPassword); s.user.mustChangePw = false; upd_('Users', s.user); return true;
  },

  // ---- leads (landing "Demo so'rash") ----
  'lead.create': (r) => {
    if (!String(r.name || '').trim() || !String(r.phone || '').trim()) throw new Error('Ism va telefon kerak');
    add_('Leads', { id: id_('l'), name: String(r.name).slice(0, 80), org: String(r.org || '').slice(0, 120), phone: String(r.phone).slice(0, 30), status: 'new', createdAt: new Date().toISOString() });
    return true;
  },

  // ---- admin ----
  'admin.stats': (r, s) => {
    need_(s, ['admin']); const cl = all_('Clients'), us = all_('Users'), ld = all_('Leads');
    return { premium: cl.filter(c => c.status === 'active').length, free: us.filter(u => u.role === 'teacher' && !u.clientId).length,
      newLeads: ld.filter(l => l.status === 'new').length,
      expiring: cl.filter(c => c.endsAt && Date.parse(c.endsAt) - now_() < 14 * 864e5 && c.status === 'active').length };
  },
  'admin.createClient': (r, s) => {
    need_(s, ['admin']);
    if (!String(r.name || '').trim()) throw new Error('Tashkilot nomi kerak');
    const c = { id: id_('c'), name: r.name, type: r.type || 'center', region: r.region || '', contactName: r.contactName || '', phone: r.phone || '', email: r.email || '',
      groupLimit: Number(r.groupLimit) || 0, studentLimit: Number(r.studentLimit) || 0, features: jstr_(r.features || {}), startsAt: r.startsAt || new Date().toISOString(),
      endsAt: r.endsAt || '', status: 'active', manager: r.manager || '', createdAt: new Date().toISOString() };
    add_('Clients', c);
    const password = randStr_(10), u = { id: id_('u'), role: 'director', name: r.contactName || r.name, email: norm_(r.email), clientId: c.id, status: 'active', mustChangePw: true, createdAt: new Date().toISOString() };
    u.login = uniqueLogin_('Users', slug_(r.name)); setPw_(u, password); add_('Users', u);
    log_(s.id, 'client.create', c.name);
    return { client: c, credentials: { login: u.login, password: password } }; // parol faqat shu yerda ko'rinadi
  },
  'admin.listClients': (r, s) => { need_(s, ['admin']); return all_('Clients').map(c => { delete c.__r; return c; }); },
  'admin.setClientStatus': (r, s) => {
    need_(s, ['admin']); const c = one_('Clients', 'id', r.id); if (!c) throw new Error('Mijoz topilmadi');
    if (['active', 'frozen', 'expired', 'trial'].indexOf(r.status) < 0) throw new Error('Holat noto\'g\'ri');
    c.status = r.status; if (r.endsAt) c.endsAt = r.endsAt; upd_('Clients', c); log_(s.id, 'client.status', c.id + ' ' + r.status); return true;
  },
  'admin.resetClientPassword': (r, s) => {
    need_(s, ['admin']); const u = all_('Users').filter(x => x.clientId === r.clientId && x.role === 'director')[0]; if (!u) throw new Error('Foydalanuvchi topilmadi');
    const password = randStr_(10); setPw_(u, password); u.mustChangePw = true; upd_('Users', u); log_(s.id, 'client.pwreset', r.clientId);
    return { login: u.login, password: password };
  },
  'admin.listLeads': (r, s) => { need_(s, ['admin']); return all_('Leads').map(l => { delete l.__r; return l; }); },
  'admin.setLeadStatus': (r, s) => { need_(s, ['admin']); const l = one_('Leads', 'id', r.id); l.status = r.status; upd_('Leads', l); return true; },

  // ---- director: o'qituvchi qo'shish ----
  'client.addTeacher': (r, s) => {
    need_(s, ['director']); const password = randStr_(8);
    const u = { id: id_('u'), role: 'teacher', name: String(r.name || '').trim(), email: norm_(r.email), clientId: s.user.clientId, status: 'active', mustChangePw: true, createdAt: new Date().toISOString() };
    if (!u.name) throw new Error('Ism kerak'); u.login = uniqueLogin_('Users', slug_(u.name)); setPw_(u, password); add_('Users', u);
    return { id: u.id, login: u.login, password: password };
  },

  // ---- groups ----
  'group.create': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const plan = planOf_(s.user);
    const mine = all_('Groups').filter(g => g.ownerId === s.id);
    if (plan === 'free' && mine.length >= CFG.FREE_MAX_GROUPS) throw new Error('LIMIT: Bepul tarifda ' + CFG.FREE_MAX_GROUPS + ' ta guruh. Premium\'ga o\'ting.');
    if (plan === 'premium' && s.user.clientId) {
      const c = one_('Clients', 'id', s.user.clientId);
      if (c && Number(c.groupLimit) > 0 && all_('Groups').filter(x => x.clientId === c.id).length >= Number(c.groupLimit)) throw new Error('LIMIT: Tarifdagi guruhlar limiti (' + c.groupLimit + ') tugagan.');
    }
    const g = { id: id_('g'), ownerId: s.id, clientId: s.user.clientId || '', name: String(r.name || '').trim(), createdAt: new Date().toISOString() };
    if (!g.name) throw new Error('Guruh nomi kerak'); add_('Groups', g); return g;
  },
  'group.list': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const st = all_('MockStudents');
    return all_('Groups').filter(g => g.ownerId === s.id || (s.user.clientId && g.clientId === s.user.clientId && s.user.role === 'director'))
      .map(g => ({ id: g.id, name: g.name, createdAt: g.createdAt, students: st.filter(x => x.groupId === g.id && x.state !== 'removed').length }));
  },
  'group.students': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const g = one_('Groups', 'id', r.groupId);
    if (!g || (g.ownerId !== s.id && s.user.role !== 'admin' && !(s.user.role === 'director' && s.user.clientId && g.clientId === s.user.clientId))) throw new Error('Guruh topilmadi');
    const mk = {}; all_('Mocks').forEach(m => mk[m.id] = m.title);
    return all_('MockStudents').filter(x => x.groupId === g.id && x.state !== 'removed').map(x => ({ name: x.name, mock: mk[x.mockId] || '', state: x.state }));
  },

  // ---- mocks (muharrir) ----
  'mock.save': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const plan = planOf_(s.user);
    const T = { single: 1, multi: 1, short: 1, tf: 1, long: 1, match: 1 };
    const qs = (r.questions || []).map((q, i) => {
      if (!T[q.type]) throw new Error((i + 1) + '-savol turi noto\'g\'ri');
      if (plan === 'free' && (q.type === 'long' || q.type === 'match')) throw new Error('LIMIT: ' + q.type + ' savol turi Premium\'da');
      if (!q.topic) throw new Error((i + 1) + '-savolga mavzu kiriting');
      return { id: q.id || id_('q'), type: q.type, text: cleanHtml_(q.text), options: (q.options || []).map(o => ({ id: o.id || id_('o'), text: cleanHtml_(o.text) })),
        correct: q.correct || [], accept: q.accept || [], correctMap: q.correctMap || {}, match: q.match || null, points: Number(q.points) || 1, topic: String(q.topic).slice(0, 60),
        difficulty: q.difficulty || 'medium', explanation: cleanHtml_(q.explanation), timeLimit: Number(q.timeLimit) || 0 };
    });
    let m;
    if (r.id) {
      m = mockFor_(s, r.id);
      if (m.status === 'active' || m.status === 'closed') throw new Error('Faol testni tahrirlab bo\'lmaydi');
    } else m = { id: id_('m'), ownerId: s.id, clientId: s.user.clientId || '', status: 'draft', createdAt: new Date().toISOString() };
    m.title = String(r.title || 'Nomsiz test').slice(0, 120); m.subject = String(r.subject || '').slice(0, 60);
    m.settings = jstr_(r.settings || {}); m.doc = jstr_(r.doc || {}); m.questions = jstr_(qs); m.updatedAt = new Date().toISOString();
    if (r.id) upd_('Mocks', m); else add_('Mocks', m);
    return { id: m.id, status: m.status, updatedAt: m.updatedAt };
  },
  'mock.get': (r, s) => { need_(s, ['teacher', 'director', 'admin']); const m = mockFor_(s, r.id); return { id: m.id, title: m.title, subject: m.subject, status: m.status, settings: jparse_(m.settings, {}), doc: jparse_(m.doc, {}), questions: jparse_(m.questions, []) }; },
  'mock.list': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const u = s.user, stu = all_('MockStudents'), own = {}; all_('Users').forEach(x => own[x.id] = x.name);
    return all_('Mocks').filter(m => u.role === 'admin' || m.ownerId === u.id || (u.clientId && m.clientId === u.clientId && u.role === 'director'))
      .map(m => { const ss = stu.filter(x => x.mockId === m.id); return { id: m.id, title: m.title, subject: m.subject, status: m.status, updatedAt: m.updatedAt, owner: own[m.ownerId] || '', students: ss.length, submitted: ss.filter(x => x.state === 'submitted').length }; });
  },
  'mock.setStatus': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const m = mockFor_(s, r.id);
    const ok = { draft: ['published'], published: ['active', 'draft'], active: ['closed'], closed: ['active'] };
    if ((ok[m.status] || []).indexOf(r.status) < 0) throw new Error(m.status + ' → ' + r.status + ' mumkin emas');
    if (r.status === 'published' && !jparse_(m.questions, []).length) throw new Error('Kamida 1 ta savol kerak');
    m.status = r.status; m.updatedAt = new Date().toISOString(); upd_('Mocks', m); return { status: m.status };
  },

  // ---- mockka o'quvchi qo'shish va login/parol ----
  'mock.addStudents': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const m = mockFor_(s, r.mockId), plan = planOf_(s.user);
    const names = (r.names || []).map(x => String(x).trim()).filter(Boolean);
    const have = all_('MockStudents').filter(x => x.mockId === m.id).length;
    if (plan === 'free' && have + names.length > CFG.FREE_MAX_STUDENTS) throw new Error('LIMIT: Bepul tarifda bitta mockga ' + CFG.FREE_MAX_STUDENTS + ' tagacha o\'quvchi.');
    if (r.groupId) { const g = one_('Groups', 'id', r.groupId); if (!g || (g.ownerId !== s.id && !(s.user.clientId && g.clientId === s.user.clientId))) throw new Error('Guruh topilmadi'); }
    if (plan === 'premium' && s.user.clientId) {
      const c = one_('Clients', 'id', s.user.clientId);
      if (c && Number(c.studentLimit) > 0) {
        const mk = {}; all_('Mocks').filter(x => x.clientId === c.id).forEach(x => mk[x.id] = 1);
        if (all_('MockStudents').filter(x => mk[x.mockId] && x.state !== 'removed').length + names.length > Number(c.studentLimit)) throw new Error('LIMIT: Tarifdagi o\'quvchilar limiti (' + c.studentLimit + ') tugagan.');
      }
    }
    return names.map(n => {
      const password = randStr_(6), st = { id: id_('s'), mockId: m.id, groupId: r.groupId || '', name: n.slice(0, 80), state: 'new', createdAt: new Date().toISOString() };
      st.login = uniqueLogin_('MockStudents', 'oz'); setPw_(st, password); add_('MockStudents', st);
      return { id: st.id, name: st.name, login: st.login, password: password };
    });
  },
  'mock.students': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const m = mockFor_(s, r.mockId);
    const att = all_('Attempts').filter(a => a.mockId === m.id);
    return all_('MockStudents').filter(x => x.mockId === m.id).map(x => { const a = att.filter(y => y.id === x.attemptId)[0];
      return { id: x.id, name: x.name, login: x.login, state: x.state, score: a && a.submittedAt ? a.score : null, maxScore: a ? a.maxScore : null }; });
  },
  'mock.resetStudentPassword': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const st = one_('MockStudents', 'id', r.studentId); if (!st) throw new Error('Topilmadi'); mockFor_(s, st.mockId);
    const password = randStr_(6); setPw_(st, password); upd_('MockStudents', st); return { login: st.login, password: password };
  },
  'mock.reopenStudent': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const st = one_('MockStudents', 'id', r.studentId); mockFor_(s, st.mockId);
    st.state = 'new'; st.attemptId = ''; upd_('MockStudents', st); return true;
  },
  'mock.removeStudent': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const st = one_('MockStudents', 'id', r.studentId); mockFor_(s, st.mockId);
    st.state = 'removed'; st.login = 'x_' + st.id; upd_('MockStudents', st); return true;
  },

  // ---- o'quvchi imtihoni ----
  'exam.login': (r) => {
    const g = guard_('s_' + norm_(r.login)), st = one_('MockStudents', 'login', norm_(r.login));
    if (!st || st.state === 'removed' || !checkPw_(st, r.password)) { g.fail(); throw new Error('Login yoki parol noto\'g\'ri'); }
    g.pass();
    const m = one_('Mocks', 'id', st.mockId), set = jparse_(m.settings, {});
    if (m.status !== 'active') throw new Error('Test hozir faol emas');
    if (set.startsAt && Date.parse(set.startsAt) > now_()) throw new Error('Test ' + set.startsAt + ' da boshlanadi');
    if (set.endsAt && Date.parse(set.endsAt) < now_()) throw new Error('Test vaqti tugagan');
    if (st.state === 'submitted' && set.oneTime !== false) throw new Error('Siz bu testni topshirgansiz');
    return { token: newSession_(st.id, 'student', m.id), student: { name: st.name }, exam: { title: m.title, duration: Number(set.duration) || 60, questions: jparse_(m.questions, []).length } };
  },
  'exam.start': (r, s) => {
    need_(s, ['student']); const m = one_('Mocks', 'id', s.mockId), set = jparse_(m.settings, {}), st = s.student;
    if (m.status !== 'active') throw new Error('Test faol emas');
    let att = st.attemptId ? one_('Attempts', 'id', st.attemptId) : null;
    if (!att) {
      att = { id: id_('a'), mockId: m.id, studentId: st.id, startedAt: now_(), answers: '{}', timings: '{}', perq: '{}', flags: '{}', manual: 0 };
      add_('Attempts', att); att = one_('Attempts', 'id', att.id); st.attemptId = att.id; st.state = 'solving'; upd_('MockStudents', st);
    }
    const dur = (Number(set.duration) || 60) * 60000, left = Math.max(0, att.startedAt + dur - now_());
    if (att.submittedAt) throw new Error('Test topshirilgan');
    if (left === 0) { finalize_(att, m); throw new Error('Vaqt tugadi, javoblar topshirildi'); }
    let qs = jparse_(m.questions, []).map(publicQ_);
    if (set.shuffleQ) qs = shuffle_(qs, att.id);
    if (set.shuffleO) qs.forEach(q => { if (q.options && q.type !== 'tf') q.options = shuffle_(q.options, att.id + q.id); });
    return { attemptId: att.id, timeLeftSec: Math.floor(left / 1000), questions: qs, answers: jparse_(att.answers, {}), doc: jparse_(m.doc, {}) };
  },
  'exam.save': (r, s) => {
    need_(s, ['student']); const st = s.student, att = one_('Attempts', 'id', st.attemptId); if (!att || att.submittedAt) throw new Error('Urinish yopilgan');
    const m = one_('Mocks', 'id', att.mockId), set = jparse_(m.settings, {});
    if (now_() > att.startedAt + ((Number(set.duration) || 60) * 60000) + 5000) { finalize_(att, m); throw new Error('Vaqt tugadi'); }
    const ans = jparse_(att.answers, {}), tm = jparse_(att.timings, {});
    (r.items || (r.qid ? [{ qid: r.qid, answer: r.answer, ms: r.ms }] : [])).forEach(it => {
      ans[it.qid] = it.answer; tm[it.qid] = (tm[it.qid] || 0) + Math.min(Math.max(Number(it.ms) || 0, 0), 600000);
    });
    att.answers = jstr_(ans); att.timings = jstr_(tm); upd_('Attempts', att); return { saved: true };
  },
  'exam.flag': (r, s) => {
    need_(s, ['student']); const att = one_('Attempts', 'id', s.student.attemptId); if (!att || att.submittedAt) return true;
    const f = jparse_(att.flags, {}); const k = String(r.type || 'other').slice(0, 20); f[k] = (f[k] || 0) + 1; att.flags = jstr_(f); upd_('Attempts', att); return true;
  },
  'exam.submit': (r, s) => {
    need_(s, ['student']); const att = one_('Attempts', 'id', s.student.attemptId); if (!att) throw new Error('Urinish topilmadi');
    const m = one_('Mocks', 'id', att.mockId), set = jparse_(m.settings, {});
    if (!att.submittedAt) { if (r.items) HANDLERS['exam.save'](r, s); const a2 = one_('Attempts', 'id', att.id); finalize_(a2, m); }
    const fin = one_('Attempts', 'id', att.id), mode = set.showResult || 'instant';
    return mode === 'instant' ? { shown: true, score: fin.score, maxScore: fin.maxScore, percent: Math.round(fin.score / fin.maxScore * 100), pending: Number(fin.manual) || 0 } : { shown: false };
  },

  // ---- direktor: o'qituvchilar boshqaruvi ----
  'client.overview': (r, s) => {
    need_(s, ['director']); const cid = s.user.clientId;
    const users = all_('Users').filter(u => u.clientId === cid && (u.role === 'teacher' || u.role === 'director'));
    const mocks = all_('Mocks').filter(m => m.clientId === cid), mid = {}; mocks.forEach(m => mid[m.id] = m);
    const stu = all_('MockStudents').filter(x => mid[x.mockId] && x.state !== 'removed'), att = all_('Attempts').filter(a => a.submittedAt && mid[a.mockId]);
    return users.map(u => {
      const mm = mocks.filter(m => m.ownerId === u.id), ids = {}; mm.forEach(m => ids[m.id] = 1);
      const aa = att.filter(a => ids[a.mockId]);
      const avg = aa.length ? Math.round(aa.reduce((x, a) => x + (a.maxScore ? a.score / a.maxScore * 100 : 0), 0) / aa.length) : null;
      return { id: u.id, name: u.name, login: u.login, role: u.role, mocks: mm.length, students: stu.filter(x => ids[x.mockId]).length, submitted: aa.length, avg: avg };
    });
  },
  'client.resetTeacherPassword': (r, s) => {
    need_(s, ['director']); const u = one_('Users', 'id', r.id);
    if (!u || u.clientId !== s.user.clientId || u.role !== 'teacher') throw new Error('O\'qituvchi topilmadi');
    const password = randStr_(8); setPw_(u, password); u.mustChangePw = true; upd_('Users', u); return { login: u.login, password: password };
  },

  // ---- uzun javoblarni qo'lda baholash ----
  'mock.attempts': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const m = mockFor_(s, r.mockId), longs = jparse_(m.questions, []).filter(q => q.type === 'long');
    if (!longs.length) return [];
    const nm = {}; all_('MockStudents').filter(x => x.mockId === m.id).forEach(x => nm[x.id] = x.name);
    return all_('Attempts').filter(a => a.mockId === m.id && a.submittedAt).map(a => {
      const ans = jparse_(a.answers, {}), pq = jparse_(a.perq, {});
      return { attemptId: a.id, name: nm[a.studentId] || '', score: a.score, maxScore: a.maxScore, pending: Number(a.manual) || 0,
        items: longs.map(q => ({ qid: q.id, question: q.text, points: q.points, answer: ans[q.id] || '', given: pq[q.id] === undefined ? null : pq[q.id] })) };
    });
  },
  'mock.grade': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const a = one_('Attempts', 'id', r.attemptId);
    if (!a || !a.submittedAt) throw new Error('Urinish topilmadi');
    const m = mockFor_(s, a.mockId), qs = jparse_(m.questions, []), pq = jparse_(a.perq, {});
    Object.keys(r.grades || {}).forEach(qid => {
      const q = qs.filter(x => x.id === qid && x.type === 'long')[0]; if (!q) return;
      const v = Number(r.grades[qid]), mx = Number(q.points) || 1;
      if (isNaN(v) || v < 0 || v > mx) throw new Error('Ball 0 dan ' + mx + ' gacha bo\'lishi kerak');
      pq[qid] = v;
    });
    let score = 0, manual = 0;
    qs.forEach(q => { const v = pq[q.id]; if (v === null || v === undefined) { if (q.type === 'long') manual++; } else score += Number(v); });
    a.perq = jstr_(pq); a.score = Math.round(score * 100) / 100; a.manual = manual; upd_('Attempts', a);
    return { score: a.score, pending: manual };
  },

  // ---- hisobotlar (Excel/CSV va ota-onalar uchun PDF) ----
  'mock.report': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const m = mockFor_(s, r.mockId), qs = jparse_(m.questions, []);
    const nm = {}; all_('MockStudents').filter(x => x.mockId === m.id).forEach(x => nm[x.id] = x.name);
    const att = all_('Attempts').filter(a => a.mockId === m.id && a.submittedAt);
    const rows = att.map(a => {
      const pq = jparse_(a.perq, {}), tm = jparse_(a.timings, {}), tp = {};
      qs.forEach(q => { const t = tp[q.topic] = tp[q.topic] || { topic: q.topic, got: 0, max: 0 }; t.got += Number(pq[q.id]) || 0; t.max += Number(q.points) || 1; });
      return { name: nm[a.studentId] || '', score: a.score, maxScore: a.maxScore, percent: a.maxScore ? Math.round(a.score / a.maxScore * 100) : 0, pending: Number(a.manual) || 0,
        scores: qs.map(q => pq[q.id] == null ? null : pq[q.id]), seconds: qs.map(q => Math.round((tm[q.id] || 0) / 1000)),
        topics: Object.keys(tp).map(k => ({ topic: k, percent: tp[k].max ? Math.round(tp[k].got / tp[k].max * 100) : 0 })) };
    });
    const ta = {}; rows.forEach(x => x.topics.forEach(t => { (ta[t.topic] = ta[t.topic] || []).push(t.percent); }));
    const classTopics = {}; Object.keys(ta).forEach(k => classTopics[k] = Math.round(ta[k].reduce((x, y) => x + y, 0) / ta[k].length));
    rows.forEach(x => x.rank = 1 + rows.filter(y => y.percent > x.percent).length); // teng ballar bir xil o'rin oladi
    rows.sort((a, b) => a.name < b.name ? -1 : 1);
    return { title: m.title, subject: m.subject, count: rows.length, average: rows.length ? Math.round(rows.reduce((x, y) => x + y.percent, 0) / rows.length) : 0,
      questions: qs.map((q, i) => ({ n: i + 1, topic: q.topic, type: q.type, points: q.points })), classTopics: classTopics, students: rows };
  },

  // ---- natijalar va tahlil ----
  'analytics.mock': (r, s) => {
    need_(s, ['teacher', 'director', 'admin']); const m = mockFor_(s, r.mockId), qs = jparse_(m.questions, []);
    const att = all_('Attempts').filter(a => a.mockId === m.id && a.submittedAt);
    const n = att.length; if (!n) return { submitted: 0 };
    const pct = att.map(a => a.maxScore ? a.score / a.maxScore * 100 : 0).sort((x, y) => x - y);
    const avg = pct.reduce((x, y) => x + y, 0) / n, med = pct[Math.floor(n / 2)];
    const hist = new Array(10).fill(0); pct.forEach(p => hist[Math.min(9, Math.floor(p / 10))]++);
    const stu = {}; all_('MockStudents').filter(x => x.mockId === m.id).forEach(x => stu[x.id] = x.name);
    const people = att.map(a => { const p = a.maxScore ? a.score / a.maxScore * 100 : 0; return { name: stu[a.studentId], percent: Math.round(p), band: p >= CFG.HIGH ? 'top' : (p >= CFG.MID ? 'mid' : 'help') }; });
    const per = qs.map((q, i) => {
      let right = 0, ms = 0, cnt = 0; const opt = {};
      att.forEach(a => {
        const pq = jparse_(a.perq, {}), an = jparse_(a.answers, {}), tm = jparse_(a.timings, {});
        if (pq[q.id] !== null && pq[q.id] >= (Number(q.points) || 1)) right++;
        if (tm[q.id]) { ms += tm[q.id]; cnt++; }
        [].concat(an[q.id] === undefined ? [] : an[q.id]).forEach(v => { if (typeof v !== 'object') opt[v] = (opt[v] || 0) + 1; });
      });
      return { n: i + 1, id: q.id, topic: q.topic, type: q.type, correctRate: Math.round(right / n * 100), avgSec: cnt ? Math.round(ms / cnt / 1000) : 0, options: opt };
    });
    const topics = {}; per.forEach(p => { (topics[p.topic] = topics[p.topic] || []).push(p.correctRate); });
    return { submitted: n, avg: Math.round(avg), median: Math.round(med), histogram: hist, people: people,
      hardest: per.slice().sort((a, b) => a.correctRate - b.correctRate).slice(0, 5), questions: per,
      topics: Object.keys(topics).map(t => ({ topic: t, avgRate: Math.round(topics[t].reduce((x, y) => x + y, 0) / topics[t].length) })) };
  }
};

// ---------- bir martalik sozlash (qo'lda ishga tushiring) ----------
function setup() {
  const ss = ss_();
  Object.keys(SCHEMA).forEach(n => {
    const s = ss.getSheetByName(n) || ss.insertSheet(n);
    if (s.getLastRow() === 0) { s.getRange(1, 1, 1, SCHEMA[n].length).setValues([SCHEMA[n]]); s.setFrozenRows(1); }
  });
  const d = ss.getSheets().filter(s => !SCHEMA[s.getName()])[0]; if (d && ss.getSheets().length > 1) ss.deleteSheet(d);
}
function setGoogleClientId() {
  PropertiesService.getScriptProperties().setProperty('GOOGLE_CLIENT_ID', 'SHU_YERGA_CLIENT_ID.apps.googleusercontent.com');
}
function createFirstAdmin() {
  // Ishga tushirgach bu ikki qiymatni koddan o'chiring va admin panelda parolni almashtiring.
  const login = 'SHU_YERGA_ADMIN_LOGIN', password = 'SHU_YERGA_KUCHLI_PAROL';
  if (one_('Users', 'login', login)) return 'Admin allaqachon bor';
  const u = { id: id_('u'), role: 'admin', name: 'Alisher (Super Admin)', email: '', login: login, status: 'active', createdAt: new Date().toISOString() };
  setPw_(u, password); add_('Users', u); return 'Admin yaratildi: ' + login;
}
