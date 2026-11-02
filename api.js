// OZAQ API klienti: barcha ekranlar shu orqali Apps Script bilan gaplashadi.
(function () {
  var TK = 'ozaq_token';
  window.OZAQ = {
    setToken: function (t) { try { localStorage.setItem(TK, t); } catch (_) {} },
    getToken: function () { try { return localStorage.getItem(TK) || ''; } catch (_) { return ''; } },
    clear: function () { try { localStorage.removeItem(TK); } catch (_) {} },
    // Misol: await OZAQ.call('mock.list')  |  OZAQ.call('exam.save', {items:[{qid, answer, ms}]})
    call: function (action, data) {
      var url = (window.OZAQ_CONFIG || {}).API_URL;
      if (!url) return Promise.reject(new Error('API_URL config.js da kiritilmagan'));
      var body = Object.assign({ action: action, token: this.getToken() }, data || {});
      // text/plain: brauzer "preflight" so'rovini yubormaydi, Apps Script bilan shunday ishlash kerak
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j.ok) throw new Error(j.error || 'Xatolik'); return j.data; });
    }
  };
})();
