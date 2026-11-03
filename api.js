// OZAQ API klienti (Apps Script bilan gaplashadi). student=true bo'lsa o'quvchi sessiyasi alohida saqlanadi.
(function () {
  var K = function (s) { return s ? 'ozaq_stoken' : 'ozaq_token'; };
  window.OZAQ = {
    setToken: function (t, s) { try { localStorage.setItem(K(s), t); } catch (_) {} },
    getToken: function (s) { try { return localStorage.getItem(K(s)) || ''; } catch (_) { return ''; } },
    clear: function (s) { try { localStorage.removeItem(K(s)); } catch (_) {} },
    call: function (action, data, student) {
      var url = (window.OZAQ_CONFIG || {}).API_URL;
      if (!url) return Promise.reject(new Error('API_URL config.js da kiritilmagan'));
      var body = Object.assign({ action: action, token: this.getToken(student) }, data || {});
      // text/plain: brauzer preflight yubormaydi (Apps Script uchun shart)
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); }, function () { throw new Error('Serverga ulanib bo’lmadi. Internetni tekshiring.'); })
        .then(function (j) { if (!j.ok) throw new Error(j.error || 'Xatolik'); return j.data; });
    }
  };
})();
