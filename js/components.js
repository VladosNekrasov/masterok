window.C = (() => {
  const { esc, icon, plural, money } = U;

  const MASTER_STATUS = { approved: ['Опубликована', 'ok'], pending: ['На проверке', 'warn'], rejected: ['Отклонена', 'danger'], blocked: ['Заблокирована', 'danger'] };
  const REVIEW_STATUS = { published: ['Опубликован', 'ok'], pending: ['На проверке', 'warn'], hidden: ['Скрыт', 'muted'] };
  const REQ_STATUS = { new: ['Новая', 'info'], accepted: ['В работе', 'warn'], done: ['Выполнена', 'ok'], declined: ['Отклонена', 'muted'] };
  const REPORT_STATUS = { open: ['Открыта', 'warn'], resolved: ['Меры приняты', 'ok'], rejected: ['Отклонена', 'muted'] };
  const PAY_TYPE = { top: 'Топ категории', premium: 'Премиум', verify: 'Проверка анкеты' };
  const ROLE_TONE = { owner: 'accent', moderator: 'info', master: 'ok', client: 'muted' };
  const CAT_ICONS = ['paint-roller', 'drop', 'lightning', 'sparkle', 'scissors', 'graduation-cap', 'camera', 'broom', 'washing-machine', 'car', 'truck', 'hand-heart', 'desktop', 'armchair', 'hammer', 'flower-lotus', 'needle', 'wifi-high', 'baby', 'dog', 'tree', 'code', 'plugs', 'wrench', 'squares-four'];
  const pill = (map, s) => { const [l, t] = map[s] || [s, 'muted']; return `<span class="pill pill-${t}">${esc(l)}</span>`; };
  const rolePill = r => `<span class="pill pill-${ROLE_TONE[r] || 'muted'}">${esc(Store.ROLES[r] || r)}</span>`;

  const logoMark = () => `<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="var(--accent)"/><path d="M10 28V13l10 9 10-9v15" fill="none" stroke="var(--on-accent)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const catIcon = (c, cls = '') => `<i class="ph-duotone ph-${esc(c?.icon || 'squares-four')} cat-glyph ${cls}" aria-hidden="true"></i>`;

  // Фото с запасным вариантом: если картинка не загрузилась, остаются инициалы
  function avatar(m, size = 'md') {
    return `<span class="av av-${size}" style="--h:${m.hue || 20}"><span>${esc(U.initials(m.name))}</span>${m.avatar ? `<img src="${esc(m.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  }
  const hue = s => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  const userAv = (u, size = 'sm') => { const m = u && u.role === 'master' && Store.masterByUser(u.id); return m ? avatar(m, size) : `<span class="av av-${size}" style="--h:${hue(u?.id || '?')}"><span>${esc(U.initials(u?.name || '?'))}</span></span>`; };

  function stars(r) {
    const n = Math.round(r);
    return `<span class="stars" aria-label="Оценка ${r} из 5">${[1, 2, 3, 4, 5].map(i => icon('star', i <= n ? 'on' : 'off')).join('')}</span>`;
  }
  function rating(m) {
    const r = Store.rating(m.id);
    if (!r.count) return `<span class="rating muted">Новый мастер</span>`;
    return `<span class="rating">${icon('star', 'ic-star')}<b>${r.avg.toFixed(1)}</b><span class="muted">${r.count} ${plural(r.count, 'отзыв', 'отзыва', 'отзывов')}</span></span>`;
  }
  function badges(m) {
    let s = '';
    if (m.away) s += `<span class="badge b-away">${icon('pause-circle', 'fill')}Не принимает заказы</span>`;
    if (Store.isTop(m)) s += `<span class="badge b-top">${icon('zap', 'fill')}В топе</span>`;
    if (Store.isPremium(m)) s += `<span class="badge b-prem">${icon('crown', 'fill')}Премиум</span>`;
    if (m.verified) s += `<span class="badge b-ver">${icon('shield', 'fill')}Проверен</span>`;
    return s ? `<div class="badges">${s}</div>` : '';
  }
  function favBtn(m) {
    const on = Store.isFav(m.id);
    return `<button class="fav ${on ? 'on' : ''}" data-act="fav" data-id="${m.id}" aria-label="В избранное" title="В избранное"><i class="ph ph-heart i-off"></i><i class="ph-fill ph-heart i-on"></i></button>`;
  }
  function card(m) {
    const c = Store.cat(m.categoryId) || {};
    const p = Store.priceFrom(m);
    return `<article class="mcard spot ${Store.isPremium(m) ? 'is-premium' : ''} ${m.away ? 'is-away' : ''}" data-reveal>
      <a class="mcard-link" href="#/m/${m.id}" aria-label="${esc(m.name)}"></a>
      ${favBtn(m)}
      <div class="mcard-top">${avatar(m, 'md')}<div class="mcard-id"><h3>${esc(m.name)}</h3><div class="mcard-cat">${catIcon(c)}<span>${esc(c.name || '')}</span></div></div></div>
      <div class="mcard-meta">${rating(m)}<span class="mcard-city">${icon('pin')}${esc(m.city)}</span></div>
      ${badges(m)}
      <p class="mcard-about">${esc(m.about || 'Мастер пока не заполнил описание.')}</p>
      <div class="mcard-foot"><span class="mcard-price">${p != null ? `<small>от</small> ${money(p)}` : '<small>Цена по запросу</small>'}</span><span class="mcard-go">${icon('up')}</span></div>
    </article>`;
  }
  function empty(title, text = '', action = '', ic = 'magnifying-glass') {
    return `<div class="empty"><div class="empty-ic"><i class="ph-duotone ph-${ic}"></i></div><h3 class="h3">${esc(title)}</h3>${text ? `<p class="muted">${esc(text)}</p>` : ''}${action ? `<div class="empty-act">${action}</div>` : ''}</div>`;
  }

  // Плашки текущих ограничений пользователя
  function restrictions(u) {
    const out = [];
    if (Store.isBanned(u)) out.push(`<span class="pill pill-danger">Заблокирован ${esc(Store.until(u.ban.until))}</span>`);
    const lr = Store.limit(u, 'reviews'), lq = Store.limit(u, 'requests');
    if (lr) out.push(`<span class="pill pill-warn">Без отзывов ${esc(Store.until(lr.until))}</span>`);
    if (lq) out.push(`<span class="pill pill-warn">Без заявок ${esc(Store.until(lq.until))}</span>`);
    if ((u.warnings || []).length) out.push(`<span class="pill pill-muted">${u.warnings.length} ${plural(u.warnings.length, 'предупреждение', 'предупреждения', 'предупреждений')}</span>`);
    return out.join(' ');
  }
  // Баннер в кабинете: что ограничено и почему
  function restrictBanner(u) {
    const rows = [];
    const lr = Store.limit(u, 'reviews'), lq = Store.limit(u, 'requests'), w = (u.warnings || []).slice(-1)[0];
    if (lr) rows.push(`Вы не можете оставлять отзывы ${Store.until(lr.until)}. Причина: ${lr.reason}`);
    if (lq) rows.push(`Вы не можете отправлять заявки ${Store.until(lq.until)}. Причина: ${lq.reason}`);
    if (w) rows.push(`Последнее предупреждение (${U.date(w.at)}): ${w.reason}`);
    return rows.length ? `<div class="banner banner-warn">${icon('warning', 'fill')}<div>${rows.map(esc).join('<br>')}<div class="sm mt-s">Не согласны? ${esc(supportLine())}</div></div></div>` : '';
  }

  function header(path) {
    const s = Store.settings(), u = Store.user();
    const nav = [['/catalog', 'Каталог'], ['/pricing', 'Мастерам'], ['/about', 'О сервисе']];
    const on = p => path === p || (p !== '/' && path.startsWith(p)) ? 'on' : '';
    let acc;
    if (u) {
      const staff = Store.isStaff(u);
      const to = staff ? '#/admin' : '#/cabinet';
      const label = u.role === 'owner' ? 'Управление' : u.role === 'moderator' ? 'Модерация' : 'Кабинет';
      const q = staff ? Store.queue() : null;
      const badge = staff ? q.masters + q.reviews + q.reports : u.role === 'master' ? Store.requests(r => r.masterId === Store.masterByUser(u.id)?.id && r.status === 'new').length : 0;
      const n = Store.unread();
      acc = `<button class="btn btn-ghost btn-sm btn-icon bell" data-act="notif" aria-label="Уведомления${n ? ', непрочитанных ' + n : ''}" title="Уведомления">${icon('bell')}${n ? `<span class="bell-n">${n > 9 ? '9+' : n}</span>` : ''}</button>
        <a class="btn btn-sm" href="${to}">${icon(staff ? 'settings' : 'user')}<span class="hide-s">${label}</span>${badge ? `<span class="dot-n">${badge}</span>` : ''}</a>
        <button class="btn btn-ghost btn-sm btn-icon hide-s" data-act="logout" title="Выйти" aria-label="Выйти">${icon('logout')}</button>`;
    } else {
      acc = `<a class="btn btn-ghost btn-sm hide-s" href="#/login">Войти</a><a class="btn btn-primary btn-sm" href="#/register?role=master">Стать мастером</a>`;
    }
    return `<header class="hdr"><div class="hdr-in">
      <a class="logo" href="#/">${logoMark()}<span class="logo-txt">${esc(s.siteName)}<small>${esc(s.regionShort)}</small></span></a>
      <nav class="nav">${nav.map(([p, l]) => `<a class="${on(p)}" href="#${p}">${l}</a>`).join('')}${!u ? `<a class="only-m" href="#/login">Войти</a>` : `<button class="only-m nav-out" data-act="logout">Выйти из аккаунта</button>`}</nav>
      <div class="hdr-actions">
        <button class="btn btn-ghost btn-sm btn-icon theme-btn" data-act="theme" title="Сменить тему" aria-label="Сменить тему"><i class="ph ph-moon t-dark"></i><i class="ph ph-sun t-light"></i></button>
        ${acc}
        <button class="btn btn-ghost btn-sm btn-icon burger" data-act="burger" aria-label="Меню">${icon('menu')}</button>
      </div></div></header>`;
  }
  const contacts = s => [s.contactEmail && `<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>`, s.contactPhone && `<a href="tel:${esc(s.contactPhone)}">${esc(U.phone(s.contactPhone))}</a>`, s.contactTelegram && `<a href="https://t.me/${esc(s.contactTelegram)}" target="_blank" rel="noopener">Telegram: @${esc(s.contactTelegram)}</a>`].filter(Boolean).join('');
  const supportLine = () => { const s = Store.settings(); return s.contactEmail ? `напишите на ${s.contactEmail}` : s.contactTelegram ? `напишите в Telegram @${s.contactTelegram}` : 'напишите в поддержку'; };
  function footer() {
    const s = Store.settings();
    const cats = Store.categories().slice(0, 6);
    return `<footer class="ftr"><div class="wrap">
      <div class="ftr-in">
        <div class="ftr-brand"><a class="logo" href="#/">${logoMark()}<span class="logo-txt">${esc(s.siteName)}<small>${esc(s.regionShort)}</small></span></a>
          <p class="muted">Каталог мастеров и услуг: ${esc(s.region)}. Связь с мастерами напрямую, без комиссии.</p></div>
        <div><h4>Клиентам</h4><a href="#/catalog">Каталог мастеров</a>${cats.map(c => `<a href="${U.link('/catalog', { cat: c.id })}">${esc(c.name)}</a>`).join('')}</div>
        <div><h4>Мастерам</h4><a href="#/register?role=master">Разместить анкету</a><a href="#/pricing">Тарифы и продвижение</a><a href="#/about">Правила сервиса</a></div>
        <div><h4>Контакты</h4>${contacts(s) || '<span class="muted sm">Скоро появятся</span>'}</div>
      </div>
      <div class="ftr-word" aria-hidden="true">${esc(s.siteName)}</div>
      <div class="ftr-bottom muted sm"><span>© ${new Date().getFullYear()} ${esc(s.siteName)}</span><span>${esc(s.region)}</span></div>
    </div></footer>`;
  }

  // Каркас кабинета / панели управления с боковым меню
  function dash(base, tabs, active, title, content) {
    return `<div class="wrap dash">
      <aside class="dash-nav"><div class="dash-title">${esc(title)}</div>
        ${tabs.map(([id, label, ic, n]) => `<a href="#${base}?tab=${id}" class="${id === active ? 'on' : ''}">${icon(ic)}<span>${label}</span>${n ? `<span class="dot-n">${n}</span>` : ''}</a>`).join('')}
      </aside>
      <section class="dash-main">${content}</section></div>`;
  }
  const kpi = (label, value, sub = '', ic = 'chart', href = '') => `<${href ? `a href="${href}"` : 'div'} class="kpi spot"><div class="kpi-l"><span class="kpi-ic">${icon(ic)}</span>${esc(label)}</div><b>${value}</b>${sub ? `<span class="muted sm">${sub}</span>` : ''}</${href ? 'a' : 'div'}>`;

  function citySelect(name, value, all = 'Все города', counts) {
    return `<select class="input" name="${name}">${all ? `<option value="">${all}</option>` : ''}${Store.settings().cities.map(c => `<option value="${esc(c)}" ${c === value ? 'selected' : ''} ${counts ? `data-meta="${counts[c] || 0}"` : ''}>${esc(c)}</option>`).join('')}</select>`;
  }
  function catSelect(name, value, all = 'Все категории', counts) {
    return `<select class="input" name="${name}">${all ? `<option value="" data-icon="squares-four">${all}</option>` : ''}${Store.categories().map(c => `<option value="${c.id}" ${c.id === value ? 'selected' : ''} data-icon="${esc(c.icon)}" ${counts ? `data-meta="${counts[c.id] || 0}"` : ''}>${esc(c.name)}</option>`).join('')}</select>`;
  }
  // Таблица, которая на телефоне превращается в карточки
  const table = (cols, rows) => `<div class="table-wrap"><table class="tbl tbl-r"><thead><tr>${cols.map(([l, c]) => `<th class="${c || ''}">${l}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((cell, i) => `<td data-label="${esc(cols[i][0])}" class="${cols[i][1] || ''}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const kebab = id => `<button type="button" class="btn btn-ghost btn-sm btn-icon kebab" data-menu="${esc(id)}" aria-label="Действия">${icon('dots-three-vertical')}</button>`;

  return { contacts, supportLine, MASTER_STATUS, REVIEW_STATUS, REQ_STATUS, REPORT_STATUS, PAY_TYPE, CAT_ICONS, pill, rolePill, logoMark, catIcon, avatar, userAv, stars, rating, badges, favBtn, card, empty, restrictions, restrictBanner, header, footer, dash, kpi, citySelect, catSelect, table, kebab };
})();
