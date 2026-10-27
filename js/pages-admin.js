// Панель управления: владелец видит всё, модератор - только модерацию
(() => {
  const { esc, icon, money, plural, link } = U;
  const P = window.Pages = window.Pages || {};
  const DAY = 864e5;

  // [вкладка, название, иконка, право]
  const TABS = [
    ['overview', 'Обзор', 'chart', 'finance'],
    ['queue', 'Очередь', 'tray', 'moderate'],
    ['reports', 'Жалобы', 'flag', 'reports'],
    ['masters', 'Мастера', 'wrench', 'moderate'],
    ['reviews', 'Отзывы', 'star', 'moderate'],
    ['users', 'Пользователи', 'users', 'users'],
    ['requests', 'Заявки', 'chat-circle-text', 'requests'],
    ['payments', 'Продвижение', 'crown', 'finance'],
    ['categories', 'Категории', 'squares-four', 'settings'],
    ['log', 'Журнал', 'clock-counter-clockwise', 'log'],
    ['settings', 'Настройки', 'gear-six', 'settings'],
    ['account', 'Аккаунт', 'user', null]
  ];

  P.admin = (p, q) => {
    const u = Store.user();
    if (!u) return App.redirect('/login?next=/admin');
    if (!Store.isStaff(u)) return P.notFound();
    const qu = Store.queue();
    const badges = { queue: qu.masters + qu.reviews, reports: qu.reports };
    const tabs = TABS.filter(t => !t[3] || Store.can(t[3])).map(t => [t[0], t[1], t[2], badges[t[0]]]);
    const def = Store.can('finance') ? 'overview' : 'queue';
    const tab = tabs.some(t => t[0] === q.tab) ? q.tab : def;
    const t = tab === 'account' ? P.account(u) : T[tab](q, u);
    return { title: u.role === 'owner' ? 'Управление' : 'Модерация', html: C.dash('/admin', tabs, tab, u.role === 'owner' ? 'Управление' : 'Модерация', t.html), mount: t.mount };
  };

  const masterName = id => { const m = Store.master(id); return m ? `<a class="link" href="#/m/${m.id}">${esc(m.name)}</a>` : '<span class="muted">удалён</span>'; };
  const userName = id => { const x = Store.userById(id); return x ? esc(x.name) : '<span class="muted">удалён</span>'; };
  const chips = (tab, cur, opts, extra = {}) => `<div class="chips chips-f">${opts.map(([v, l, n]) => `<a class="chip ${cur === v ? 'on' : ''}" href="${link('/admin', { tab, ...extra, f: v === 'all' ? '' : v })}">${l}${n != null ? ` <b>${n}</b>` : ''}</a>`).join('')}</div>`;
  const searchBox = (tab, q, ph) => `<div class="input-ic mb"><i class="ph ph-magnifying-glass ic"></i><input class="input" type="search" id="aSearch" data-tab="${tab}" placeholder="${esc(ph)}" value="${esc(q.s || '')}" autocomplete="off"></div>`;
  // Делегирование кликов: [data-a] - действия, [data-menu] - меню строки
  const bind = (handlers, menus) => () => {
    const main = document.querySelector('.dash-main');
    main.addEventListener('click', async e => {
      const m = e.target.closest('[data-menu]');
      if (m && menus) return UI.menu(m, menus(m.dataset.menu));
      const b = e.target.closest('[data-a]');
      if (b && handlers[b.dataset.a]) await handlers[b.dataset.a](b.dataset.id, b);
    });
    const s = document.getElementById('aSearch');
    if (s) s.addEventListener('input', U.debounce(() => {
      const { query } = U.parseHash();
      history.replaceState(null, '', link('/admin', { ...query, s: s.value.trim() }));
      App.render();
      const i = document.getElementById('aSearch');
      i.focus(); i.setSelectionRange(i.value.length, i.value.length);
    }, 300));
  };
  const has = (q, ...parts) => !q.s || parts.join(' ').toLowerCase().includes(q.s.toLowerCase());

  // ================= Общие действия модерации (используются и на странице мастера)
  const R_REJECT = ['Мало информации о себе', 'Нет цен на услуги', 'Контакты в тексте описания', 'Фото не соответствует требованиям', 'Подозрение на фейковую анкету'];
  const R_BLOCK = ['Мошенничество', 'Многочисленные жалобы клиентов', 'Накрутка отзывов', 'Оскорбления', 'Нарушение правил сервиса'];
  const R_HIDE = ['Оскорбления', 'Спам или реклама', 'Отзыв не о мастере', 'Ложная информация', 'Персональные данные'];
  const Mod = P.mod = {
    approve(id) { Store.setMasterStatus(id, 'approved'); U.toast('Анкета опубликована'); App.render(); },
    async reject(id) {
      const r = await UI.ask({ title: 'Отклонить анкету', text: 'Мастер увидит причину в кабинете и сможет исправить анкету.', reasons: R_REJECT, ok: 'Отклонить' });
      if (r) { Store.setMasterStatus(id, 'rejected', r); U.toast('Анкета отклонена, мастер получил уведомление', 'info'); App.render(); }
    },
    async block(id) {
      const r = await UI.ask({ title: 'Заблокировать анкету', text: 'Анкета исчезнет из каталога. Мастер увидит причину.', reasons: R_BLOCK, ok: 'Заблокировать' });
      if (r) { Store.setMasterStatus(id, 'blocked', r); U.toast('Анкета заблокирована', 'info'); App.render(); return true; }
    },
    unblock(id) { Store.setMasterStatus(id, 'approved'); U.toast('Анкета снова в каталоге'); App.render(); },
    verify(id) { const m = Store.master(id); Store.setVerified(id, !m.verified); U.toast(m.verified ? 'Отмечен как проверенный' : 'Отметка снята'); App.render(); },
    publishReview(id) { Store.setReviewStatus(id, 'published'); U.toast('Отзыв опубликован'); App.render(); },
    async hideReview(id) {
      const r = await UI.ask({ title: 'Скрыть отзыв', text: 'Отзыв пропадёт со страницы мастера. Автор увидит причину.', reasons: R_HIDE, ok: 'Скрыть' });
      if (r) { Store.setReviewStatus(id, 'hidden', r); U.toast('Отзыв скрыт', 'info'); App.render(); return true; }
    },
    sanction: sanctionModal,
    promo: promoModal
  };

  // ---------- Санкции
  function sanctionModal(uid) {
    const t = Store.userById(uid);
    if (!t) return U.toast('Пользователь не найден или удалён', 'error');
    if (!Store.canSanction(t)) return U.toast('Недостаточно прав для санкций к этому пользователю', 'error');
    const TYPES = [['warn', 'Предупреждение', 'warning', 'Без ограничений, только уведомление'], ['reviews', 'Запрет отзывов', 'chat-circle-text', 'Не сможет писать отзывы'], ['requests', 'Запрет заявок', 'tray', 'Не сможет отправлять заявки'], ['ban', 'Блокировка', 'prohibit', 'Вход закрыт, анкета скрыта']];
    const TERMS = [['1', '1 день'], ['3', '3 дня'], ['7', '7 дней'], ['30', '30 дней'], ['0', 'Навсегда']];
    const REASONS = ['Оскорбления', 'Спам', 'Мошенничество', 'Накрутка отзывов', 'Нарушение правил'];
    const current = () => {
      const u = Store.userById(uid), rows = [];
      if (Store.isBanned(u)) rows.push(['ban', `Блокировка ${Store.until(u.ban.until)}`, u.ban.reason]);
      ['reviews', 'requests'].forEach(k => { const l = Store.limit(u, k); if (l) rows.push([k, `${Store.SANCTION[k]} ${Store.until(l.until)}`, l.reason]); });
      if (u.warnings.length) rows.push(['warn', `${u.warnings.length} ${plural(u.warnings.length, 'предупреждение', 'предупреждения', 'предупреждений')}`, u.warnings.slice(-1)[0].reason]);
      return rows.length ? `<div class="sx-cur"><div class="sx-cap">Действуют сейчас</div>${rows.map(([k, l, r]) => `<div class="sx-row"><div><b>${esc(l)}</b><span class="muted sm">${esc(r)}</span></div><button type="button" class="btn btn-sm" data-lift="${k}">Снять</button></div>`).join('')}</div>` : `<p class="muted sm">${icon('check-circle', 'fill')} Сейчас ограничений нет.</p>`;
    };
    U.modal({
      title: 'Санкции',
      body: `<div class="sx-user">${C.userAv(t, 'md')}<div><b>${esc(t.name)}</b><div class="muted sm">${esc(t.email)}</div></div>${C.rolePill(t.role)}</div>
        <div id="sxCur">${current()}</div>
        <form id="sxForm">
          <fieldset class="fld"><legend>Мера</legend><div class="sx-types">${TYPES.map(([v, l, ic, d], i) => `<label><input type="radio" name="type" value="${v}" ${i === 0 ? 'checked' : ''}><span>${icon(ic)}<b>${l}</b><small>${d}</small></span></label>`).join('')}</div></fieldset>
          <fieldset class="fld" id="sxTerm" hidden><legend>Срок</legend><div class="seg seg-wrap">${TERMS.map(([v, l], i) => `<label><input type="radio" name="days" value="${v}" ${i === 2 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
          <div class="fld"><span>Причина</span><div class="chips chips-pick">${REASONS.map(r => `<button type="button" class="chip" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div><textarea class="input" name="reason" rows="2" placeholder="Пользователь увидит эту причину"></textarea></div>
          <button class="btn btn-danger-solid btn-block" id="sxGo">Вынести предупреждение</button>
        </form>`,
      onMount(el, close) {
        const f = el.querySelector('#sxForm'), go = el.querySelector('#sxGo');
        const LABEL = { warn: 'Вынести предупреждение', reviews: 'Запретить отзывы', requests: 'Запретить заявки', ban: 'Заблокировать аккаунт' };
        const sync = () => { const ty = U.form(f).type; el.querySelector('#sxTerm').hidden = ty === 'warn'; go.textContent = LABEL[ty]; };
        f.addEventListener('change', sync);
        el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { el.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); f.reason.value = b.dataset.r; });
        f.addEventListener('submit', e => {
          e.preventDefault();
          const d = U.form(f);
          if (!d.reason) return U.toast('Укажите причину', 'error');
          Store.sanction(uid, { type: d.type, days: d.type === 'warn' ? 0 : +d.days, reason: d.reason });
          close(); U.toast('Санкция применена, пользователь уведомлён'); App.render();
        });
        el.querySelector('#sxCur').addEventListener('click', e => {
          const b = e.target.closest('[data-lift]');
          if (!b) return;
          Store.liftSanction(uid, b.dataset.lift);
          el.querySelector('#sxCur').innerHTML = current();
          U.toast('Ограничение снято'); App.render();
        });
      }
    });
  }

  // ---------- Продвижение (владелец): выдать, продлить, снять
  function promoModal(mid) {
    const s = Store.settings();
    const body = () => {
      const m = Store.master(mid);
      const row = (type, title, ic) => {
        const active = type === 'verify' ? m.verified : (m[type + 'Until'] || 0) > Date.now();
        const state = active ? (type === 'verify' ? 'Подтверждено' : 'Активно до ' + U.dateTime(m[type + 'Until'])) : 'Не активно';
        const act = type === 'verify'
          ? `<button class="btn btn-sm ${active ? '' : 'btn-primary'}" data-pv="${active ? 'off' : 'on'}">${active ? 'Снять' : 'Подтвердить'}</button>`
          : `${active ? `<button class="btn btn-sm btn-ghost btn-danger" data-rv="${type}">Снять</button>` : ''}<select class="input input-sm" data-days="${type}" aria-label="Срок">${[3, 7, 14, 30, 90].map(d => `<option value="${d}" ${d === s.days[type] ? 'selected' : ''}>${d} дн.</option>`).join('')}</select><button class="btn btn-sm btn-primary" data-gift="${type}">${active ? 'Продлить' : 'Выдать'}</button>`;
        return `<div class="pr-row"><span class="pr-ic ${active ? 'on' : ''}">${icon(ic, 'fill')}</span><div class="pr-txt"><b>${title}</b><span class="muted sm">${state}</span></div><div class="pr-act">${act}</div></div>`;
      };
      return `<div class="sx-user">${C.avatar(m, 'md')}<div><b>${esc(m.name)}</b><div class="muted sm">${esc(Store.cat(m.categoryId)?.name || '')}, ${esc(m.city)}</div></div></div>
        ${row('top', 'Топ категории', 'lightning')}${row('premium', 'Премиум', 'crown')}${row('verify', 'Проверенный мастер', 'seal-check')}
        <p class="muted sm mt">Выдача бесплатная. Ошиблись? Нажмите «Отменить» во всплывающем сообщении или отмените выдачу во вкладке «Платежи».</p>`;
    };
    U.modal({
      title: 'Продвижение мастера',
      body: `<div id="prBody">${body()}</div>`,
      onMount(el) {
        const box = el.querySelector('#prBody');
        const redraw = () => { if (box.isConnected) { box.innerHTML = body(); UI.enhance(box); } App.render(); };
        box.addEventListener('click', e => {
          const g = e.target.closest('[data-gift]'), r = e.target.closest('[data-rv]'), v = e.target.closest('[data-pv]');
          if (g) {
            const type = g.dataset.gift, days = +box.querySelector(`select[data-days="${type}"]`).value;
            const pay = Store.buy(mid, type, { gift: true, days });
            redraw();
            U.toast(`«${C.PAY_TYPE[type]}» выдан на ${days} дн.`, 'ok', { action: 'Отменить', onAction: () => { Store.cancelPayment(pay.id, { remove: true }); redraw(); U.toast('Выдача отменена', 'info'); } });
          }
          if (r) {
            const type = r.dataset.rv, m = Store.master(mid), was = m[type + 'Until'];
            Store.revokePromo(mid, type); redraw();
            U.toast('Продвижение снято', 'info', { action: 'Вернуть', onAction: () => { Store.updateMaster(mid, { [type + 'Until']: was }); redraw(); } });
          }
          if (v) { Store.setVerified(mid, v.dataset.pv === 'on'); redraw(); }
        });
      }
    });
  }

  // ================= Вкладки
  const T = {};

  // ---------- Обзор (владелец)
  T.overview = () => {
    const now = Date.now();
    const active = Store.masters().filter(Store.isVisible);
    const reqs = Store.requests(), users = Store.users();
    const req30 = reqs.filter(r => r.date > now - 30 * DAY).length, reqPrev = reqs.filter(r => r.date <= now - 30 * DAY && r.date > now - 60 * DAY).length;
    const delta = reqPrev ? Math.round((req30 - reqPrev) / reqPrev * 100) : 0;
    const days = Store.activityByDay(30, reqs), max = Math.max(1, ...days.map(d => d.n));
    const newUsers = users.filter(x => x.createdAt > now - 30 * DAY).length;
    const newMasters = Store.masters().filter(m => m.createdAt > now - 30 * DAY).length;
    const promo = active.filter(m => Store.isTop(m) || Store.isPremium(m)).length;
    const counts = Store.catCounts(), cc = Store.cityCounts();
    const topCats = Store.categories().map(c => [c, counts[c.id] || 0]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const topCities = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCat = Math.max(1, ...topCats.map(x => x[1])), maxCity = Math.max(1, ...topCities.map(x => x[1]));
    const qu = Store.queue(), qn = qu.masters + qu.reviews + qu.reports;
    const pubRev = Store.reviews(r => r.status === 'published').length;
    const fresh = !Store.masters().length;
    return {
      html: `<div class="dash-head"><h1 class="h2">Обзор площадки</h1><span class="muted sm">${U.date(now)}</span></div>
      ${fresh ? `<div class="card start-guide"><h2 class="h3">${icon('rocket-launch', 'fill')} Площадка запущена</h2><ol class="ul">
        <li>Заполните контакты поддержки во вкладке <a class="link" href="#/admin?tab=settings">Настройки</a>, их увидят пользователи.</li>
        <li>Проверьте список городов и категорий.</li>
        <li>Пригласите первых мастеров: отправьте им ссылку на регистрацию <b>${esc(location.origin + location.pathname)}#/register?role=master</b></li>
        <li>Назначьте модератора во вкладке «Пользователи», когда станет много заявок.</li></ol></div>` : ''}
      ${qn ? `<a class="banner banner-warn banner-link" href="#/admin?tab=queue">${icon('tray', 'fill')}<span>Ждут проверки: ${[qu.masters && `${qu.masters} ${plural(qu.masters, 'анкета', 'анкеты', 'анкет')}`, qu.reviews && `${qu.reviews} ${plural(qu.reviews, 'отзыв', 'отзыва', 'отзывов')}`, qu.reports && `${qu.reports} ${plural(qu.reports, 'жалоба', 'жалобы', 'жалоб')}`].filter(Boolean).join(', ')}</span>${icon('arrow')}</a>` : ''}
      <div class="kpis">
        ${C.kpi('Мастера в каталоге', active.length, `новых за 30 дней: ${newMasters}`, 'wrench', '#/admin?tab=masters')}
        ${C.kpi('Заявки за 30 дней', req30, reqPrev ? `<span class="${delta >= 0 ? 't-ok' : 't-danger'}">${delta >= 0 ? '+' : ''}${delta}%</span> к прошлым 30 дням` : 'всего: ' + reqs.length, 'inbox', '#/admin?tab=requests')}
        ${C.kpi('Пользователи', users.length, `новых за 30 дней: ${newUsers}`, 'users', '#/admin?tab=users')}
        ${C.kpi('Отзывы', pubRev, `с продвижением: ${promo} ${plural(promo, 'мастер', 'мастера', 'мастеров')}`, 'star', '#/admin?tab=reviews')}
      </div>
      <div class="card"><div class="card-head"><h2 class="h3">Заявки по дням</h2><span class="muted sm">последние 30 дней</span></div>
        <div class="bars">${days.map(d => `<i style="height:${d.n / max * 100}%" title="${U.dateShort(d.date)}: ${d.n}"></i>`).join('')}</div>
        <div class="bars-axis muted sm"><span>${U.dateShort(days[0].date)}</span><span>${U.dateShort(days[14].date)}</span><span>сегодня</span></div>
      </div>
      ${active.length ? `<div class="two">
        <div class="card"><h2 class="h3">Мастера по категориям</h2>${topCats.map(([c, n]) => `<div class="hbar"><span>${C.catIcon(c)} ${esc(c.name)}</span><span class="progress"><i style="width:${n / maxCat * 100}%"></i></span><b>${n}</b></div>`).join('')}</div>
        <div class="card"><h2 class="h3">Мастера по городам</h2>${topCities.map(([c, n]) => `<div class="hbar"><span>${esc(c)}</span><span class="progress"><i style="width:${n / maxCity * 100}%"></i></span><b>${n}</b></div>`).join('')}</div>
      </div>` : ''}`
    };
  };

  // ---------- Очередь модерации
  T.queue = () => {
    const pm = Store.masters().filter(m => m.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
    const pr = Store.reviews(r => r.status === 'pending').sort((a, b) => a.date - b.date);
    const rep = Store.reports(r => r.status === 'open').sort((a, b) => a.date - b.date);
    const flag = (ok, l) => `<span class="qf ${ok ? 'ok' : ''}">${icon(ok ? 'check' : 'x')}${l}</span>`;
    const mCard = m => { const c = Store.cat(m.categoryId); return `<article class="card qcard" data-reveal>
      <div class="qc-top">${C.avatar(m, 'md')}<div class="qc-id"><b>${esc(m.name)}</b><span class="muted sm">${C.catIcon(c)} ${esc(c?.name || '')}, ${esc(m.city)}</span><span class="muted sm">Ожидает ${U.ago(m.createdAt).replace(' назад', '')}</span></div></div>
      <p class="qc-about">${esc(m.about || 'Описание не заполнено')}</p>
      <div class="qf-list">${flag(!!m.avatar, 'Фото')}${flag((m.about || '').length >= 80, 'Описание')}${flag(m.services.length >= 1, `Услуги: ${m.services.length}`)}${flag(String(m.phone).replace(/\D/g, '').length >= 10, 'Телефон')}</div>
      <div class="qc-act"><a class="btn btn-sm btn-icon" href="#/m/${m.id}" title="Открыть анкету" aria-label="Открыть анкету">${icon('eye')}</a><button class="btn btn-sm" data-a="reject" data-id="${m.id}">Отклонить</button><button class="btn btn-sm btn-primary" data-a="approve" data-id="${m.id}">${icon('check')} Одобрить</button></div></article>`; };
    const rCard = r => `<article class="card qcard" data-reveal>
      <div class="rv-head">${C.stars(r.rating)}<span class="muted sm">${esc(r.author)} о мастере ${masterName(r.masterId)}, ${U.ago(r.date)}</span></div>
      <p class="qc-text">«${esc(r.text)}»</p>
      <div class="qc-act">${r.userId && Store.canSanction(Store.userById(r.userId)) ? `<button class="btn btn-sm btn-icon" data-a="sanction" data-id="${r.userId}" title="Санкции автору" aria-label="Санкции автору">${icon('gavel')}</button>` : ''}<button class="btn btn-sm" data-a="hiderv" data-id="${r.id}">Скрыть</button><button class="btn btn-sm btn-primary" data-a="pubrv" data-id="${r.id}">${icon('check')} Опубликовать</button></div></article>`;
    const total = pm.length + pr.length + rep.length;
    return {
      html: `<div class="dash-head"><h1 class="h2">Очередь модерации</h1><span class="muted sm">Сначала самые старые</span></div>
      <div class="kpis kpis-3">${C.kpi('Анкеты', pm.length, 'ждут проверки', 'user')}${C.kpi('Отзывы', pr.length, 'на премодерации', 'star')}${C.kpi('Жалобы', rep.length, 'открыто', 'flag', '#/admin?tab=reports')}</div>
      ${!total ? C.empty('Всё проверено', 'Новые анкеты, отзывы и жалобы появятся здесь', '', 'check-circle') : ''}
      ${pm.length ? `<h2 class="h3 q-h">Анкеты на проверке</h2><div class="qgrid">${pm.map(mCard).join('')}</div>` : ''}
      ${pr.length ? `<h2 class="h3 q-h">Отзывы на проверке</h2><div class="qgrid">${pr.map(rCard).join('')}</div>` : ''}
      ${rep.length ? `<div class="q-h card-head"><h2 class="h3">Жалобы</h2><a class="link sm" href="#/admin?tab=reports">Все жалобы</a></div>${rep.slice(0, 3).map(reportCard).join('')}` : ''}`,
      mount: bind({ approve: Mod.approve, reject: Mod.reject, pubrv: Mod.publishReview, hiderv: Mod.hideReview, sanction: Mod.sanction, ...reportHandlers })
    };
  };

  // ---------- Жалобы
  const REPORT_TYPE = { review: ['Отзыв', 'chat-circle-text'], master: ['Анкета', 'user'] };
  function offenderOf(r) { const t = Store.reportTarget(r); return t ? t.userId : null; }
  function reportCard(r) {
    const by = Store.userById(r.userId), t = Store.reportTarget(r), off = offenderOf(r), offU = off && Store.userById(off);
    const target = r.type === 'review'
      ? (t ? `<div class="rp-target"><div class="rv-head">${C.stars(t.rating)}<span class="muted sm">${esc(t.author)} о мастере ${masterName(t.masterId)}</span>${C.pill(C.REVIEW_STATUS, t.status)}</div><p>«${esc(t.text)}»</p></div>` : '<div class="rp-target muted">Отзыв уже удалён</div>')
      : (t ? `<div class="rp-target rp-m">${C.avatar(t, 'sm')}<div><a class="link" href="#/m/${t.id}">${esc(t.name)}</a><div class="muted sm">${esc(Store.cat(t.categoryId)?.name || '')}, ${esc(t.city)}</div></div>${C.pill(C.MASTER_STATUS, t.status)}</div>` : '<div class="rp-target muted">Анкета уже удалена</div>');
    const same = Store.reports(x => x.status === 'open' && x.targetId === r.targetId && x.id !== r.id).length;
    let acts = '';
    if (r.status === 'open') {
      if (r.type === 'review' && t && t.status !== 'hidden') acts += `<button class="btn btn-sm btn-primary" data-a="rp-hide" data-id="${r.id}">${icon('eye-slash')} Скрыть отзыв</button>`;
      if (r.type === 'master' && t && t.status !== 'blocked') acts += `<button class="btn btn-sm btn-primary" data-a="rp-block" data-id="${r.id}">${icon('prohibit')} Заблокировать анкету</button>`;
      if (offU && Store.canSanction(offU)) acts += `<button class="btn btn-sm" data-a="sanction" data-id="${off}">${icon('gavel')} Санкции ${r.type === 'review' ? 'автору' : 'мастеру'}</button>`;
      acts += `<button class="btn btn-sm" data-a="rp-done" data-id="${r.id}">${icon('check')} Меры приняты</button><button class="btn btn-sm btn-ghost" data-a="rp-reject" data-id="${r.id}">Нарушений нет</button>`;
    }
    return `<article class="card rp" data-reveal>
      <div class="rp-head"><span class="rp-type">${icon(REPORT_TYPE[r.type][1])} ${REPORT_TYPE[r.type][0]}</span><b>${esc(r.reason)}</b>${same ? `<span class="pill pill-danger">+${same} ${plural(same, 'жалоба', 'жалобы', 'жалоб')}</span>` : ''}<span class="muted sm rp-date">${U.ago(r.date)}</span>${C.pill(C.REPORT_STATUS, r.status)}</div>
      ${r.text ? `<p class="rp-text">${esc(r.text)}</p>` : ''}
      <div class="muted sm">Отправил: ${by ? esc(by.name) + ' ' + C.rolePill(by.role) : 'удалённый пользователь'}</div>
      ${target}
      ${acts ? `<div class="rp-actions">${acts}</div>` : `<div class="rp-res">${icon('check-circle', 'fill')} ${esc(r.resolution || '')} <span class="muted sm">${userName(r.by)}, ${U.ago(r.at)}</span></div>`}
    </article>`;
  }
  const reportHandlers = {
    'rp-hide': async id => {
      const r = Store.reports(x => x.id === id)[0];
      const why = await UI.ask({ title: 'Скрыть отзыв', text: 'Отзыв пропадёт со страницы мастера, жалоба закроется.', reasons: [r.reason, ...R_HIDE.filter(x => x !== r.reason)], ok: 'Скрыть' });
      if (!why) return;
      Store.setReviewStatus(r.targetId, 'hidden', why); Store.resolveReport(id, 'resolved', 'Отзыв скрыт');
      U.toast('Отзыв скрыт, жалоба закрыта'); App.render();
    },
    'rp-block': async id => {
      const r = Store.reports(x => x.id === id)[0];
      const why = await UI.ask({ title: 'Заблокировать анкету', text: 'Анкета исчезнет из каталога, жалоба закроется.', reasons: [r.reason, ...R_BLOCK], ok: 'Заблокировать' });
      if (!why) return;
      Store.setMasterStatus(r.targetId, 'blocked', why); Store.resolveReport(id, 'resolved', 'Анкета заблокирована');
      U.toast('Анкета заблокирована, жалоба закрыта'); App.render();
    },
    'rp-done': id => { Store.resolveReport(id, 'resolved', 'Меры приняты'); U.toast('Жалоба закрыта'); App.render(); },
    'rp-reject': id => { Store.resolveReport(id, 'rejected', 'Нарушений не найдено'); U.toast('Жалоба отклонена', 'info'); App.render(); }
  };
  T.reports = q => {
    const f = q.f || 'open';
    const all = Store.reports();
    const list = (f === 'all' ? all : all.filter(r => r.status === f)).filter(r => has(q, r.reason, r.text)).sort((a, b) => f === 'open' ? a.date - b.date : b.date - a.date);
    return {
      html: `<div class="dash-head"><h1 class="h2">Жалобы</h1><span class="muted">${all.length} всего</span></div>
      ${chips('reports', f, [['open', 'Открытые', all.filter(r => r.status === 'open').length], ['resolved', 'Меры приняты', all.filter(r => r.status === 'resolved').length], ['rejected', 'Отклонены', all.filter(r => r.status === 'rejected').length], ['all', 'Все', all.length]], { s: q.s })}
      ${searchBox('reports', q, 'Поиск по причине и тексту')}
      ${list.length ? list.map(reportCard).join('') : C.empty(f === 'open' ? 'Открытых жалоб нет' : 'Ничего не найдено', '', '', 'check-circle')}`,
      mount: bind({ sanction: Mod.sanction, ...reportHandlers })
    };
  };

  // ---------- Мастера
  T.masters = q => {
    const f = q.f || 'all', all = Store.masters();
    const cnt = st => all.filter(m => m.status === st).length;
    const list = (f === 'all' ? all : f === 'promo' ? all.filter(m => Store.isTop(m) || Store.isPremium(m)) : all.filter(m => m.status === f))
      .filter(m => has(q, m.name, m.city, m.phone, Store.cat(m.categoryId)?.name)).sort((a, b) => b.createdAt - a.createdAt);
    const rows = list.map(m => {
      const c = Store.cat(m.categoryId), r = Store.rating(m.id);
      return [
        `<div class="cell-user">${C.avatar(m, 'sm')}<div><a class="link" href="#/m/${m.id}"><b>${esc(m.name)}</b></a><div class="muted sm">${esc(U.phone(m.phone))}</div></div></div>`,
        c ? `${C.catIcon(c)} ${esc(c.name)}` : '-', esc(m.city),
        r.count ? `<span class="nowrap">${icon('star', 'ic-star')} ${r.avg.toFixed(1)} <span class="muted">(${r.count})</span></span>` : '-',
        `${C.pill(C.MASTER_STATUS, m.status)}${C.badges(m)}`,
        `<span class="muted sm nowrap">${U.dateShort(m.createdAt)}</span>`,
        `<div class="acts">${m.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-a="approve" data-id="${m.id}">Одобрить</button>` : ''}${C.kebab(m.id)}</div>`
      ];
    });
    return {
      html: `<div class="dash-head"><h1 class="h2">Мастера</h1><span class="muted">${all.length} всего</span></div>
      ${chips('masters', f, [['all', 'Все', all.length], ['pending', 'На проверке', cnt('pending')], ['approved', 'Опубликованы', cnt('approved')], ['rejected', 'Отклонены', cnt('rejected')], ['blocked', 'Заблокированы', cnt('blocked')], ...(Store.can('finance') ? [['promo', 'С продвижением', all.filter(m => Store.isTop(m) || Store.isPremium(m)).length]] : [])], { s: q.s })}
      ${searchBox('masters', q, 'Имя, город, телефон или категория')}
      ${list.length ? C.table([['Мастер'], ['Категория'], ['Город'], ['Рейтинг'], ['Статус'], ['Создан'], ['', 'act']], rows) : C.empty('Ничего не найдено')}`,
      mount: bind({ approve: Mod.approve }, id => {
        const m = Store.master(id), owner = Store.userById(m.userId);
        return [
          { label: 'Открыть анкету', icon: 'eye', on: () => { location.hash = '#/m/' + id; } },
          (m.status === 'pending' || m.status === 'rejected') && { label: 'Одобрить', icon: 'check', on: () => Mod.approve(id) },
          m.status === 'pending' && { label: 'Отклонить с причиной', icon: 'x-circle', on: () => Mod.reject(id) },
          m.status === 'blocked' ? { label: 'Разблокировать', icon: 'arrow-counter-clockwise', on: () => Mod.unblock(id) } : { label: 'Заблокировать анкету', icon: 'prohibit', on: () => Mod.block(id) },
          Store.can('verify') && { label: m.verified ? 'Снять «Проверен»' : 'Отметить проверенным', icon: 'seal-check', on: () => Mod.verify(id) },
          Store.can('finance') && { label: 'Продвижение', icon: 'crown', on: () => Mod.promo(id) },
          Store.canSanction(owner) && { label: 'Санкции к владельцу', icon: 'gavel', on: () => Mod.sanction(m.userId) },
          Store.can('settings') && '-',
          Store.can('settings') && { label: 'Удалить анкету', icon: 'trash', danger: true, on: async () => { if (await U.confirm(`Удалить анкету «${m.name}» вместе с отзывами и заявками? Это необратимо.`, 'Удалить')) { Store.deleteMaster(id); U.toast('Анкета удалена'); App.render(); } } }
        ];
      })
    };
  };

  // ---------- Отзывы
  T.reviews = q => {
    const f = q.f || 'all', all = Store.reviews();
    const list = (f === 'all' ? all : f === 'low' ? all.filter(r => r.rating <= 2) : all.filter(r => r.status === f))
      .filter(r => has(q, r.text, r.author, Store.master(r.masterId)?.name)).sort((a, b) => b.date - a.date).slice(0, 200);
    const cnt = st => all.filter(r => r.status === st).length;
    const rows = list.map(r => [
      `<span class="muted sm nowrap">${U.dateShort(r.date)}</span>`, C.stars(r.rating),
      `<div class="td-text">${esc(r.text)}<div class="muted sm">о мастере ${masterName(r.masterId)}</div></div>`,
      `${esc(r.author)}${r.userId ? '' : ' <span class="muted sm">(гость)</span>'}`,
      C.pill(C.REVIEW_STATUS, r.status),
      `<div class="acts">${r.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-a="pub" data-id="${r.id}">Опубликовать</button>` : ''}${C.kebab(r.id)}</div>`
    ]);
    return {
      html: `<div class="dash-head"><h1 class="h2">Отзывы</h1><span class="muted">${all.length} всего</span></div>
      ${chips('reviews', f, [['all', 'Все', all.length], ['pending', 'На проверке', cnt('pending')], ['published', 'Опубликованы', cnt('published')], ['hidden', 'Скрыты', cnt('hidden')], ['low', 'Оценка 1-2', all.filter(r => r.rating <= 2).length]], { s: q.s })}
      ${searchBox('reviews', q, 'Текст, автор или мастер')}
      ${list.length ? C.table([['Дата'], ['Оценка'], ['Отзыв'], ['Автор'], ['Статус'], ['', 'act']], rows) : C.empty('Отзывов нет')}`,
      mount: bind({ pub: Mod.publishReview }, id => {
        const r = Store.review(id), au = r.userId && Store.userById(r.userId);
        return [
          { label: 'Открыть анкету мастера', icon: 'eye', on: () => { location.hash = '#/m/' + r.masterId; } },
          r.status !== 'published' && { label: 'Опубликовать', icon: 'check', on: () => Mod.publishReview(id) },
          r.status !== 'hidden' && { label: 'Скрыть с причиной', icon: 'eye-slash', on: () => Mod.hideReview(id) },
          au && Store.canSanction(au) && { label: 'Санкции автору', icon: 'gavel', on: () => Mod.sanction(r.userId) },
          Store.can('settings') && '-',
          Store.can('settings') && { label: 'Удалить навсегда', icon: 'trash', danger: true, on: async () => { if (await U.confirm('Удалить отзыв навсегда?', 'Удалить')) { Store.deleteReview(id); App.render(); } } }
        ];
      })
    };
  };

  // ---------- Пользователи
  T.users = (q, me) => {
    const f = q.f || 'all', all = Store.users();
    const list = (f === 'all' ? all : f === 'restricted' ? all.filter(Store.isRestricted) : all.filter(x => x.role === f))
      .filter(x => has(q, x.name, x.email, x.phone)).sort((a, b) => (a.role === 'owner' ? -1 : 0) - (b.role === 'owner' ? -1 : 0) || b.createdAt - a.createdAt);
    const owner = me.role === 'owner';
    const rows = list.map(x => [
      `<div class="cell-user">${C.userAv(x)}<div><b>${esc(x.name)}</b>${x.id === me.id ? ' <span class="pill pill-info">вы</span>' : ''}<div class="muted sm">${esc(x.email)}</div></div></div>`,
      owner && (x.role === 'client' || x.role === 'moderator') ? `<select class="input input-sm" data-role="${x.id}" aria-label="Роль">${['client', 'moderator'].map(k => `<option value="${k}" ${k === x.role ? 'selected' : ''}>${Store.ROLES[k]}</option>`).join('')}</select>` : C.rolePill(x.role),
      C.restrictions(x) || '<span class="pill pill-ok">Активен</span>',
      `<span class="muted sm nowrap">${U.dateShort(x.createdAt)}</span>`,
      `<div class="acts">${x.id !== me.id && x.role !== 'owner' ? C.kebab(x.id) : ''}</div>`
    ]);
    return {
      html: `<div class="dash-head"><h1 class="h2">Пользователи</h1><span class="muted">${all.length} всего</span></div>
      ${chips('users', f, [['all', 'Все', all.length], ...Object.entries(Store.ROLES).map(([k, l]) => [k, l, all.filter(x => x.role === k).length]), ['restricted', 'С ограничениями', all.filter(Store.isRestricted).length]], { s: q.s })}
      ${searchBox('users', q, 'Имя, email или телефон')}
      ${owner ? '<p class="muted sm">Модератором можно назначить пользователя без анкеты мастера. Модератор проверяет анкеты, отзывы и жалобы, выдаёт санкции, но не видит финансы и настройки.</p>' : ''}
      ${list.length ? C.table([['Пользователь'], ['Роль'], ['Статус'], ['Регистрация'], ['', 'act']], rows) : C.empty('Никого не найдено')}`,
      mount() {
        document.querySelectorAll('[data-role]').forEach(s => s.addEventListener('change', async () => {
          const x = Store.userById(s.dataset.role), to = s.value;
          if (!(await U.confirm(to === 'moderator' ? `Назначить ${x.name} модератором? Он получит доступ к модерации и санкциям.` : `Снять права модератора у ${x.name}?`, 'Подтвердить', false))) { App.render(); return; }
          Store.setRole(x.id, to); U.toast('Роль изменена'); App.render();
        }));
        bind({}, id => {
          const x = Store.userById(id), m = x.role === 'master' && Store.masterByUser(id), can = Store.canSanction(x);
          return [
            m && { label: 'Открыть анкету', icon: 'eye', on: () => { location.hash = '#/m/' + m.id; } },
            can && { label: 'Санкции', icon: 'gavel', on: () => Mod.sanction(id) },
            can && Store.isBanned(x) && { label: 'Снять блокировку', icon: 'arrow-counter-clockwise', on: () => { Store.liftSanction(id, 'ban'); U.toast('Блокировка снята'); App.render(); } },
            owner && '-',
            owner && { label: 'Удалить пользователя', icon: 'trash', danger: true, on: async () => { if (await U.confirm(`Удалить ${x.name}?${m ? ' Анкета мастера тоже удалится.' : ''} Это необратимо.`, 'Удалить')) { if (await Store.deleteUser(id)) U.toast('Пользователь удалён'); App.render(); } } }
          ];
        })();
      }
    };
  };

  // ---------- Заявки
  T.requests = q => {
    const f = q.f || 'all', all = Store.requests(), owner = Store.can('settings');
    const list = (f === 'all' ? all : all.filter(r => r.status === f)).filter(r => has(q, r.name, r.text, r.phone, Store.master(r.masterId)?.name)).sort((a, b) => b.date - a.date);
    const rows = list.map(r => [`<span class="muted sm nowrap">${U.dateTime(r.date)}</span>`, masterName(r.masterId), `<span class="nowrap">${esc(r.name)}</span><div class="muted sm">${esc(U.phone(r.phone))}</div>`, `<div class="td-text">${esc(r.text)}</div>`, C.pill(C.REQ_STATUS, r.status), owner ? `<div class="acts"><button class="btn btn-sm btn-ghost btn-icon btn-danger" data-a="del" data-id="${r.id}" aria-label="Удалить">${icon('trash')}</button></div>` : '']);
    return {
      html: `<div class="dash-head"><h1 class="h2">Заявки</h1><span class="muted">${all.length} всего</span></div>
      ${chips('requests', f, [['all', 'Все', all.length], ...Object.entries(C.REQ_STATUS).map(([k, [l]]) => [k, l, all.filter(r => r.status === k).length])], { s: q.s })}
      ${searchBox('requests', q, 'Клиент, мастер, телефон или текст')}
      ${!owner ? '<p class="muted sm">Только просмотр: заявки нужны, чтобы разбирать жалобы.</p>' : ''}
      ${list.length ? C.table([['Дата'], ['Мастер'], ['Клиент'], ['Задача'], ['Статус'], ['', 'act']], rows) : C.empty('Заявок нет')}`,
      mount: bind({ del: async id => { if (await U.confirm('Удалить заявку?', 'Удалить')) { Store.deleteRequest(id); App.render(); } } })
    };
  };

  // ---------- Платежи
  T.payments = q => {
    const f = q.f || 'all', all = Store.payments();
    const now = Date.now();
    const active = Store.masters().filter(m => Store.isTop(m) || Store.isPremium(m));
    const list = (f === 'all' ? all : f === 'refunded' ? all.filter(p => p.status === 'refunded') : all.filter(p => p.type === f))
      .filter(p => has(q, Store.master(p.masterId)?.name)).sort((a, b) => b.date - a.date);
    const st = p => p.status === 'refunded' ? '<span class="pill pill-muted">Отменено</span>' : '<span class="pill pill-ok">Подключено</span>';
    const rows = list.map(p => [`<span class="muted sm nowrap">${U.dateTime(p.date)}</span>`, masterName(p.masterId), `${C.PAY_TYPE[p.type]}${p.days ? `<span class="muted sm">, ${p.days} дн.</span>` : ''}`, st(p), `<span class="muted sm">${userName(p.by)}</span>`, p.status !== 'refunded' ? `<div class="acts">${C.kebab(p.id)}</div>` : '']);
    return {
      html: `<div class="dash-head"><h1 class="h2">Продвижение</h1><span class="muted">Сейчас активно: <b>${active.length}</b></span></div>
      <p class="muted sm">Продвижение подключается бесплатно: откройте мастера во вкладке «Мастера» и выберите «Продвижение». Запросы мастеров приходят в уведомления.</p>
      ${chips('payments', f, [['all', 'Все', all.length], ...Object.entries(C.PAY_TYPE).map(([k, l]) => [k, l, all.filter(p => p.type === k).length]), ['refunded', 'Отменённые', all.filter(p => p.status === 'refunded').length]], { s: q.s })}
      ${searchBox('payments', q, 'Имя мастера')}
      ${list.length ? C.table([['Дата'], ['Мастер'], ['Что подключено'], ['Статус'], ['Кто'], ['', 'act']], rows) : C.empty('Пока ничего не подключали', '', '', 'crown')}`,
      mount: bind({}, id => {
        const p = Store.payments().find(x => x.id === id);
        return [
          { label: 'Открыть анкету', icon: 'eye', on: () => { location.hash = '#/m/' + p.masterId; } },
          { label: 'Продвижение мастера', icon: 'crown', on: () => Mod.promo(p.masterId) },
          { label: 'Отменить подключение', icon: 'arrow-counter-clockwise', danger: true, on: async () => {
            if (!(await U.confirm(`Отменить? Срок продвижения у мастера сократится${p.days ? ` на ${p.days} дн.` : ''}.`, 'Отменить'))) return;
            Store.cancelPayment(id); U.toast('Подключение отменено'); App.render();
          } }
        ];
      })
    };
  };

  // ---------- Категории
  T.categories = () => {
    const counts = {};
    Store.masters().forEach(m => { counts[m.categoryId] = (counts[m.categoryId] || 0) + 1; });
    const iconSel = (cur = 'squares-four') => `<select class="input input-sm" name="icon" aria-label="Иконка">${C.CAT_ICONS.map(n => `<option value="${n}" data-icon="${n}" ${n === cur ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
    return {
      html: `<div class="dash-head"><h1 class="h2">Категории</h1><span class="muted">${Store.categories().length}</span></div>
      <form class="card inline-form" id="catAdd"><div class="w-icon">${iconSel()}</div><input class="input input-sm" name="name" placeholder="Название новой категории" required maxlength="40"><button class="btn btn-sm btn-primary">${icon('plus')} Добавить</button></form>
      ${C.table([['Иконка'], ['Название'], ['Мастеров'], ['', 'act']], Store.categories().map(c => [`<div class="w-icon" data-cat="${c.id}">${iconSel(c.icon)}</div>`, `<input class="input input-sm" data-name="${c.id}" value="${esc(c.name)}" maxlength="40" aria-label="Название">`, counts[c.id] || 0, `<div class="acts"><button class="btn btn-sm" data-a="save" data-id="${c.id}">Сохранить</button><button class="btn btn-sm btn-ghost btn-icon btn-danger" data-a="del" data-id="${c.id}" aria-label="Удалить">${icon('trash')}</button></div>`]))}`,
      mount() {
        document.getElementById('catAdd').addEventListener('submit', e => { e.preventDefault(); const d = U.form(e.target); if (Store.categories().some(c => c.name.toLowerCase() === d.name.toLowerCase())) return U.toast('Такая категория уже есть', 'error'); Store.saveCategory(d); U.toast('Категория добавлена'); App.render(); });
        bind({
          save: id => { const name = document.querySelector(`[data-name="${id}"]`).value.trim(); if (!name) return U.toast('Введите название', 'error'); Store.saveCategory({ id, icon: document.querySelector(`[data-cat="${id}"] select`).value, name }); U.toast('Сохранено'); App.render(); },
          del: async id => {
            if (Store.masters().some(m => m.categoryId === id)) return U.toast('В категории есть мастера. Сначала перенесите их', 'error');
            if (await U.confirm('Удалить категорию?', 'Удалить')) { Store.deleteCategory(id); App.render(); }
          }
        })();
      }
    };
  };

  // ---------- Журнал действий
  T.log = (q, me) => {
    const f = q.f || 'all';
    const list = Store.log().filter(l => (f === 'all' || (f === 'mine' ? l.by === me.id : Store.userById(l.by)?.role === f)) && has(q, l.action, l.target, Store.userById(l.by)?.name)).slice(0, 300);
    return {
      html: `<div class="dash-head"><h1 class="h2">Журнал действий</h1></div>
      <p class="muted sm">Все решения модераторов и владельца: кто, когда и что сделал.</p>
      ${chips('log', f, [['all', 'Все'], ['mine', 'Мои'], ['moderator', 'Модераторы'], ['owner', 'Владелец']], { s: q.s })}
      ${searchBox('log', q, 'Действие, объект или сотрудник')}
      ${list.length ? `<div class="card log">${list.map(l => { const by = Store.userById(l.by); return `<div class="log-row">${C.userAv(by, 'xs')}<div class="log-main"><b>${esc(by?.name || 'Система')}</b> <span>${esc(l.action.toLowerCase())}</span>${l.target ? `<div class="muted sm">${esc(l.target)}</div>` : ''}</div><span class="muted sm nowrap" title="${U.dateTime(l.at)}">${U.ago(l.at)}</span></div>`; }).join('')}</div>` : C.empty('Записей нет', '', '', 'clock-counter-clockwise')}`,
      mount: bind({})
    };
  };

  // ---------- Настройки
  T.settings = () => {
    const s = Store.settings();
    return {
      html: `<div class="dash-head"><h1 class="h2">Настройки</h1></div>
      <form class="card" id="setForm" novalidate>
        <h2 class="h3">Площадка</h2>
        <div class="row"><label class="fld"><span>Название</span><input class="input" name="siteName" value="${esc(s.siteName)}" required></label>
          <label class="fld"><span>Регион</span><input class="input" name="region" value="${esc(s.region)}"></label></div>
        <div class="row"><label class="fld"><span>Короткое название региона</span><input class="input" name="regionShort" value="${esc(s.regionShort)}"></label>
          <label class="fld"><span>«Где?» в заголовках</span><input class="input" name="regionIn" value="${esc(s.regionIn)}"></label></div>
        <div class="row"><label class="fld"><span>Email поддержки</span><input class="input" type="email" name="contactEmail" value="${esc(s.contactEmail)}"></label>
          <label class="fld"><span>Телефон поддержки</span><input class="input" type="tel" name="contactPhone" value="${esc(s.contactPhone)}"></label></div>
        <label class="fld"><span>Города, по одному в строке</span><textarea class="input" name="cities" rows="6">${esc(s.cities.join('\n'))}</textarea></label>
        <label class="fld"><span>Telegram поддержки, без @</span><input class="input" name="contactTelegram" value="${esc(s.contactTelegram || '')}" placeholder="username"></label>
        <h2 class="h3 mt">Продвижение по умолчанию</h2>
        <div class="row">
          <label class="fld"><span>Топ, дней</span><input class="input" type="number" inputmode="numeric" min="1" name="d_top" value="${s.days.top}"></label>
          <label class="fld"><span>Премиум, дней</span><input class="input" type="number" inputmode="numeric" min="1" name="d_premium" value="${s.days.premium}"></label>
        </div>
        <h2 class="h3 mt">Модерация</h2>
        <label class="toggle"><input type="checkbox" name="autoApprove" ${s.autoApprove ? 'checked' : ''}><span class="toggle-ui"></span><span>Публиковать новые анкеты без проверки</span></label>
        <label class="toggle"><input type="checkbox" name="reviewPremod" ${s.reviewPremod ? 'checked' : ''}><span class="toggle-ui"></span><span>Проверять отзывы перед публикацией</span></label>
        <button class="btn btn-primary mt">${icon('check')} Сохранить настройки</button>
      </form>
      <div class="card"><h2 class="h3">Резервная копия</h2>
        <p class="muted sm">Все данные хранятся в Supabase. Здесь можно скачать копию в файл JSON. На бесплатном тарифе Supabase автоматических бэкапов нет, скачивайте копию раз в неделю.</p>
        <button class="btn" id="exp">${icon('download')} Скачать копию</button></div>`,
      mount() {
        document.getElementById('setForm').addEventListener('submit', e => {
          e.preventDefault();
          const d = U.form(e.target);
          const cities = [...new Set(d.cities.split('\n').map(x => x.trim()).filter(Boolean))];
          if (!d.siteName) return U.toast('Укажите название', 'error');
          if (!cities.length) return U.toast('Нужен хотя бы один город', 'error');
          const used = [...new Set(Store.masters().map(m => m.city))].filter(c => !cities.includes(c));
          if (used.length) return U.toast(`Нельзя убрать города с мастерами: ${used.join(', ')}`, 'error');
          Store.saveSettings({
            siteName: d.siteName, region: d.region, regionShort: d.regionShort, regionIn: d.regionIn, contactEmail: d.contactEmail, contactPhone: d.contactPhone, contactTelegram: (d.contactTelegram || '').replace(/^@/, ''), cities,
            days: { top: Math.max(1, +d.d_top || 7), premium: Math.max(1, +d.d_premium || 30) },
            autoApprove: !!d.autoApprove, reviewPremod: !!d.reviewPremod
          });
          U.toast('Настройки сохранены'); App.render();
        });
        document.getElementById('exp').addEventListener('click', () => U.download(`masterok-backup-${new Date().toISOString().slice(0, 10)}.json`, Store.exportJSON()));
      }
    };
  };
})();
