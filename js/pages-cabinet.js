(() => {
  const { esc, icon, money, plural } = U;
  const P = window.Pages = window.Pages || {};

  P.cabinet = (p, q) => {
    const u = Store.user();
    if (!u) return App.redirect('/login?next=/cabinet');
    if (Store.isStaff(u)) return App.redirect('/admin' + (q.tab === 'account' ? '?tab=account' : ''));
    return u.role === 'master' ? masterCab(u, q.tab || 'overview') : clientCab(u, q.tab || 'requests');
  };

  // ================= Кабинет мастера
  function masterCab(u, tab) {
    const m = Store.masterByUser(u.id);
    if (!m) return { title: 'Кабинет', html: `<div class="wrap page">${C.empty('Анкета не найдена', 'Возможно, её удалила администрация')}</div>` };
    const reqs = Store.requests(r => r.masterId === m.id);
    const newReq = reqs.filter(r => r.status === 'new').length;
    const tabs = [['overview', 'Обзор', 'grid'], ['profile', 'Анкета', 'user'], ['services', 'Услуги и цены', 'tag'], ['requests', 'Заявки', 'inbox', newReq], ['reviews', 'Отзывы', 'star'], ['promo', 'Продвижение', 'zap'], ['account', 'Аккаунт', 'settings']];
    const T = { overview: mOverview, profile: mProfile, services: mServices, requests: mRequests, reviews: mReviews, promo: mPromo, account: () => P.account(u) };
    const key = T[tab] ? tab : 'overview';
    const t = T[key](m, u, reqs);
    return { title: 'Кабинет мастера', html: C.dash('/cabinet', tabs, key, 'Кабинет мастера', C.restrictBanner(u) + t.html), mount: t.mount };
  }

  function statusBanner(m) {
    const map = {
      pending: ['warn', 'hourglass-medium', 'Анкета на проверке. После одобрения она появится в каталоге, обычно это до 24 часов.'],
      rejected: ['danger', 'x-circle', `Анкета отклонена${m.statusReason ? ': ' + m.statusReason : ''}. Исправьте данные и сохраните, она снова уйдёт на проверку.`],
      blocked: ['danger', 'prohibit', `Анкета заблокирована${m.statusReason ? ': ' + m.statusReason : ''}. Если это ошибка, ${C.supportLine()}.`]
    };
    const b = map[m.status];
    return b ? `<div class="banner banner-${b[0]}">${icon(b[1], 'fill')}<span>${esc(b[2])}</span>${m.status === 'rejected' ? `<a class="btn btn-sm" href="#/cabinet?tab=profile">Исправить</a>` : ''}</div>` : '';
  }

  function mOverview(m, u, reqs) {
    const r = Store.rating(m.id), nNew = reqs.filter(x => x.status === 'new').length;
    const checks = [
      [!!m.avatar, 'Фото профиля', 'profile'],
      [(m.about || '').length >= 80, 'Описание от 80 символов', 'profile'],
      [m.services.length >= 3, 'Минимум 3 услуги с ценами', 'services'],
      [m.portfolio.length >= 2, 'Фото работ, от 2 шт.', 'profile'],
      [!!m.telegram, 'Telegram для связи', 'profile'],
      [!!m.schedule, 'График работы', 'profile']
    ];
    const pct = Math.round(checks.filter(c => c[0]).length / checks.length * 100);
    const conv = m.views ? (reqs.length / m.views * 100).toFixed(1).replace('.', ',') : '0';
    const promo = [Store.isTop(m) && `«Топ» до ${U.date(m.topUntil)}`, Store.isPremium(m) && `«Премиум» до ${U.date(m.premiumUntil)}`].filter(Boolean);
    const latest = [...reqs].sort((a, b) => b.date - a.date).slice(0, 3);
    return {
      html: `<div class="dash-head"><h1 class="h2">Здравствуйте, ${esc(m.name.split(' ')[0])}!</h1><a class="btn btn-sm" href="#/m/${m.id}">${icon('eye')} Моя анкета</a></div>
      ${statusBanner(m)}
      ${m.away ? `<div class="banner banner-info">${icon('pause-circle', 'fill')}<span>Вы не принимаете заказы. Анкета видна в каталоге с пометкой, заявки отключены.</span><button class="btn btn-sm" id="awayOff">Снова принимать</button></div>` : ''}
      <div class="kpis">
        ${C.kpi('Просмотры анкеты', U.num(m.views), 'за всё время', 'eye')}
        ${C.kpi('Показы телефона', U.num(m.phoneViews), m.views ? Math.round(m.phoneViews / m.views * 100) + '% от просмотров' : '', 'phone')}
        ${C.kpi('Заявки', reqs.length, nNew ? `<span class="t-accent">${nNew} ${plural(nNew, 'новая', 'новые', 'новых')}</span>` : 'конверсия ' + conv + '%', 'inbox', '#/cabinet?tab=requests')}
        ${C.kpi('Рейтинг', r.count ? r.avg.toFixed(1) : '-', r.count + ' ' + plural(r.count, 'отзыв', 'отзыва', 'отзывов'), 'star', '#/cabinet?tab=reviews')}
      </div>
      <div class="two">
        <div class="card"><div class="card-head"><h2 class="h3">Заполненность анкеты</h2><b>${pct}%</b></div>
          <div class="progress progress-lg"><i style="width:${pct}%"></i></div>
          <ul class="checklist">${checks.map(([ok, l, t]) => `<li class="${ok ? 'ok' : ''}">${icon(ok ? 'check' : 'plus')}${ok ? `<span>${l}</span>` : `<a class="link" href="#/cabinet?tab=${t}">${l}</a>`}</li>`).join('')}</ul>
          <p class="muted sm">Заполненные анкеты получают в 2-3 раза больше заявок.</p></div>
        <div class="card"><div class="card-head"><h2 class="h3">Продвижение</h2></div>
          ${promo.length ? `<p>${icon('zap', 'fill')} Активно: ${promo.join(', ')}</p>` : '<p class="muted">Сейчас продвижение не подключено. Анкета показывается в общем порядке.</p>'}
          <a class="btn btn-primary" href="#/cabinet?tab=promo">${icon('zap')} Получить больше клиентов</a></div>
      </div>
      <div class="card"><div class="card-head"><h2 class="h3">Последние заявки</h2><a class="link sm" href="#/cabinet?tab=requests">Все заявки</a></div>
        ${latest.length ? latest.map(reqRow).join('') : '<p class="muted">Заявок пока нет.</p>'}</div>`,
      mount() { document.getElementById('awayOff')?.addEventListener('click', () => { Store.updateMaster(m.id, { away: false }); U.toast('Вы снова принимаете заказы'); App.render(); }); }
    };
  }
  const reqRow = r => `<div class="req-row"><div><b>${esc(r.name)}</b> <span class="muted sm">${U.ago(r.date)}</span><div class="muted sm clamp1">${esc(r.text)}</div></div>${C.pill(C.REQ_STATUS, r.status)}</div>`;

  function mProfile(m) {
    return {
      html: `<div class="dash-head"><h1 class="h2">Анкета</h1><a class="btn btn-sm" href="#/m/${m.id}">${icon('eye')} Посмотреть</a></div>
      ${statusBanner(m)}
      <div class="card"><label class="toggle toggle-card"><input type="checkbox" id="awayT" ${!m.away ? 'checked' : ''}><span class="toggle-ui"></span><span><b>Принимаю заказы</b><small>Выключите на время отпуска или загрузки. Анкета останется в каталоге с пометкой, а кнопка заявки отключится.</small></span></label></div>
      <form class="card" id="profForm" novalidate>
        <div class="av-edit">${C.avatar(m, 'lg')}<div><label class="btn btn-sm" data-label="Загрузить фото">${icon('upload')} <span>Загрузить фото</span><input type="file" accept="image/jpeg,image/png,image/webp" id="avIn" hidden></label>
          ${m.avatar ? `<button type="button" class="btn btn-sm btn-ghost btn-danger" id="avDel">Удалить</button>` : ''}<p class="muted sm">Лицо крупным планом, хорошее освещение.</p></div></div>
        <div class="row">
          <label class="fld"><span>Имя и фамилия</span><input class="input" name="name" required value="${esc(m.name)}"></label>
          <label class="fld"><span>Категория</span>${C.catSelect('categoryId', m.categoryId, '')}</label>
        </div>
        <div class="row">
          <label class="fld"><span>Город</span>${C.citySelect('city', m.city, '')}</label>
          <label class="fld"><span>Опыт, лет</span><input class="input" type="number" inputmode="numeric" min="0" max="60" name="experience" value="${m.experience}"></label>
        </div>
        <div class="row">
          <label class="fld"><span>Телефон</span><input class="input" type="tel" name="phone" required value="${esc(m.phone)}"></label>
          <label class="fld"><span>Telegram, без @</span><input class="input" name="telegram" value="${esc(m.telegram)}" placeholder="username"></label>
        </div>
        <label class="fld"><span>График работы</span><input class="input" name="schedule" value="${esc(m.schedule)}" placeholder="Например: Пн-Сб 9:00-20:00"></label>
        <label class="fld"><span>О себе <em class="muted" id="aboutCnt">${(m.about || '').length} / 1500</em></span><textarea class="input" name="about" rows="6" maxlength="1500" placeholder="Чем занимаетесь, какой опыт, в чём ваши преимущества, куда выезжаете">${esc(m.about)}</textarea></label>
        <p class="muted sm">Не указывайте телефон и ссылки в описании, для этого есть отдельные поля. Анкеты с контактами в тексте отклоняются.</p>
        <button class="btn btn-primary">${icon('check')} Сохранить</button>
      </form>
      <div class="card"><div class="card-head"><h2 class="h3">Фото работ <span class="muted sm">${m.portfolio.length} / 8</span></h2>
        ${m.portfolio.length < 8 ? `<label class="btn btn-sm" data-label="Добавить">${icon('plus')} <span>Добавить</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple id="pfIn" hidden></label>` : ''}</div>
        ${m.portfolio.length ? `<div class="portfolio">${m.portfolio.map((s, i) => `<div class="pf"><img src="${s}" alt=""><button class="pf-del" data-del="${i}" aria-label="Удалить фото">${icon('x')}</button></div>`).join('')}</div>` : '<p class="muted">Добавьте фото своих лучших работ. Это главный аргумент для клиентов.</p>'}
      </div>`,
      mount() {
        document.getElementById('awayT').addEventListener('change', e => { Store.updateMaster(m.id, { away: !e.target.checked }); U.toast(e.target.checked ? 'Вы снова принимаете заказы' : 'Заявки отключены, анкета помечена'); });
        const f = document.getElementById('profForm');
        f.about.addEventListener('input', () => { document.getElementById('aboutCnt').textContent = f.about.value.length + ' / 1500'; });
        f.addEventListener('submit', e => {
          e.preventDefault();
          const d = U.form(f);
          if (d.name.length < 2) return U.toast('Укажите имя', 'error');
          if (String(d.phone).replace(/\D/g, '').length < 10) return U.toast('Проверьте телефон', 'error');
          const patch = { ...d, experience: Math.max(0, Math.min(60, +d.experience || 0)), telegram: d.telegram.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '') };
          if (m.status === 'rejected') { patch.status = 'pending'; patch.statusReason = ''; }
          const u = Store.user();
          if (u.name !== d.name) Store.updateUser(u.id, { name: d.name });
          Store.updateMaster(m.id, patch).then(okk => { if (okk) U.toast(patch.status === 'pending' ? 'Сохранено и отправлено на проверку' : 'Анкета сохранена'); });
          App.render();
        });
        const busy = (el, on) => { const b = el.closest('label'); b.classList.toggle('is-busy', on); b.querySelector('span') && (b.querySelector('span').textContent = on ? 'Загружаем…' : b.dataset.label); };
        document.getElementById('avIn').addEventListener('change', async e => {
          const file = e.target.files[0];
          if (!file) return;
          busy(e.target, true);
          try {
            const url = await Store.uploadImage(await U.resizeImage(file, 400, 0.82), 'avatar');
            const old = m.avatar;
            if (await Store.updateMaster(m.id, { avatar: url })) { Store.removeImage(old); U.toast('Фото обновлено'); }
          } catch (err) { U.toast('Не удалось загрузить фото. Подойдут JPG, PNG или WEBP', 'error'); }
          App.render();
        });
        document.getElementById('avDel')?.addEventListener('click', async () => { const old = m.avatar; if (await Store.updateMaster(m.id, { avatar: null })) Store.removeImage(old); App.render(); });
        document.getElementById('pfIn')?.addEventListener('change', async e => {
          const files = [...e.target.files].slice(0, 8 - m.portfolio.length);
          if (!files.length) return;
          busy(e.target, true);
          const imgs = [];
          for (const file of files) { try { imgs.push(await Store.uploadImage(await U.resizeImage(file, 1200, 0.78), 'work')); } catch (err) {} }
          if (imgs.length) await Store.updateMaster(m.id, { portfolio: [...m.portfolio, ...imgs] });
          U.toast(imgs.length === files.length ? `Добавлено фото: ${imgs.length}` : `Загружено ${imgs.length} из ${files.length}. Остальные не подошли по формату`, imgs.length ? 'ok' : 'error');
          App.render();
        });
        document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
          const pf = [...m.portfolio], [gone] = pf.splice(+b.dataset.del, 1);
          Store.updateMaster(m.id, { portfolio: pf }); App.render();
          U.toast('Фото удалено', 'info', { action: 'Вернуть', onAction: () => { const cur = Store.master(m.id).portfolio; Store.updateMaster(m.id, { portfolio: [...cur.slice(0, +b.dataset.del), gone, ...cur.slice(+b.dataset.del)] }); App.render(); } });
        }));
      }
    };
  }

  function mServices(m) {
    const row = (s = {}) => `<div class="svc-row"><input class="input" name="name" placeholder="Название услуги" value="${esc(s.name || '')}" aria-label="Услуга"><input class="input" type="number" inputmode="numeric" min="0" step="50" name="price" placeholder="Цена, ₽" value="${s.price ?? ''}" aria-label="Цена"><input class="input" name="unit" placeholder="за: шт, час, м²" value="${esc(s.unit || '')}" aria-label="Единица"><button type="button" class="btn btn-ghost btn-icon btn-danger" data-rm aria-label="Удалить услугу">${icon('trash')}</button></div>`;
    return {
      html: `<div class="dash-head"><h1 class="h2">Услуги и цены</h1></div>
      <form class="card" id="svcForm">
        <p class="muted sm">Минимальная цена показывается в каталоге как «от … ₽». Указывайте реальные цены, клиенты это ценят.</p>
        <div class="svc-head muted sm"><span>Услуга</span><span>Цена, ₽</span><span>Единица</span><span></span></div>
        <div id="svcRows">${(m.services.length ? m.services : [{}]).map(row).join('')}</div>
        <div class="form-actions"><button type="button" class="btn" id="svcAdd">${icon('plus')} Добавить услугу</button><button class="btn btn-primary">${icon('check')} Сохранить</button></div>
      </form>`,
      mount() {
        const f = document.getElementById('svcForm'), rows = document.getElementById('svcRows');
        document.getElementById('svcAdd').addEventListener('click', () => {
          if (rows.children.length >= 20) return U.toast('Максимум 20 услуг', 'error');
          rows.insertAdjacentHTML('beforeend', row()); rows.lastElementChild.querySelector('input').focus();
        });
        rows.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { b.parentElement.remove(); if (!rows.children.length) rows.insertAdjacentHTML('beforeend', row()); } });
        f.addEventListener('submit', e => {
          e.preventDefault();
          const services = [...rows.children].map((r, i) => ({ id: m.id + 's' + Date.now().toString(36) + i, name: r.querySelector('[name=name]').value.trim(), price: Math.max(0, +r.querySelector('[name=price]').value || 0), unit: r.querySelector('[name=unit]').value.trim() || 'услуга' })).filter(s => s.name);
          if (services.some(s => !s.price)) return U.toast('Укажите цену для каждой услуги', 'error');
          Store.updateMaster(m.id, { services }).then(okk => { if (okk) U.toast('Услуги сохранены'); });
          App.render();
        });
      }
    };
  }

  function mRequests(m, u, reqs) {
    const order = { new: 0, accepted: 1, done: 2, declined: 3 };
    const list = [...reqs].sort((a, b) => order[a.status] - order[b.status] || b.date - a.date);
    return {
      html: `<div class="dash-head"><h1 class="h2">Заявки</h1><span class="muted">${reqs.length} всего</span></div>
      ${list.length ? `<div class="req-list">${list.map(r => `<div class="card req ${r.status === 'new' ? 'req-new' : ''}">
        <div class="req-top"><div><b>${esc(r.name)}</b> <span class="muted sm">${U.dateTime(r.date)}</span>${r.userId ? ` <span class="pill pill-muted">с аккаунтом</span>` : ''}</div>
          <select class="input input-sm" data-req="${r.id}" aria-label="Статус заявки">${Object.entries(C.REQ_STATUS).map(([k, [l]]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <p class="pre">${esc(r.text)}</p>
        ${r.when ? `<p class="muted sm">${icon('calendar')} ${esc(r.when)}</p>` : ''}
        <div class="req-actions"><a class="btn btn-sm btn-primary" href="tel:${esc(r.phone)}">${icon('phone')} ${esc(U.phone(r.phone))}</a></div>
      </div>`).join('')}</div>` : C.empty('Заявок пока нет', 'Заполните анкету полностью и подключите продвижение, чтобы получать больше заявок', '<a class="btn btn-primary" href="#/cabinet?tab=promo">Продвижение</a>', 'tray')}`,
      mount() {
        document.querySelectorAll('[data-req]').forEach(s => s.addEventListener('change', () => {
          const r = Store.requests(x => x.id === s.dataset.req)[0];
          Store.updateRequest(s.dataset.req, { status: s.value });
          U.toast(r?.userId ? 'Статус обновлён, клиент получит уведомление' : 'Статус обновлён'); App.render();
        }));
      }
    };
  }

  function mReviews(m) {
    const list = Store.reviews(r => r.masterId === m.id && r.status !== 'pending').sort((a, b) => b.date - a.date);
    const r = Store.rating(m.id);
    const disputed = new Set(Store.reports(x => x.type === 'review' && x.userId === m.userId && x.status === 'open').map(x => x.targetId));
    return {
      html: `<div class="dash-head"><h1 class="h2">Отзывы</h1>${r.count ? `<span class="rating">${icon('star', 'ic-star')}<b>${r.avg.toFixed(1)}</b><span class="muted">${r.count}</span></span>` : ''}</div>
      <p class="muted">Отвечайте на отзывы: клиенты видят, что вы на связи. Несправедливый отзыв можно оспорить, его проверит модератор.</p>
      ${list.length ? list.map(x => `<div class="card rv">
        <div class="rv-head"><div><b>${esc(x.author)}</b><div class="muted sm">${U.date(x.date)}</div></div>${C.stars(x.rating)}${x.status !== 'published' ? C.pill(C.REVIEW_STATUS, x.status) : ''}</div>
        <p>${esc(x.text)}</p>
        ${x.status === 'published' ? `<form class="reply-form" data-rv="${x.id}"><textarea class="input" name="reply" rows="2" maxlength="600" placeholder="Ваш ответ клиенту">${esc(x.reply)}</textarea><button class="btn btn-sm">${x.reply ? 'Обновить ответ' : 'Ответить'}</button></form>
        <div class="rv-tools">${disputed.has(x.id) ? `<span class="pill pill-warn">Оспаривается</span>` : `<button class="link-muted" data-dispute="${x.id}">${icon('flag')} Оспорить отзыв</button>`}</div>` : x.hideReason ? `<p class="muted sm">Скрыт модератором: ${esc(x.hideReason)}</p>` : ''}
      </div>`).join('') : C.empty('Отзывов пока нет', 'Попросите довольных клиентов оставить отзыв на вашей странице', '', 'star')}`,
      mount() {
        document.querySelectorAll('[data-rv]').forEach(f => f.addEventListener('submit', e => {
          e.preventDefault();
          Store.replyReview(f.dataset.rv, f.reply.value.trim());
          U.toast('Ответ сохранён');
        }));
        document.querySelectorAll('[data-dispute]').forEach(b => b.addEventListener('click', () => P.report('review', b.dataset.dispute)));
      }
    };
  }

  function mPromo(m) {
    const s = Store.settings();
    const pays = Store.payments().filter(p => p.masterId === m.id).sort((a, b) => b.date - a.date);
    const until = (ts, on) => on ? `<span class="pill pill-ok">Активно до ${U.date(ts)}</span>` : '';
    const plan = (type, title, ic, desc, active, extra, per) => `<div class="plan ${active ? 'plan-on' : ''}">
      <div class="plan-ic">${icon(ic, 'fill')}</div><h3 class="h3">${title}</h3>${extra}
      <p class="muted sm">${desc}</p>
      <div class="plan-price"><b>0 ₽</b><span class="muted">${per}</span></div>
      <button class="btn ${type === 'top' ? 'btn-primary' : ''} btn-block" data-ask="${type}" ${(type === 'verify' && m.verified) || m.status !== 'approved' ? 'disabled' : ''}>${type === 'verify' && m.verified ? 'Уже подтверждено' : active ? 'Попросить продлить' : 'Запросить'}</button></div>`;
    return {
      html: `<div class="dash-head"><h1 class="h2">Продвижение</h1></div>
      ${m.status !== 'approved' ? '<div class="banner banner-warn">Продвижение можно запросить после публикации анкеты.</div>' : '<p class="muted">На старте площадки продвижение бесплатное. Нажмите «Запросить», администрация получит заявку и подключит его.</p>'}
      <div class="plans plans-3">
        ${plan('top', 'Топ категории', 'zap', 'Ваша анкета показывается первой в своей категории и городе.', Store.isTop(m), until(m.topUntil, Store.isTop(m)), `/ ${s.days.top} дн.`)}
        ${plan('premium', 'Премиум', 'crown', 'Показ на главной, выделенная карточка и значок «Премиум».', Store.isPremium(m), until(m.premiumUntil, Store.isPremium(m)), `/ ${s.days.premium} дн.`)}
        ${plan('verify', 'Проверенный мастер', 'shield', 'Модератор проверит документы. Значок доверия и фильтр «Только проверенные».', m.verified, m.verified ? '<span class="pill pill-ok">Подтверждено</span>' : '', 'разово')}
      </div>
      <div class="card"><h2 class="h3">История подключений</h2>
        ${pays.length ? C.table([['Дата'], ['Услуга'], ['Статус']], pays.map(p => [U.dateTime(p.date), C.PAY_TYPE[p.type] + (p.days ? `, ${p.days} дн.` : ''), p.status === 'refunded' ? '<span class="pill pill-muted">Отменено</span>' : '<span class="pill pill-ok">Подключено</span>'])) : '<p class="muted">Пока ничего не подключали.</p>'}
      </div>`,
      mount() {
        document.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', async () => {
          b.disabled = true;
          const r = await Store.requestPromo(b.dataset.ask);
          if (r.error) { b.disabled = false; return U.toast(r.error, 'error'); }
          b.textContent = 'Заявка отправлена';
          U.toast('Заявка отправлена. Администрация подключит продвижение и пришлёт уведомление');
        }));
      }
    };
  }

  // ================= Кабинет пользователя
  function clientCab(u, tab) {
    const reqs = Store.requests(r => r.userId === u.id);
    const tabs = [['requests', 'Мои заявки', 'inbox'], ['favorites', 'Избранное', 'heart', (u.favs || []).length], ['reviews', 'Мои отзывы', 'star'], ['account', 'Аккаунт', 'settings']];
    const T = {
      requests: () => ({
        html: `<div class="dash-head"><h1 class="h2">Мои заявки</h1></div>
        ${reqs.length ? `<div class="req-list">${reqs.sort((a, b) => b.date - a.date).map(r => { const m = Store.master(r.masterId); return `<div class="card req"><div class="req-top"><div class="req-to">${m ? C.avatar(m, 'sm') : ''}<div><a class="link" href="#/m/${r.masterId}"><b>${esc(m?.name || 'Мастер удалён')}</b></a><div class="muted sm">${U.dateTime(r.date)}</div></div></div>${C.pill(C.REQ_STATUS, r.status)}</div><p class="pre">${esc(r.text)}</p>${r.status === 'done' && m && !Store.reviews(x => x.masterId === m.id && x.userId === u.id).length ? `<a class="btn btn-sm" href="#/m/${m.id}">${icon('star')} Оставить отзыв</a>` : ''}</div>`; }).join('')}</div>`
          : C.empty('Заявок пока нет', 'Найдите мастера в каталоге и оставьте заявку прямо на его странице', '<a class="btn btn-primary" href="#/catalog">В каталог</a>', 'tray')}`
      }),
      favorites: () => {
        const list = (u.favs || []).map(Store.master).filter(Store.isVisible);
        return { html: `<div class="dash-head"><h1 class="h2">Избранное</h1></div>${list.length ? `<div class="grid-cards">${list.map(C.card).join('')}</div>` : C.empty('Пока пусто', 'Нажимайте на сердечко в карточке мастера, чтобы сохранить его', '<a class="btn btn-primary" href="#/catalog">В каталог</a>', 'heart')}` };
      },
      reviews: () => {
        const list = Store.reviews(r => r.userId === u.id).sort((a, b) => b.date - a.date);
        return {
          html: `<div class="dash-head"><h1 class="h2">Мои отзывы</h1></div>${list.length ? list.map(r => { const m = Store.master(r.masterId); return `<div class="card rv"><div class="rv-head"><div><a class="link" href="#/m/${r.masterId}"><b>${esc(m?.name || '')}</b></a><div class="muted sm">${U.date(r.date)}${r.edited ? ', изменён' : ''}</div></div>${C.stars(r.rating)}${C.pill(C.REVIEW_STATUS, r.status)}</div><p>${esc(r.text)}</p>${r.hideReason && r.status === 'hidden' ? `<p class="muted sm">Причина: ${esc(r.hideReason)}</p>` : ''}${r.reply ? `<div class="rv-reply"><b>Ответ мастера</b><p>${esc(r.reply)}</p></div>` : ''}<div class="rv-tools">${r.status !== 'hidden' ? `<button class="btn btn-sm btn-ghost" data-edrv="${r.id}">${icon('edit')} Изменить</button>` : ''}<button class="btn btn-sm btn-ghost btn-danger" data-delrv="${r.id}">${icon('trash')} Удалить</button></div></div>`; }).join('') : C.empty('Вы ещё не оставляли отзывов', 'После работы мастера оставьте отзыв на его странице', '', 'star')}`,
          mount() {
            document.querySelectorAll('[data-delrv]').forEach(b => b.addEventListener('click', async () => {
              if (await U.confirm('Удалить отзыв? Восстановить его будет нельзя.', 'Удалить')) { Store.deleteReview(b.dataset.delrv); U.toast('Отзыв удалён'); App.render(); }
            }));
            document.querySelectorAll('[data-edrv]').forEach(b => b.addEventListener('click', () => editReview(Store.review(b.dataset.edrv))));
          }
        };
      },
      account: () => P.account(u)
    };
    const key = T[tab] ? tab : 'requests';
    const t = T[key]();
    return { title: 'Личный кабинет', html: C.dash('/cabinet', tabs, key, 'Личный кабинет', C.restrictBanner(u) + t.html), mount: t.mount };
  }

  function editReview(r) {
    U.modal({
      title: 'Изменить отзыв',
      body: `<form id="edForm"><div class="star-input" role="radiogroup" aria-label="Оценка">${[5, 4, 3, 2, 1].map(i => `<input type="radio" name="rating" id="es${i}" value="${i}" ${i === r.rating ? 'checked' : ''}><label for="es${i}" title="${i} из 5">${icon('star', 'fill')}</label>`).join('')}</div>
        <label class="fld mt"><span>Текст</span><textarea class="input" name="text" rows="4" maxlength="1000">${esc(r.text)}</textarea></label>
        ${Store.settings().reviewPremod ? '<p class="muted sm">После изменения отзыв снова пройдёт проверку.</p>' : ''}
        <button class="btn btn-primary btn-block">Сохранить</button></form>`,
      onMount(el, close) {
        el.querySelector('#edForm').addEventListener('submit', e => {
          e.preventDefault();
          const d = U.form(e.target);
          if ((d.text || '').length < 10) return U.toast('Напишите хотя бы пару предложений', 'error');
          Store.editReview(r.id, { rating: +d.rating, text: d.text });
          close(); U.toast('Отзыв обновлён'); App.render();
        });
      }
    });
  }

  // ================= Аккаунт (общий для всех ролей)
  P.account = u => ({
    html: `<div class="dash-head"><h1 class="h2">Аккаунт</h1>${C.rolePill(u.role)}</div>
      <form class="card" id="accForm"><h2 class="h3">Личные данные</h2>
        <div class="row"><label class="fld"><span>Имя</span><input class="input" name="name" required value="${esc(u.name)}"></label>
        <label class="fld"><span>Телефон</span><input class="input" type="tel" name="phone" value="${esc(u.phone || '')}" placeholder="Подставляется в заявки"></label></div>
        <label class="fld"><span>Email</span><input class="input" value="${esc(u.email)}" disabled></label>
        <button class="btn btn-primary">Сохранить</button></form>
      <form class="card" id="pwForm"><h2 class="h3">Смена пароля</h2>
        <div class="row"><label class="fld"><span>Текущий пароль</span><input class="input" type="password" name="old" required autocomplete="current-password"></label>
        <label class="fld"><span>Новый пароль, от 6 символов</span><input class="input" type="password" name="pw" required minlength="6" autocomplete="new-password"></label></div>
        <button class="btn">Изменить пароль</button></form>
      ${u.role !== 'owner' ? `<div class="card card-danger"><h2 class="h3">Удаление аккаунта</h2><p class="muted sm">${u.role === 'master' ? 'Удалится анкета, услуги, фото, заявки и отзывы о вас.' : 'Ваши отзывы останутся, но без привязки к аккаунту.'} Действие необратимо.</p><button class="btn btn-danger" id="delAcc">${icon('trash')} Удалить аккаунт</button></div>` : ''}`,
    mount() {
      document.getElementById('accForm').addEventListener('submit', e => { e.preventDefault(); const d = U.form(e.target); if (d.name.length < 2) return U.toast('Укажите имя', 'error'); Store.updateUser(u.id, { name: d.name, phone: d.phone }).then(okk => { if (okk) U.toast('Сохранено'); }); App.render(); });
      document.getElementById('pwForm').addEventListener('submit', async e => {
        e.preventDefault();
        const d = U.form(e.target);
        if (d.pw.length < 6) return U.toast('Новый пароль должен быть не короче 6 символов', 'error');
        const b = e.target.querySelector('button'); b.disabled = true;
        const r = await Store.changePassword(d.old, d.pw);
        b.disabled = false;
        if (r.error) return U.toast(r.error, 'error');
        e.target.reset(); U.toast('Пароль изменён');
      });
      document.getElementById('delAcc')?.addEventListener('click', async () => {
        if (!(await U.confirm('Удалить аккаунт навсегда? Это действие нельзя отменить.', 'Удалить навсегда'))) return;
        if (await Store.deleteUser(u.id)) { U.toast('Аккаунт удалён', 'info'); App.go('#/'); }
      });
    }
  });
})();
