window.App = (() => {
  const { esc, icon } = U;
  const routes = [
    [/^\/$/, 'home'], [/^\/catalog$/, 'catalog'], [/^\/m\/([\w-]+)$/, 'master'], [/^\/pricing$/, 'pricing'], [/^\/about$/, 'about'],
    [/^\/login$/, 'login'], [/^\/register$/, 'register'], [/^\/cabinet$/, 'cabinet'], [/^\/admin$/, 'admin']
  ];
  let lastKey = null, cleanup = null, ready = false, loadedAt = 0;

  function render() {
    if (!ready) return;
    UI.closePop();
    const me = Store.user();
    if (me && Store.isBanned(me)) { U.toast(Store.banText(me), 'error', { ms: 8000 }); Store.logout().then(render); return; }
    const { path, query } = U.parseHash();
    let page = null;
    for (const [re, name] of routes) {
      const mm = path.match(re);
      if (mm) { page = Pages[name](mm.slice(1), query); break; }
    }
    if (!page) page = Pages.notFound();
    if (page.redirect) return;
    document.title = page.title || Store.settings().siteName;
    document.body.classList.remove('nav-open');
    if (!document.querySelector('.modal-ov')) document.body.classList.remove('modal-open');
    const app = document.getElementById('app');
    app.innerHTML = C.header(path) + `<main id="main">${page.html}</main>` + C.footer();
    cleanup && cleanup();
    cleanup = (page.mount && page.mount()) || null;
    if (typeof cleanup !== 'function') cleanup = null;
    UI.enhance(app);
    FX.run(app);
    const key = path + '|' + (query.tab || '');
    if (key !== lastKey) window.scrollTo(0, 0);
    lastKey = key;
    if (Store.takeRecovery()) recoveryModal();
  }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function redirect(p) { location.replace('#' + p); return { redirect: true }; }

  // Экран вместо сайта: настройка не завершена или нет связи
  function screen(title, text, action = '') {
    document.getElementById('app').innerHTML = `<div class="boot"><div class="boot-card">${C.logoMark()}<h1 class="h2">${esc(title)}</h1><p class="muted">${text}</p>${action}</div></div>`;
  }

  function recoveryModal() {
    U.modal({
      title: 'Новый пароль',
      body: `<form id="rcForm"><p class="muted">Придумайте новый пароль для входа.</p><label class="fld"><span>Новый пароль, от 6 символов</span><input class="input" type="password" name="pw" required minlength="6" autocomplete="new-password"></label><button class="btn btn-primary btn-block">Сохранить пароль</button></form>`,
      onMount(el, close) {
        el.querySelector('#rcForm').addEventListener('submit', async e => {
          e.preventDefault();
          const pw = e.target.pw.value;
          if (pw.length < 6) return U.toast('Пароль должен быть не короче 6 символов', 'error');
          const r = await Store.setPassword(pw);
          if (r.error) return U.toast(r.error, 'error');
          close(); U.toast('Пароль изменён');
        });
      }
    });
  }

  // Тестовый режим: метка в углу и сброс базы
  function testBadge() {
    const b = document.createElement('button');
    b.className = 'test-badge'; b.type = 'button';
    b.innerHTML = `${icon('flask', 'fill')}<span>Тестовый режим</span>`;
    b.onclick = () => U.modal({
      title: 'Тестовый режим',
      body: `<p>Сайт работает на локальной базе данных прямо в этом браузере. Правила доступа те же, что будут на сервере.</p>
        <ul class="ul"><li>Подтверждения по почте нет, регистрация мгновенная.</li><li>Первый зарегистрированный аккаунт становится владельцем.</li><li>Данные видны только в этом браузере на этом устройстве.</li><li>Чтобы подключить настоящий сервер, впишите ключи Supabase в <code>js/config.js</code>.</li></ul>
        <div class="modal-actions"><button class="btn" data-close>Закрыть</button><button class="btn btn-danger-solid" id="wipe">${icon('trash')} Стереть тестовую базу</button></div>`,
      onMount(el) {
        el.querySelector('#wipe').onclick = async () => {
          if (!(await U.confirm('Удалить всех пользователей, мастеров и отзывы из тестовой базы?', 'Стереть'))) return;
          await LocalDB.wipe(); location.hash = '#/'; location.reload();
        };
      }
    });
    document.body.appendChild(b);
  }

  function notifPanel(el) {
    if (UI.isOpen(el)) return UI.closePop();
    const list = Store.myNotifs().slice(0, 40);
    UI.pop(el, {
      cls: 'nt-pop', align: 'right', width: 380, title: 'Уведомления',
      html: `<div class="nt-head"><b>Уведомления</b>${list.some(n => !n.read) ? '<button type="button" class="link sm" data-readall>Прочитать все</button>' : ''}</div>
        <div class="nt-list">${list.length ? list.map(n => `<button type="button" class="nt ${n.read ? '' : 'unread'}" data-id="${n.id}" data-link="${esc(n.link || '')}"><span class="nt-ic">${icon('bell', 'fill')}</span><span class="nt-body"><span class="nt-txt">${esc(n.text)}</span><small>${U.ago(n.date)}</small></span></button>`).join('') : `<div class="nt-empty">${icon('bell')}<span>Здесь будут ответы мастеров, статусы заявок и решения модераторов</span></div>`}</div>`,
      onMount(p, close) {
        p.addEventListener('click', e => {
          if (e.target.closest('[data-readall]')) { Store.readNotifs(); close(); render(); return; }
          const n = e.target.closest('.nt');
          if (!n) return;
          Store.readNotifs(n.dataset.id);
          close();
          if (n.dataset.link) go('#' + n.dataset.link); else render();
        });
      }
    });
  }

  async function refresh() {
    try { await Store.reload(); loadedAt = Date.now(); render(); } catch (e) { /* оставляем старые данные */ }
  }

  const Actions = {
    fav(el) {
      const r = Store.toggleFav(el.dataset.id);
      if (r === null) { U.toast('Войдите, чтобы сохранять мастеров в избранное', 'info', { action: 'Войти', onAction: () => go(U.link('/login', { next: location.hash.slice(1) || '/' })) }); return; }
      document.querySelectorAll(`[data-act="fav"][data-id="${el.dataset.id}"]`).forEach(b => b.classList.toggle('on', r));
      U.toast(r ? 'Добавлено в избранное' : 'Удалено из избранного');
    },
    notif: notifPanel,
    async logout() { await Store.logout(); U.toast('Вы вышли из аккаунта', 'info'); go('#/'); },
    theme() {
      const root = document.documentElement;
      const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('masterok_theme', root.dataset.theme); } catch (e) {}
    },
    burger() { document.body.classList.toggle('nav-open'); },
    'toggle-filters'() {
      const box = document.getElementById('filtersBox');
      if (!box) return;
      const open = box.classList.toggle('open');
      document.body.classList.toggle('modal-open', open);
    },
    'reset-filters'() { go('#/catalog'); }
  };

  async function init() {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el || !Actions[el.dataset.act]) return;
      e.preventDefault();
      e.stopPropagation();
      Actions[el.dataset.act](el, e);
    });
    document.addEventListener('pointerdown', e => {
      if (document.body.classList.contains('nav-open') && !e.target.closest('.nav, .burger')) document.body.classList.remove('nav-open');
    });
    if (!Store.configured()) document.querySelector('.boot').insertAdjacentHTML('beforeend', '<p class="muted sm boot-note">Запускаем тестовую базу данных…</p>');
    const fromEmail = /[?&]code=/.test(location.search);
    try {
      await Store.init(() => render());
    } catch (e) {
      return screen('Нет связи с сервером', 'Не удалось загрузить данные. Проверьте интернет и обновите страницу.', `<button class="btn btn-primary" onclick="location.reload()">${icon('arrow-counter-clockwise')} Обновить</button>`);
    }
    ready = true; loadedAt = Date.now();
    if (Store.isLocal()) testBadge();
    if (fromEmail) { history.replaceState(null, '', location.pathname + (location.hash || '#/')); if (Store.user()) U.toast('Email подтверждён, вы вошли в аккаунт'); }
    window.addEventListener('hashchange', render);
    // Возвращение на вкладку: подтягиваем свежие данные, если прошло больше минуты
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt > 60000 && !document.querySelector('.modal-ov') && !document.activeElement?.matches('input, textarea')) refresh();
    });
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { render, go, redirect, refresh };
})();
