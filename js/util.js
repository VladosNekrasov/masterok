window.U = (() => {
  // Иконки Phosphor (vendor/phosphor), имя в интерфейсе -> имя в наборе
  const ICONS = {
    search: 'magnifying-glass', star: 'star', pin: 'map-pin', phone: 'phone', heart: 'heart', check: 'check', shield: 'seal-check',
    user: 'user', users: 'users', menu: 'list', x: 'x', plus: 'plus', trash: 'trash', edit: 'pencil-simple', chart: 'chart-bar',
    crown: 'crown', zap: 'lightning', clock: 'clock', msg: 'chat-circle-text', logout: 'sign-out', eye: 'eye', sliders: 'sliders-horizontal',
    arrow: 'arrow-right', up: 'arrow-up-right', left: 'caret-left', right: 'caret-right', inbox: 'tray', wallet: 'wallet', grid: 'squares-four',
    list: 'list-bullets', moon: 'moon', sun: 'sun', download: 'download-simple', upload: 'upload-simple', send: 'paper-plane-tilt',
    image: 'image', tool: 'wrench', settings: 'gear-six', tag: 'tag', briefcase: 'briefcase', calendar: 'calendar-blank', home: 'house',
    quote: 'quotes', telegram: 'telegram-logo'
  };
  // cls 'on' / 'ic-star' / 'fill' -> заливка
  const icon = (n, cls = '') => {
    const fill = /\b(on|ic-star|fill)\b/.test(cls);
    return `<i class="${fill ? 'ph-fill' : 'ph'} ph-${ICONS[n] || n} ic ${cls}" aria-hidden="true"></i>`;
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = n => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
  const money = n => n == null ? '-' : num(n) + ' ₽';
  const date = ts => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateShort = ts => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const dateTime = ts => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  function ago(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return 'только что';
    if (s < 3600) return Math.floor(s / 60) + ' мин назад';
    if (s < 86400) return Math.floor(s / 3600) + ' ч назад';
    const d = Math.floor(s / 86400);
    if (d < 30) return d + ' ' + plural(d, 'день', 'дня', 'дней') + ' назад';
    return date(ts);
  }
  const uid = (p = 'id') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const initials = name => String(name || '?').trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  function phone(p) {
    const d = String(p || '').replace(/\D/g, '');
    if (d.length !== 11) return p || '';
    return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
  }
  const form = f => {
    const o = {};
    new FormData(f).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
    return o;
  };
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function parseHash() {
    const h = location.hash.slice(1) || '/';
    const [path, qs] = h.split('?');
    return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
  }
  function link(path, query) {
    const qs = new URLSearchParams(Object.entries(query || {}).filter(([, v]) => v !== '' && v != null && v !== false && v !== 0)).toString();
    return '#' + path + (qs ? '?' + qs : '');
  }

  // opt.action + opt.onAction: кнопка в тосте (например, «Отменить»)
  function toast(msg, type = 'ok', opt = {}) {
    const box = document.getElementById('toasts');
    if (!box) return;
    while (box.children.length > 2) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = icon(type === 'error' ? 'x' : type === 'info' ? 'info' : 'check') + `<span>${esc(msg)}</span>` + (opt.action ? `<button type="button" class="toast-act">${esc(opt.action)}</button>` : '');
    if (opt.action) el.querySelector('.toast-act').onclick = () => { el.remove(); opt.onAction && opt.onAction(); };
    box.appendChild(el);
    const ms = opt.ms || (opt.action ? 7000 : type === 'error' ? 4500 : 3200);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 400);
  }

  function modal({ title, body, wide, onMount, onClose }) {
    const ov = document.createElement('div');
    ov.className = 'modal-ov';
    ov.innerHTML = `<div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3 class="h3">${esc(title || '')}</h3><button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Закрыть">${icon('x')}</button></div>
      <div class="modal-body">${body}</div></div>`;
    const close = () => { if (!ov.isConnected) return; ov.remove(); onClose && onClose(); document.removeEventListener('keydown', onKey); if (!document.querySelector('.modal-ov')) document.body.classList.remove('modal-open'); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    document.body.classList.add('modal-open');
    window.UI && UI.enhance(ov);
    onMount && onMount(ov.querySelector('.modal'), close);
    const first = ov.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),textarea');
    first && innerWidth > 640 && setTimeout(() => first.focus(), 30);
    return close;
  }

  function confirm(text, ok = 'Да', danger = true) {
    return new Promise(res => {
      let done = false;
      modal({
        title: 'Подтвердите действие',
        body: `<p>${esc(text)}</p><div class="modal-actions"><button class="btn" data-close>Отмена</button><button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-ok>${esc(ok)}</button></div>`,
        onMount(el, close) { el.querySelector('[data-ok]').onclick = () => { done = true; close(); }; },
        onClose: () => res(done)
      });
    });
  }

  function resizeImage(file, max = 800, quality = 0.75) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onerror = rej;
      fr.onload = () => {
        const img = new Image();
        img.onerror = rej;
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', quality));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return { icon, esc, num, money, date, dateShort, dateTime, plural, ago, uid, initials, phone, form, debounce, parseHash, link, toast, modal, confirm, resizeImage, download };
})();
