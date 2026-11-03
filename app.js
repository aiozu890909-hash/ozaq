(function () {
'use strict';
var C = window.OZAQ_CONFIG || {}, O = window.OZAQ, GID = C.GOOGLE_CLIENT_ID || '', V = document.getElementById('v'), ME = null;
var ST = { draft: 'Qoralama', published: 'Nashr qilingan', active: 'Faol', closed: 'Yopilgan' };
var TL = { single: 'Bitta variant', multi: 'Bir nechta variant', short: 'Qisqa javob', tf: 'To’g’ri / noto’g’ri' };
var NX = { draft: ['published', 'Nashr qilish'], published: ['active', 'Faollashtirish'], active: ['closed', 'Yopish'], closed: ['active', 'Qayta ochish'] };
var BAND = { top: 'A’lochi', mid: 'O’rta', help: 'Yordam kerak' };
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function h(x) { V.innerHTML = x; }
function nid() { return 'o' + Math.random().toString(36).slice(2, 8); }
function toast(m, bad) { var t = $('#toast'); t.textContent = m; t.className = 'on' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = ''; }, 4500); }
function call(a, d, st) { return O.call(a, d, st).catch(function (e) { toast(e.message, 1); throw e; }); }
function go(r) { if (location.hash === '#' + r) route(); else location.hash = r; }
function copy(t) { try { navigator.clipboard.writeText(t).then(function () { toast('Nusxalandi'); }, fb); } catch (_) { fb(); } function fb() { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('Nusxalandi'); } catch (_) {} a.remove(); } }
function dl(name, text) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); }

// ---- HTML tozalash (oq ro'yxat): savol va matnlar o'quvchiga ko'rsatilishidan oldin ----
var OK = 'B I U STRONG EM P BR UL OL LI H1 H2 H3 TABLE THEAD TBODY TR TD TH IMG SPAN DIV SUB SUP BLOCKQUOTE CODE'.split(' ').reduce(function (o, k) { o[k] = 1; return o; }, {});
var BAD = 'SCRIPT STYLE IFRAME OBJECT EMBED LINK META FORM INPUT BUTTON TEXTAREA SELECT SVG MATH BASE'.split(' ').reduce(function (o, k) { o[k] = 1; return o; }, {});
function clean(html) {
  var b = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html').body;
  (function w(n) {
    Array.prototype.slice.call(n.childNodes).forEach(function (c) {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1 || BAD[c.tagName.toUpperCase()]) { c.remove(); return; }
      w(c);
      var tg = c.tagName.toUpperCase();
      if (!OK[tg]) { c.replaceWith.apply(c, Array.prototype.slice.call(c.childNodes)); return; }
      Array.prototype.slice.call(c.attributes).forEach(function (a) {
        var k = a.name.toLowerCase();
        var span = (k === 'colspan' || k === 'rowspan') && /^\d+$/.test(a.value);
        var src = tg === 'IMG' && k === 'src' && /^(https?:|data:image\/(png|jpe?g|gif|webp))/i.test(a.value);
        if (!span && !src) c.removeAttribute(a.name);
      });
      if (tg === 'IMG' && !c.getAttribute('src')) c.remove();
    });
  })(b);
  return b.innerHTML;
}

// ---- marshrut ----
function route() {
  var r = location.hash.slice(1) || 'login';
  if (r === 'exam') return exam();
  if (r === 'login' || r === 'register') { if (ME) return afterAuth(null); return authView(r); }
  if (!ME) return go('login');
  if (r === 't/home') return home();
  if (r.indexOf('t/m/') === 0) return editor(r.slice(4));
  go('t/home');
}
function afterAuth(r) {
  if (r) { O.setToken(r.token); ME = r.user; }
  if (ME.role === 'admin') { location.href = 'admin.html'; return; }
  go('t/home');
}
function logout() { O.call('auth.logout').catch(function () {}).then(function () { O.clear(); ME = null; go('login'); }); }
function gbtn(el) {
  if (!GID) { el.innerHTML = '<div class="note">Google orqali kirish uchun config.js ga GOOGLE_CLIENT_ID kiriting.</div>'; return; }
  function init() {
    google.accounts.id.initialize({ client_id: GID, callback: function (r) { call('auth.google', { credential: r.credential }).then(afterAuth).catch(function () {}); } });
    google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: 340, text: 'continue_with' });
  }
  if (window.google && window.google.accounts) return init();
  var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = init;
  s.onerror = function () { el.textContent = 'Google xizmati yuklanmadi'; }; document.head.appendChild(s);
}
function authView(mode) {
  var reg = mode === 'register';
  h('<div class="center"><div class="card narrow"><div class="logo">OZ<i>AQ</i></div><p class="mut">Mock testlar va chuqur analitika platformasi</p>' +
    '<div id="gb" style="min-height:44px;margin:6px 0"></div><div class="mut" style="text-align:center;margin:8px 0">yoki</div>' +
    '<form id="af" novalidate>' + (reg ? '<label>Ism va familiya</label><input id="nm" autocomplete="name">' : '') +
    '<label>' + (reg ? 'Email' : 'Login yoki email') + '</label><input id="lg" autocomplete="username" autocapitalize="off">' +
    '<label>Parol' + (reg ? ' (kamida 8 belgi)' : '') + '</label><input id="pw" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '">' +
    '<div class="err" id="er"></div><button class="btn w" id="ab" type="submit">' + (reg ? 'Ro’yxatdan o’tish' : 'Kirish') + '</button></form>' +
    '<p style="margin:14px 0 4px">' + (reg ? 'Akkauntingiz bormi? <a href="#login">Kirish</a>' : 'Akkaunt yo’qmi? <a href="#register">Ro’yxatdan o’tish</a>') + '</p>' +
    '<p style="margin:4px 0"><a href="#exam">O’quvchi: mock testga kirish →</a></p>' + (C.API_URL ? '' : '<div class="note">API_URL config.js da kiritilmagan.</div>') + '</div></div>');
  gbtn($('#gb'));
  $('#af').onsubmit = function (e) {
    e.preventDefault(); var lg = $('#lg').value.trim(), pw = $('#pw').value, er = $('#er'); er.textContent = '';
    if (!lg || !pw) { er.textContent = 'Barcha maydonlarni to’ldiring.'; return; }
    var b = $('#ab'), p;
    if (reg) {
      var nm = $('#nm').value.trim();
      if (!nm || !/^\S+@\S+\.\S+$/.test(lg) || pw.length < 8) { er.textContent = 'Ism, to’g’ri email va kamida 8 belgili parol kiriting.'; return; }
      p = O.call('auth.register', { name: nm, email: lg, password: pw });
    } else p = O.call('auth.login', { login: lg, password: pw });
    b.disabled = true;
    p.then(function (r) { b.disabled = false; afterAuth(r); }).catch(function (x) { b.disabled = false; er.textContent = x.message; });
  };
}
function shell(inner) {
  h('<header class="bar"><span class="logo">OZ<i>AQ</i></span><span class="sp"></span><span class="mut">' + esc(ME.name) + '</span><span class="pill">' + (ME.plan === 'premium' ? 'Premium' : 'Freemium') + '</span><button class="btn s" id="lo">Chiqish</button></header><main class="wrap">' + inner + '</main>');
  $('#lo').onclick = logout;
}

// ---- o'qituvchi: bosh sahifa ----
function home() {
  call('mock.list').then(function (L) {
    var act = L.filter(function (m) { return m.status === 'active'; }).length, st = 0, sb = 0; L.forEach(function (m) { st += m.students; sb += m.submitted; });
    shell('<div class="row"><h2 style="margin:0">Mock testlar</h2><span class="sp"></span><button class="btn" id="nw">+ Yangi mock</button></div><br>' +
      '<div class="kpis"><div class="card"><span class="mut">Jami testlar</span><b>' + L.length + '</b></div><div class="card"><span class="mut">Faol</span><b>' + act + '</b></div><div class="card"><span class="mut">O’quvchilar</span><b>' + st + '</b></div><div class="card"><span class="mut">Topshirganlar</span><b>' + sb + '</b></div></div>' +
      '<div class="card"><table><thead><tr><th>Nomi</th><th>Holat</th><th>O’quvchi</th><th>Topshirgan</th><th></th></tr></thead><tbody>' +
      (L.length ? L.map(function (m) { return '<tr><td><b>' + esc(m.title) + '</b></td><td><span class="badge b-' + esc(m.status) + '">' + esc(ST[m.status]) + '</span></td><td>' + m.students + '</td><td>' + m.submitted + '</td><td><a href="#t/m/' + esc(m.id) + '">Ochish</a></td></tr>'; }).join('') : '<tr><td colspan="5" class="mut">Hali test yo’q. “Yangi mock” tugmasini bosing.</td></tr>') + '</tbody></table></div>');
    $('#nw').onclick = function () { call('mock.save', { title: 'Yangi mock', settings: { duration: 45, showResult: 'instant' }, doc: { html: '' }, questions: [] }).then(function (r) { go('t/m/' + r.id); }).catch(function () {}); };
  }).catch(function () { go('login'); });
}

// ---- muharrir ----
var M, RO, TAB = 'q';
function editor(id) {
  call('mock.get', { id: id }).then(function (m) {
    M = m; RO = m.status === 'active' || m.status === 'closed'; TAB = 'q';
    M.settings = Object.assign({ duration: 45, showResult: 'instant', shuffleQ: false, shuffleO: false, partial: false }, m.settings || {});
    drawEd();
  }).catch(function () { go('t/home'); });
}
function drawEd() {
  var n = NX[M.status];
  shell('<div class="row"><a href="#t/home">← Testlar</a><input id="ti" class="ti" value="' + esc(M.title) + '"' + (RO ? ' disabled' : '') + '><span class="badge b-' + esc(M.status) + '">' + esc(ST[M.status]) + '</span><span class="sp"></span>' +
    (RO ? '' : '<button class="btn s" id="sv">Saqlash</button>') + '<button class="btn" id="ac">' + n[1] + '</button></div>' +
    '<div class="tabs"><button data-t="q">Test</button><button data-t="s">O’quvchilar va kirish</button><button data-t="r">Natijalar</button></div><div id="tab"></div>');
  $('#ac').onclick = function () { (RO ? Promise.resolve() : save()).then(function () { return call('mock.setStatus', { id: M.id, status: n[0] }); }).then(function () { editor(M.id); }).catch(function () {}); };
  if ($('#sv')) $('#sv').onclick = function () { save().catch(function () {}); };
  tab(TAB);
}
function tab(t) {
  if (TAB === 'q' && $('#doc')) collect();
  TAB = t; $$('.tabs button').forEach(function (b) { b.className = b.getAttribute('data-t') === t ? 'on' : ''; });
  if (t === 'q') tabQ(); else if (t === 's') tabS(); else tabR();
}
function tabQ() {
  var S = M.settings, d = RO ? ' disabled' : '';
  $('#tab').innerHTML = (RO ? '<div class="note">Faol yoki yopilgan testni tahrirlab bo’lmaydi (natijalar buzilmasligi uchun).</div>' : '') +
    (RO ? '' : '<div class="tool">' + [['bold', '<b>B</b>'], ['italic', '<i>I</i>'], ['underline', '<u>U</u>'], ['h2', 'Sarlavha'], ['ul', '• Ro’yxat'], ['tbl', '▦ Jadval'], ['ar', '+ Qator'], ['dr', '− Qator'], ['ac', '+ Ustun'], ['dc', '− Ustun'], ['dt', 'Jadvalni o’chirish']].map(function (b) { return '<button type="button" class="btn s" data-c="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div>') +
    '<div class="paper rt" id="doc" contenteditable="' + (!RO) + '">' + clean(M.doc && M.doc.html) + '</div><div id="qs"></div>' +
    (RO ? '' : '<div class="row" style="margin-bottom:14px">' + Object.keys(TL).map(function (k) { return '<button class="btn s" data-add="' + k + '">+ ' + TL[k] + '</button>'; }).join('') + '</div>') +
    '<div class="card"><h3>Test sozlamalari</h3><div class="row"><div><label>Davomiyligi (daqiqa)</label><input id="s_dur" type="number" min="1" class="num" value="' + (+S.duration || 45) + '"' + d + '></div>' +
    '<div><label>Natijani ko’rsatish</label><select id="s_show"' + d + '><option value="instant"' + (S.showResult === 'instant' ? ' selected' : '') + '>Topshirgach darhol</option><option value="never"' + (S.showResult !== 'instant' ? ' selected' : '') + '>Ko’rsatmaslik</option></select></div></div>' +
    '<label class="row"><input type="checkbox" id="s_sq"' + (S.shuffleQ ? ' checked' : '') + d + '> Savollarni aralashtirish</label><label class="row"><input type="checkbox" id="s_so"' + (S.shuffleO ? ' checked' : '') + d + '> Variantlarni aralashtirish</label>' +
    '<label class="row"><input type="checkbox" id="s_pa"' + (S.partial ? ' checked' : '') + d + '> Ko’p variantli savolda qisman ball</label></div>';
  drawQs();
}
function qcard(q, i) {
  var t = q.type, d = RO ? ' disabled' : '', o = '';
  if (t === 'short') o = '<label>Qabul qilinadigan javoblar (vergul bilan)</label><input class="q-acc" value="' + esc((q.accept || []).join(', ')) + '"' + d + '>';
  else {
    if (t === 'tf' && !(q.options && q.options.length)) q.options = [{ id: 't', text: 'To’g’ri' }, { id: 'f', text: 'Noto’g’ri' }];
    o = (q.options || []).map(function (x) {
      var on = (q.correct || []).indexOf(x.id) > -1;
      return '<div class="opt" data-id="' + esc(x.id) + '" data-label="' + esc(x.text) + '"><input class="o-ok" type="' + (t === 'multi' ? 'checkbox' : 'radio') + '" name="c' + i + '"' + (on ? ' checked' : '') + d + ' title="To’g’ri javob">' +
        (t === 'tf' ? '<span>' + esc(x.text) + '</span>' : '<input class="o-text" value="' + esc(x.text) + '" placeholder="Variant matni"' + d + '>' + (RO ? '' : '<button type="button" class="btn s" data-rm="1">×</button>')) + '</div>';
    }).join('') + ((t === 'tf' || RO) ? '' : '<button type="button" class="btn s" data-ao="' + i + '">+ Variant</button>');
  }
  return '<div class="card qc" data-t="' + t + '" data-id="' + esc(q.id) + '"><div class="row"><b>' + (i + 1) + '-savol</b><span class="mut">' + TL[t] + '</span><span class="sp"></span>Ball <input class="q-pts num" type="number" min="1" value="' + (q.points || 1) + '"' + d + '> Mavzu <input class="q-top" style="width:150px" value="' + esc(q.topic || '') + '" placeholder="majburiy"' + d + '>' +
    (RO ? '' : '<button type="button" class="btn s" data-mv="' + i + ':-1">↑</button><button type="button" class="btn s" data-mv="' + i + ':1">↓</button><button type="button" class="btn s" data-dq="' + i + '">O’chirish</button>') +
    '</div><div class="rt q-text" contenteditable="' + (!RO) + '">' + clean(q.text) + '</div>' + o + '</div>';
}
function drawQs() { $('#qs').innerHTML = M.questions.length ? M.questions.map(qcard).join('') : '<div class="card mut">Hali savol yo’q. Pastdagi tugmalar bilan savol qo’shing.</div>'; }
function collect() {
  if (RO || !$('#doc')) return;
  M.title = $('#ti').value.trim() || 'Nomsiz test'; M.doc = { html: clean($('#doc').innerHTML) };
  var S = M.settings; S.duration = +$('#s_dur').value || 45; S.showResult = $('#s_show').value; S.shuffleQ = $('#s_sq').checked; S.shuffleO = $('#s_so').checked; S.partial = $('#s_pa').checked;
  M.questions = $$('.qc').map(function (c) {
    var t = c.dataset.t, q = { id: c.dataset.id, type: t, text: clean($('.q-text', c).innerHTML), points: +$('.q-pts', c).value || 1, topic: $('.q-top', c).value.trim(), options: [], correct: [], accept: [] };
    if (t === 'short') q.accept = $('.q-acc', c).value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    else $$('.opt', c).forEach(function (o) {
      q.options.push({ id: o.dataset.id, text: t === 'tf' ? o.dataset.label : $('.o-text', o).value.trim() });
      if ($('.o-ok', o).checked) q.correct.push(o.dataset.id);
    });
    return q;
  });
}
function save() {
  collect();
  return call('mock.save', { id: M.id, title: M.title, subject: '', settings: M.settings, doc: M.doc, questions: M.questions }).then(function (r) { toast('Saqlandi'); return r; });
}
function cell() { var s = window.getSelection(), n = s && s.anchorNode; n = n && (n.nodeType === 1 ? n : n.parentNode); return n && n.closest && n.closest('td,th'); }
function tool(c) {
  var ex = function (a, v) { if (document.execCommand) document.execCommand(a, false, v || null); };
  if (c === 'bold' || c === 'italic' || c === 'underline') return ex(c);
  if (c === 'h2') return ex('formatBlock', 'h2');
  if (c === 'ul') return ex('insertUnorderedList');
  if (c === 'tbl') {
    var m = (prompt('Jadval o’lchami (qator x ustun)', '3x3') || '').match(/(\d+)\s*[x×*]\s*(\d+)/); if (!m) return;
    var r = Math.min(+m[1], 20), k = Math.min(+m[2], 10), t = '<table>'; for (var i = 0; i < r; i++) { t += '<tr>'; for (var j = 0; j < k; j++) t += '<td><br></td>'; t += '</tr>'; }
    return ex('insertHTML', t + '</table><p><br></p>');
  }
  var td = cell(); if (!td) { toast('Avval jadval katagiga bosing', 1); return; }
  var tr = td.parentNode, tb = td.closest('table'), ci = Array.prototype.indexOf.call(tr.children, td);
  if (c === 'ar') { var n = tr.cloneNode(true); $$('td,th', n).forEach(function (x) { x.innerHTML = '<br>'; }); tr.after(n); }
  if (c === 'dr' && tb.rows.length > 1) tr.remove();
  if (c === 'ac') $$('tr', tb).forEach(function (r) { var x = document.createElement('td'); x.innerHTML = '<br>'; if (r.children[ci]) r.children[ci].after(x); else r.appendChild(x); });
  if (c === 'dc' && tr.children.length > 1) $$('tr', tb).forEach(function (r) { if (r.children[ci]) r.children[ci].remove(); });
  if (c === 'dt') tb.remove();
}
document.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.tool button')) e.preventDefault(); });
document.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('button'); if (!t || !$('#tab')) return;
  if (t.dataset.t) return tab(t.dataset.t);
  if (t.dataset.c) return tool(t.dataset.c);
  if (t.hasAttribute('data-rm')) return t.closest('.opt').remove();
  if (!$('#qs')) return;
  if (t.dataset.add) { collect(); var k = t.dataset.add, last = M.questions.length ? M.questions[M.questions.length - 1].topic : '';
    M.questions.push({ id: 'q' + nid(), type: k, text: '', topic: last || '', points: 1, correct: [], accept: [], options: (k === 'single' || k === 'multi') ? [{ id: nid(), text: '' }, { id: nid(), text: '' }] : [] }); return drawQs(); }
  if (t.dataset.ao) { collect(); M.questions[+t.dataset.ao].options.push({ id: nid(), text: '' }); return drawQs(); }
  if (t.dataset.dq) { collect(); M.questions.splice(+t.dataset.dq, 1); return drawQs(); }
  if (t.dataset.mv) { collect(); var p = t.dataset.mv.split(':'), i = +p[0], j = i + +p[1]; if (j < 0 || j >= M.questions.length) return; var x = M.questions[i]; M.questions[i] = M.questions[j]; M.questions[j] = x; drawQs(); }
});

// ---- o'quvchilar va kirish ----
function tabS() {
  $('#tab').innerHTML = '<div class="card"><h3>O’quvchi qo’shish</h3><p class="mut" style="margin-top:0">Har qatorga bitta ism-familiya yozing. Tizim har biriga login va parol yaratadi.</p><textarea id="nm" placeholder="Aliyev Vali&#10;Karimova Sevara"></textarea><br><br><button class="btn" id="ad">Login va parol yaratish</button></div><div id="cr"></div>' +
    '<div class="card"><h3>Testga kirish havolasi</h3><div class="row"><code id="lk">' + esc(location.origin + location.pathname + '#exam') + '</code><button class="btn s" id="cl">Nusxalash</button></div><p class="mut">O’quvchilar shu havolaga kirib, o’z login va parolini kiritadi. Test <b>Faol</b> holatda bo’lishi kerak.</p></div>' +
    '<div class="card"><h3>O’quvchilar ro’yxati</h3><div id="sl" class="mut">Yuklanmoqda…</div></div>';
  $('#cl').onclick = function () { copy($('#lk').textContent); };
  $('#ad').onclick = function () {
    var names = $('#nm').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); if (!names.length) return toast('Kamida bitta ism yozing', 1);
    call('mock.addStudents', { mockId: M.id, names: names }).then(function (L) {
      $('#nm').value = '';
      $('#cr').innerHTML = '<div class="card" style="border-color:var(--pri)"><h3>Kirish ma’lumotlari</h3><div class="note">Parollar faqat hozir ko’rinadi. Nusxalang yoki yuklab oling.</div><table><thead><tr><th>Ism</th><th>Login</th><th>Parol</th></tr></thead><tbody>' +
        L.map(function (s) { return '<tr><td>' + esc(s.name) + '</td><td><code>' + esc(s.login) + '</code></td><td><code>' + esc(s.password) + '</code></td></tr>'; }).join('') + '</tbody></table><br><div class="row"><button class="btn s" id="cp">Nusxalash</button><button class="btn s" id="cv">CSV yuklab olish</button></div></div>';
      $('#cp').onclick = function () { copy(L.map(function (s) { return s.name + '\t' + s.login + '\t' + s.password; }).join('\n')); };
      $('#cv').onclick = function () { dl('mock-kirish.csv', 'Ism,Login,Parol\n' + L.map(function (s) { return '"' + s.name.replace(/"/g, '""') + '",' + s.login + ',' + s.password; }).join('\n')); };
      loadSt();
    }).catch(function () {});
  };
  loadSt();
}
function loadSt() {
  call('mock.students', { mockId: M.id }).then(function (L) {
    L = L.filter(function (s) { return s.state !== 'removed'; });
    $('#sl').innerHTML = L.length ? '<table><thead><tr><th>Ism</th><th>Login</th><th>Holat</th><th>Ball</th><th></th></tr></thead><tbody>' + L.map(function (s) {
      return '<tr><td>' + esc(s.name) + '</td><td><code>' + esc(s.login) + '</code></td><td>' + esc({ 'new': 'Kirmagan', solving: 'Yechmoqda', submitted: 'Topshirdi' }[s.state] || s.state) + '</td><td>' + (s.score == null ? '–' : s.score + '/' + s.maxScore) + '</td><td><button class="btn s" data-pw="' + esc(s.id) + '">Yangi parol</button></td></tr>';
    }).join('') + '</tbody></table>' : 'Hali o’quvchi qo’shilmagan.';
    $$('[data-pw]').forEach(function (b) { b.onclick = function () { call('mock.resetStudentPassword', { studentId: b.dataset.pw }).then(function (r) { $('#cr').innerHTML = '<div class="card" style="border-color:var(--pri)"><h3>Yangi parol</h3><p>Login: <code>' + esc(r.login) + '</code> &nbsp; Parol: <code>' + esc(r.password) + '</code></p></div>'; }).catch(function () {}); }; });
  }).catch(function () {});
}

// ---- natijalar ----
function tabR() {
  $('#tab').innerHTML = '<div class="mut">Yuklanmoqda…</div>';
  call('analytics.mock', { mockId: M.id }).then(function (a) {
    if (!a.submitted) { $('#tab').innerHTML = '<div class="card mut">Hali hech kim topshirmagan.</div>'; return; }
    var mx = Math.max.apply(null, a.histogram) || 1;
    $('#tab').innerHTML = '<div class="kpis"><div class="card"><span class="mut">Topshirganlar</span><b>' + a.submitted + '</b></div><div class="card"><span class="mut">O’rtacha</span><b>' + a.avg + '%</b></div><div class="card"><span class="mut">Median</span><b>' + a.median + '%</b></div></div>' +
      '<div class="card"><h3>Ballar taqsimoti</h3><div class="hist">' + a.histogram.map(function (n) { return '<div class="hb" style="height:' + (n ? Math.max(8, n / mx * 100) : 2) + '%"><span>' + n + '</span></div>'; }).join('') + '</div><div class="hl">' + a.histogram.map(function (_, i) { return '<span>' + i * 10 + '–' + (i + 1) * 10 + '</span>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>Eng qiyin savollar (TOP-5)</h3><table><thead><tr><th>№</th><th>Mavzu</th><th>To’g’ri javob</th><th>O’rtacha vaqt</th></tr></thead><tbody>' + a.hardest.map(function (q) { return '<tr><td>' + q.n + '</td><td>' + esc(q.topic) + '</td><td>' + q.correctRate + '%</td><td>' + q.avgSec + ' s</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="card"><h3>Mavzular bo’yicha</h3><table><tbody>' + a.topics.map(function (t) { return '<tr><td>' + esc(t.topic) + '</td><td>' + t.avgRate + '%</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="card"><h3>O’quvchilar</h3><table><thead><tr><th>Ism</th><th>Ball</th><th>Toifa</th></tr></thead><tbody>' + a.people.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td>' + p.percent + '%</td><td>' + esc(BAND[p.band]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }).catch(function () { $('#tab').innerHTML = ''; });
}

// ---- o'quvchi imtihoni ----
var X = null, TI = null;
function sc(p) { return O.call(p[0], p[1], 1); }
function exam() {
  if (TI) clearInterval(TI);
  if (O.getToken(1)) return startExam(true);
  examLogin();
}
function examLogin() {
  h('<div class="center"><div class="card narrow"><div class="logo">OZ<i>AQ</i></div><p class="mut">Mock testga kirish</p><form id="ef" novalidate><label>Login</label><input id="el" autocapitalize="off" autocomplete="username"><label>Parol</label><input id="ep" type="password" autocomplete="current-password"><div class="err" id="ee"></div><button class="btn w" id="eb" type="submit">Kirish</button></form><p style="margin-top:14px"><a href="#login">O’qituvchi kirishi</a></p></div></div>');
  $('#ef').onsubmit = function (e) {
    e.preventDefault(); var l = $('#el').value.trim(), p = $('#ep').value; if (!l || !p) { $('#ee').textContent = 'Login va parolni kiriting.'; return; }
    $('#eb').disabled = true;
    O.call('exam.login', { login: l, password: p }).then(function (r) { O.setToken(r.token, 1); brief(r); }).catch(function (x) { $('#eb').disabled = false; $('#ee').textContent = x.message; });
  };
}
function brief(r) {
  h('<div class="center"><div class="card narrow"><div class="logo">OZ<i>AQ</i></div><h2 style="margin:10px 0 4px">' + esc(r.exam.title) + '</h2><p class="mut">Salom, ' + esc(r.student.name) + '!</p><p>Savollar: <b>' + r.exam.questions + '</b><br>Vaqt: <b>' + r.exam.duration + ' daqiqa</b></p><p class="mut">“Boshlash” bosilgach vaqt ketadi. Javoblar avtomatik saqlanadi; sahifa yangilansa, qolgan joyingizdan davom etasiz.</p><button class="btn w" id="go">Testni boshlash</button></div></div>');
  $('#go').onclick = function () { startExam(false); };
}
function startExam(quiet) {
  O.call('exam.start', {}, 1).then(function (d) {
    X = { qs: d.questions, ans: d.answers || {}, end: Date.now() + d.timeLeftSec * 1000, i: 0, doc: clean(d.doc && d.doc.html), dirty: {}, ms: {}, t0: Date.now(), busy: false };
    drawExam();
  }).catch(function (e) { if (!quiet) toast(e.message, 1); if (/topshirilgan|tugadi|faol emas/i.test(e.message)) { O.clear(1); } examLogin(); if (!quiet) $('#ee').textContent = e.message; });
}
function drawExam() {
  h('<header class="bar"><span class="logo">OZ<i>AQ</i></span><span class="sp"></span><span class="timer" id="tm"></span><button class="btn" id="fin">Topshirish</button></header><div class="exb"><aside id="nv"></aside><section id="qv"></section></div>');
  $('#fin').onclick = function () { var un = X.qs.filter(function (q) { return !has(q.id); }).length; if (confirm(un ? 'Javobsiz savollar: ' + un + '. Baribir topshirasizmi?' : 'Testni topshirasizmi?')) submit(); };
  showQ(0); tm(); TI = setInterval(tm, 1000);
}
function has(id) { var a = X.ans[id]; return !(a === undefined || a === null || a === '' || (Array.isArray(a) && !a.length)); }
function tm() {
  var s = Math.max(0, Math.round((X.end - Date.now()) / 1000)), e = $('#tm'); if (!e) return;
  e.textContent = Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); e.className = 'timer' + (s < 300 ? ' low' : '');
  if (s % 10 === 0 && s) flush(); if (!s) submit(true);
}
function tally() { var q = X.qs[X.i]; if (q) X.ms[q.id] = (X.ms[q.id] || 0) + (Date.now() - X.t0); X.t0 = Date.now(); }
function items() { var ids = {}; Object.keys(X.dirty).concat(Object.keys(X.ms)).forEach(function (k) { ids[k] = 1; }); return Object.keys(ids).map(function (id) { return { qid: id, answer: X.ans[id], ms: X.ms[id] || 0 }; }); }
function flush() {
  tally(); var it = items(); if (!it.length || X.busy) return Promise.resolve(); var d = X.dirty, m = X.ms; X.dirty = {}; X.ms = {}; X.busy = true;
  return O.call('exam.save', { items: it }, 1).then(function () { X.busy = false; }).catch(function (e) {
    X.busy = false; Object.keys(d).forEach(function (k) { X.dirty[k] = 1; }); Object.keys(m).forEach(function (k) { X.ms[k] = (X.ms[k] || 0) + m[k]; });
    if (/tugadi|yopilgan/i.test(e.message)) submit(true);
  });
}
function showQ(i) {
  tally(); X.i = i; var q = X.qs[i], a = X.ans[q.id], b = '';
  if (q.type === 'single' || q.type === 'tf') b = q.options.map(function (o) { return '<label class="ch"><input type="radio" name="a" value="' + esc(o.id) + '"' + (a === o.id ? ' checked' : '') + '> ' + esc(o.text) + '</label>'; }).join('');
  else if (q.type === 'multi') b = q.options.map(function (o) { return '<label class="ch"><input type="checkbox" name="a" value="' + esc(o.id) + '"' + ((a || []).indexOf(o.id) > -1 ? ' checked' : '') + '> ' + esc(o.text) + '</label>'; }).join('');
  else b = '<input id="sa" value="' + esc(a || '') + '" placeholder="Javobingizni yozing" autocomplete="off">';
  var doc = X.doc && X.doc.replace(/<[^>]*>/g, '').trim() || /<(table|img)/i.test(X.doc || '') ? '<details class="doc" open><summary>Test materiallari</summary><div class="paper rt" style="padding:20px;margin:0">' + X.doc + '</div></details>' : '';
  $('#qv').innerHTML = doc + '<div class="card"><div class="mut">' + (i + 1) + ' / ' + X.qs.length + ' · ' + q.points + ' ball</div><div class="qt rt">' + clean(q.text) + '</div>' + b + '</div><div class="row"><button class="btn s" id="pv"' + (i ? '' : ' disabled') + '>← Oldingi</button><button class="btn s" id="nx"' + (i < X.qs.length - 1 ? '' : ' disabled') + '>Keyingi →</button></div>';
  $('#pv').onclick = function () { flush(); showQ(i - 1); }; $('#nx').onclick = function () { flush(); showQ(i + 1); };
  $('#qv').oninput = $('#qv').onchange = function () {
    if (q.type === 'multi') X.ans[q.id] = $$('input[name=a]:checked', $('#qv')).map(function (x) { return x.value; });
    else if (q.type === 'short') X.ans[q.id] = $('#sa').value; else { var c = $('input[name=a]:checked', $('#qv')); X.ans[q.id] = c ? c.value : undefined; }
    X.dirty[q.id] = 1; nav();
  };
  nav();
}
function nav() { $('#nv').innerHTML = X.qs.map(function (q, i) { return '<button data-i="' + i + '" class="' + (has(q.id) ? 'done ' : '') + (i === X.i ? 'cur' : '') + '">' + (i + 1) + '</button>'; }).join(''); $$('#nv button').forEach(function (b) { b.onclick = function () { flush(); showQ(+b.dataset.i); }; }); }
function submit(auto) {
  if (X.sending) return; X.sending = true; clearInterval(TI); tally();
  O.call('exam.submit', { items: items() }, 1).then(function (r) {
    O.clear(1);
    h('<div class="center"><div class="card narrow" style="text-align:center"><div class="logo">OZ<i>AQ</i></div><h2>' + (auto ? 'Vaqt tugadi' : 'Javoblaringiz qabul qilindi') + '</h2>' +
      (r.shown ? '<p>Natija: <b style="font-size:28px" id="res">' + r.percent + '%</b><br><span class="mut">' + r.score + ' / ' + r.maxScore + ' ball</span></p>' : '<p class="mut">Natijani o’qituvchingiz e’lon qiladi.</p>') + '<a href="#exam">Boshqa login bilan kirish</a></div></div>');
  }).catch(function (e) { X.sending = false; toast(e.message, 1); if (!auto) TI = setInterval(tm, 1000); });
}
document.addEventListener('visibilitychange', function () { if (document.hidden && X && location.hash === '#exam' && O.getToken(1)) O.call('exam.flag', { type: 'tab' }, 1).catch(function () {}); });
window.addEventListener('hashchange', route);
(function boot() { if (O.getToken()) O.call('auth.me').then(function (u) { ME = u; }).catch(function () { O.clear(); }).then(route); else route(); })();
})();
