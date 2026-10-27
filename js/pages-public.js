(() => {
  const { esc, icon, money, link, plural } = U;
  const P = window.Pages = window.Pages || {};

  // ---------- Подсказки поиска: категории, услуги, мастера
  function hl(text, q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (!q || i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  function buildSuggest(q) {
    const cats = Store.categories(), counts = Store.catCounts();
    const it = (data, ic, title, meta) => `<button type="button" class="sg-it" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}><span class="sg-ic">${ic}</span><span class="sg-t">${title}</span>${meta ? `<span class="sg-m">${meta}</span>` : ''}</button>`;
    const mastersN = n => `${n} ${plural(n, 'мастер', 'мастера', 'мастеров')}`;
    if (!q) return `<div class="sg-h">Популярные категории</div>` + [...cats].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).slice(0, 6).map(c => it({ cat: c.id }, C.catIcon(c), esc(c.name), mastersN(counts[c.id] || 0))).join('');
    const ql = q.toLowerCase(), all = Store.search({});
    const cs = cats.filter(c => c.name.toLowerCase().includes(ql)).slice(0, 4);
    const svc = {};
    all.forEach(m => m.services.forEach(s => { if (s.name.toLowerCase().includes(ql)) svc[s.name] = (svc[s.name] || 0) + 1; }));
    const ss = Object.entries(svc).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const ms = all.filter(m => m.name.toLowerCase().includes(ql)).slice(0, 3);
    let h = '';
    if (cs.length) h += `<div class="sg-h">Категории</div>` + cs.map(c => it({ cat: c.id }, C.catIcon(c), hl(c.name, q), mastersN(counts[c.id] || 0))).join('');
    if (ss.length) h += `<div class="sg-h">Услуги</div>` + ss.map(([n, k]) => it({ q: n }, icon('tag'), hl(n, q), mastersN(k))).join('');
    if (ms.length) h += `<div class="sg-h">Мастера</div>` + ms.map(m => it({ m: m.id }, C.avatar(m, 'xs'), hl(m.name, q), esc(m.city))).join('');
    return h || `<div class="sg-none">${icon('magnifying-glass')} Точных совпадений нет. Нажмите Enter, чтобы поискать по описаниям мастеров</div>`;
  }
  P.searchSuggest = (input, anchor, onPick) => UI.suggest(input, { anchor, build: buildSuggest, onPick });

  // ---------- Главная
  P.home = () => {
    const s = Store.settings(), cats = Store.categories(), counts = Store.catCounts(), cityCounts = Store.cityCounts(), st = Store.stats();
    let featured = Store.search({}).filter(Store.isPremium);
    if (featured.length < 8) featured = featured.concat(Store.search({ sort: 'rating' }).filter(m => !featured.includes(m)));
    featured = featured.slice(0, 8);
    const stage = Store.search({ sort: 'rating' }).filter(m => m.avatar && !m.away && Store.rating(m.id).count >= 3).slice(0, 3);
    const reviews = Store.latestReviews(9);
    const bento = [...cats].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    const cities = [...s.cities].sort((a, b) => (cityCounts[b] || 0) - (cityCounts[a] || 0)).filter(c => cityCounts[c]);
    const reqs = Store.requests(r => Store.isVisible(Store.master(r.masterId))).sort((a, b) => b.date - a.date).slice(0, 6).map(r => {
      const m = Store.master(r.masterId);
      return { name: r.name.split(' ')[0], cat: Store.cat(m?.categoryId)?.name || 'Услуги', city: m?.city || '' };
    });
    const mini = (m, i) => {
      const c = Store.cat(m.categoryId), r = Store.rating(m.id);
      return `<a class="stage-card sc-${i}" href="#/m/${m.id}" tabindex="-1">${C.avatar(m, 'md')}<div class="sc-body"><b>${esc(m.name)}</b><span class="sc-cat">${C.catIcon(c)}${esc(c.name)}</span>
        <div class="sc-row"><span class="rating">${icon('star', 'ic-star')}<b>${r.avg.toFixed(1)}</b></span><span class="muted">${esc(m.city)}</span><span class="sc-price">от ${money(Store.priceFrom(m))}</span></div></div></a>`;
    };
    const mqCities = cities.length >= 6 ? cities : s.cities;
    const marquee = mqCities.map(c => `<a href="${link('/catalog', { city: c })}">${esc(c)}${cityCounts[c] ? `<sup>${cityCounts[c]}</sup>` : ''}</a>`).join('<i class="mq-sep"></i>');
    const big = st.masters >= 10;
    const stageHtml = stage.length >= 2 ? stage.map(mini).join('') : bento.slice(0, 6).map((c, i) => `<a class="stage-chip sx-${i}" href="${link('/catalog', { cat: c.id })}" tabindex="-1">${C.catIcon(c)}<span>${esc(c.name)}</span></a>`).join('');
    return {
      title: `${s.siteName}: мастера и услуги ${s.regionIn}`,
      html: `
<section class="hero">
  <div class="aurora" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="wrap hero-in">
    <div class="hero-copy">
      <span class="eyebrow" data-reveal>${icon('pin', 'fill')} ${esc(s.region)}</span>
      <h1 class="h1" data-reveal>Мастера Кузбасса. <span class="grad">Проверенные отзывами.</span></h1>
      <p class="lead" data-reveal>${big ? `${st.masters} ${plural(st.masters, 'мастер', 'мастера', 'мастеров')} в ${st.cities} ${plural(st.cities, 'городе', 'городах', 'городах')} области. Сравнивайте цены и отзывы, звоните напрямую.` : 'Мастера и услуги во всех городах области. Сравнивайте цены и отзывы, звоните напрямую, без посредников.'}</p>
      <form class="hero-search" id="heroSearch" data-reveal role="search">
        <div class="input-ic grow">${icon('search')}<input class="input input-lg" type="search" name="q" placeholder="Кого ищете?" aria-label="Что ищете"></div>
        <div class="hs-sel">${C.citySelect('city', '', 'Вся область', cityCounts)}</div>
        <button class="btn btn-primary btn-lg">Найти мастера</button>
      </form>
    </div>
    <div class="stage" aria-hidden="true">
      <div class="stage-ring"></div>
      ${stageHtml}
      ${reqs.length ? `<div class="stage-note" id="stageNote"><span class="sn-ic">${icon('inbox', 'fill')}</span><div><b>Новая заявка</b><span id="snText">${esc(`${reqs[0].name}: ${reqs[0].cat}, ${reqs[0].city}`)}</span></div></div>` : ''}
      ${st.reviews >= 10 ? `<div class="stage-stat"><b data-count="${st.reviews}">0</b><span>отзывов</span></div>` : `<div class="stage-stat"><b>0%</b><span>комиссии</span></div>`}
    </div>
  </div>
</section>

<div class="marquee"><div class="mq-track">${marquee}<i class="mq-sep"></i>${marquee}<i class="mq-sep"></i></div></div>

${big ? `<section class="wrap numbers">
  ${[[st.masters, 0, '', 'мастеров в каталоге'], [st.reviews, 0, '', 'отзывов клиентов'], [st.avg.toFixed(1), 1, '', 'средняя оценка'], [0, 0, '%', 'комиссия с заказов']].map(([n, dec, suf, l]) => `<div data-reveal><b><span data-count="${n}" data-dec="${dec}">0</span>${suf}</b><span>${l}</span></div>`).join('')}
</section>` : ''}

<section class="wrap sec">
  <div class="sec-head"><h2 class="h2">Категории услуг</h2><a class="link" href="#/catalog">Весь каталог ${icon('arrow')}</a></div>
  <div class="bento">${bento.map((c, i) => { const n = counts[c.id] || 0; return `<a class="tile spot ${i < 2 ? 'tile-xl tile-' + i : ''}" href="${link('/catalog', { cat: c.id })}" data-reveal style="--d:${i * 35}ms">
    <span class="tile-ic">${C.catIcon(c)}</span><span class="tile-name">${esc(c.name)}</span><span class="tile-n">${n} ${plural(n, 'мастер', 'мастера', 'мастеров')}</span>${i < 2 ? `<span class="tile-go">${icon('up')}</span>` : ''}</a>`; }).join('')}</div>
</section>

<section class="wrap sec">
  <div class="sec-head"><h2 class="h2">Рекомендуемые мастера</h2><a class="link" href="#/catalog">Смотреть всех ${icon('arrow')}</a></div>
  ${featured.length ? `<div class="grid-cards">${featured.map(C.card).join('')}</div>` : `<div class="start-card" data-reveal><div class="start-ic">${icon('wrench', 'fill')}</div><div><h3 class="h3">Каталог только открылся</h3><p class="muted">Первые мастера получают больше внимания клиентов. Размещение бесплатное.</p></div><a class="btn btn-primary" href="#/register?role=master">Разместить анкету</a></div>`}
</section>

<section class="wrap sec how">
  <div class="how-head"><h2 class="h2">Мастер за три шага</h2><p class="muted">Без посредников и без комиссии. Регистрация нужна только для отзывов.</p><a class="btn btn-primary" href="#/catalog">Открыть каталог</a></div>
  <ol class="how-steps">
    <li data-reveal><span class="how-ic">${icon('search', 'fill')}</span><div><h3 class="h3">Найдите</h3><p class="muted">Фильтр по городу, категории, цене и рейтингу. Отзывы и фото работ на странице мастера.</p></div></li>
    <li data-reveal><span class="how-ic">${icon('phone', 'fill')}</span><div><h3 class="h3">Свяжитесь</h3><p class="muted">Позвоните, напишите в Telegram или оставьте заявку. Мастер увидит её в кабинете.</p></div></li>
    <li data-reveal><span class="how-ic">${icon('star', 'fill')}</span><div><h3 class="h3">Оцените</h3><p class="muted">Ваш отзыв поднимает лучших мастеров выше в каталоге.</p></div></li>
  </ol>
</section>

${reviews.length ? `<section class="wrap sec"><div class="sec-head"><h2 class="h2">Что пишут клиенты</h2></div><div class="masonry">${reviews.map(r => {
        const m = Store.master(r.masterId);
        return `<figure class="quote" data-reveal>${C.stars(r.rating)}<blockquote>«${esc(r.text)}»</blockquote><figcaption>${C.avatar(m, 'sm')}<span><b>${esc(r.author)}</b> о мастере <a class="link" href="#/m/${m.id}">${esc(m.name)}</a><small>${esc(Store.cat(m.categoryId)?.name || '')}, ${esc(m.city)}</small></span></figcaption></figure>`;
      }).join('')}</div></section>` : ''}

<section class="wrap sec">
  <div class="cta" data-reveal>
    <div class="cta-orb" aria-hidden="true"></div>
    <h2 class="cta-title">Вы мастер? Клиенты ${esc(s.regionIn)} уже ищут вас.</h2>
    <p>Анкета бесплатно. Клиенты звонят напрямую, комиссии нет.</p>
    <div class="cta-actions"><a class="btn btn-primary btn-lg" href="#/register?role=master">Разместить анкету</a><a class="btn btn-lg btn-glass" href="#/pricing">Тарифы</a></div>
  </div>
</section>`,
      mount() {
        const f = document.getElementById('heroSearch');
        const go = q => { location.hash = link('/catalog', { q, city: f.city.value }); };
        f.addEventListener('submit', e => { e.preventDefault(); go(f.q.value.trim()); });
        P.searchSuggest(f.q, f, d => {
          if (d.m) location.hash = '#/m/' + d.m;
          else if (d.cat) location.hash = link('/catalog', { cat: d.cat, city: f.city.value });
          else go(d.q);
        });
        if (reqs.length < 2 || !document.getElementById('stageNote') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const note = document.getElementById('stageNote'), txt = document.getElementById('snText');
        let i = 0;
        const t = setInterval(() => {
          note.classList.add('swap');
          setTimeout(() => { i = (i + 1) % reqs.length; const r = reqs[i]; txt.textContent = `${r.name}: ${r.cat}, ${r.city}`; note.classList.remove('swap'); }, 380);
        }, 3600);
        return () => clearInterval(t);
      }
    };
  };

  // ---------- Каталог
  P.catalog = (p, q) => {
    const st = { q: q.q || '', cat: q.cat || '', city: q.city || '', rating: q.rating || '', verified: q.verified || '', open: q.open || '', price: q.price || '', sort: q.sort || 'rec', page: +q.page || 1 };
    const s = Store.settings(), PER = 12;
    const prices = Store.search({}).map(Store.priceFrom).filter(x => x != null);
    const PMIN = 100, PMAX = Math.max(1000, Math.ceil(Math.max(0, ...prices) / 500) * 500);
    const SORTS = [['rec', 'Рекомендуемые'], ['rating', 'По рейтингу'], ['reviews', 'По числу отзывов'], ['price_asc', 'Сначала дешевле'], ['price_desc', 'Сначала дороже'], ['new', 'Новые']];
    const RATINGS = [['', 'Любой'], ['4.5', '4,5+'], ['4', '4+'], ['3.5', '3,5+']];
    const find = () => Store.search({ q: st.q, cat: st.cat, city: st.city, minRating: +st.rating || 0, verified: st.verified === '1', open: st.open === '1', priceMax: +st.price || 0, sort: st.sort });
    const url = patch => link('/catalog', { ...st, sort: st.sort === 'rec' ? '' : st.sort, page: '', ...patch });
    const priceLabel = () => st.price ? 'до ' + money(+st.price) : 'Любая';

    function active() {
      const c = st.cat && Store.cat(st.cat);
      return [st.q && [`«${st.q}»`, { q: '' }], st.city && [st.city, { city: '' }], c && [c.name, { cat: '' }], st.rating && [`Рейтинг ${st.rating.replace('.', ',')}+`, { rating: '' }],
        st.price && [`До ${money(+st.price)}`, { price: '' }], st.verified && ['Проверенные', { verified: '' }], st.open && ['Принимают заказы', { open: '' }]].filter(Boolean);
    }
    function results() {
      const list = find();
      const pages = Math.max(1, Math.ceil(list.length / PER));
      if (st.page > pages) st.page = pages;
      const slice = list.slice((st.page - 1) * PER, st.page * PER);
      const c = st.cat && Store.cat(st.cat), af = active();
      const title = (c ? c.name : 'Все мастера') + (st.city ? `, ${st.city}` : '');
      const pager = pages < 2 ? '' : `<nav class="pager" aria-label="Страницы">
        <button class="btn btn-sm btn-icon" data-page="${st.page - 1}" ${st.page === 1 ? 'disabled' : ''} aria-label="Назад">${icon('left')}</button>
        ${Array.from({ length: pages }, (_, i) => `<button class="btn btn-sm ${i + 1 === st.page ? 'btn-primary' : ''}" data-page="${i + 1}" ${i + 1 === st.page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}
        <button class="btn btn-sm btn-icon" data-page="${st.page + 1}" ${st.page === pages ? 'disabled' : ''} aria-label="Вперёд">${icon('right')}</button></nav>`;
      const emptyAct = [st.city && `<a class="btn btn-primary" href="${url({ city: '' })}">Искать по всей области</a>`, af.length && `<button class="btn" data-act="reset-filters">Сбросить фильтры</button>`].filter(Boolean).join('');
      return `<div class="res-head"><div><h1 class="h2">${c ? C.catIcon(c, 'h-ic') + ' ' : ''}${esc(title)}</h1><p class="muted">${list.length ? `Найдено ${list.length} ${plural(list.length, 'мастер', 'мастера', 'мастеров')}` : 'Ничего не найдено'}</p></div>
        <div class="res-tools"><button class="btn btn-sm only-m" data-act="toggle-filters">${icon('sliders')} Фильтры${af.length ? `<span class="dot-n">${af.length}</span>` : ''}</button>
        <select class="input input-sm" id="sortSel" aria-label="Сортировка">${SORTS.map(([v, l]) => `<option value="${v}" ${v === st.sort ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        ${af.length ? `<div class="af">${af.map(([l, patch]) => `<a class="af-chip" href="${url(patch)}" aria-label="Убрать фильтр ${esc(l)}">${esc(l)}${icon('x')}</a>`).join('')}${af.length > 1 ? `<a class="link sm" href="#/catalog">Сбросить всё</a>` : ''}</div>` : ''}
        ${slice.length ? `<div class="grid-cards">${slice.map(C.card).join('')}</div>` : C.empty('Никого не нашли', st.city ? `В городе ${st.city} нет мастеров с такими условиями. Попробуйте соседний город или всю область` : 'Попробуйте изменить или сбросить фильтры', emptyAct)}
        ${pager}`;
    }

    return {
      title: `Каталог мастеров ${s.regionIn}: ${s.siteName}`,
      html: `<div class="wrap catalog">
        <aside class="filters" id="filtersBox" aria-label="Фильтры"><form id="filters" autocomplete="off">
          <div class="filters-head"><h3 class="h3">Фильтры</h3><button type="button" class="link sm" data-act="reset-filters">Сбросить</button><button type="button" class="btn btn-ghost btn-sm btn-icon only-m" data-act="toggle-filters" aria-label="Закрыть">${icon('x')}</button></div>
          <label class="fld"><span>Поиск</span><div class="input-ic">${icon('search')}<input class="input" type="search" name="q" value="${esc(st.q)}" placeholder="Имя или услуга"></div></label>
          <label class="fld"><span>Город</span>${C.citySelect('city', st.city, 'Вся область', Store.cityCounts())}</label>
          <label class="fld"><span>Категория</span>${C.catSelect('cat', st.cat, 'Все категории', Store.catCounts())}</label>
          <fieldset class="fld"><legend>Рейтинг</legend><div class="rate-seg">
            ${RATINGS.map(([v, l]) => `<label><input type="radio" name="rating" value="${v}" ${st.rating === v ? 'checked' : ''}><span>${v ? icon('star', 'fill') : ''}${l}</span></label>`).join('')}
          </div></fieldset>
          <div class="fld"><span>Цена услуг <b class="range-val" id="priceVal">${priceLabel()}</b></span>
            <div class="range"><input type="range" name="price" min="${PMIN}" max="${PMAX}" step="100" value="${st.price || PMAX}" aria-label="Максимальная цена"><div class="range-scale"><span>${money(PMIN)}</span><span>${money(PMAX)}</span></div></div>
            <div class="chips chips-xs">${[1000, 2000, 5000].filter(v => v < PMAX).map(v => `<button type="button" class="chip" data-price="${v}">до ${money(v)}</button>`).join('')}<button type="button" class="chip" data-price="${PMAX}">Любая</button></div></div>
          <label class="toggle"><input type="checkbox" name="verified" value="1" ${st.verified === '1' ? 'checked' : ''}><span class="toggle-ui"></span><span>Только проверенные</span></label>
          <label class="toggle"><input type="checkbox" name="open" value="1" ${st.open === '1' ? 'checked' : ''}><span class="toggle-ui"></span><span>Сейчас принимают заказы</span></label>
          <div class="filters-foot only-m"><button type="button" class="btn btn-primary btn-block" data-act="toggle-filters" id="showBtn">Показать</button></div>
        </form></aside>
        <section class="results" id="results">${results()}</section></div>`,
      mount() {
        const form = document.getElementById('filters'), box = document.getElementById('results');
        const range = form.price, pv = document.getElementById('priceVal'), show = document.getElementById('showBtn');
        const count = () => { const n = find().length; show.textContent = n ? `Показать ${n} ${plural(n, 'мастера', 'мастеров', 'мастеров')}` : 'Никого не найдено'; };
        const sync = () => {
          history.replaceState(null, '', url({ page: st.page > 1 ? st.page : '' }));
          box.innerHTML = results();
          UI.enhance(box); FX.run(box); count();
        };
        const read = () => {
          const d = U.form(form), price = +d.price;
          Object.assign(st, { q: d.q || '', cat: d.cat || '', city: d.city || '', rating: d.rating || '', verified: d.verified ? '1' : '', open: d.open ? '1' : '', price: price >= PMAX ? '' : String(price), page: 1 });
          pv.textContent = priceLabel();
          sync();
        };
        const later = U.debounce(read, 220);
        range.addEventListener('input', () => { pv.textContent = +range.value >= PMAX ? 'Любая' : 'до ' + money(+range.value); later(); });
        form.addEventListener('input', e => { if (e.target !== range) later(); });
        form.addEventListener('change', read);
        form.addEventListener('submit', e => e.preventDefault());
        form.addEventListener('click', e => {
          const b = e.target.closest('[data-price]');
          if (!b) return;
          range.value = b.dataset.price;
          range.dispatchEvent(new Event('input'));
          read();
        });
        P.searchSuggest(form.q, form.q.parentElement, d => {
          if (d.m) return void (location.hash = '#/m/' + d.m);
          if (d.cat) { form.q.value = ''; form.cat.value = d.cat; form.cat.dispatchEvent(new Event('change', { bubbles: true })); }
          else { form.q.value = d.q; read(); }
        });
        box.addEventListener('change', e => { if (e.target.id === 'sortSel') { st.sort = e.target.value; st.page = 1; sync(); } });
        box.addEventListener('click', e => {
          const b = e.target.closest('[data-page]');
          if (!b || b.disabled) return;
          st.page = +b.dataset.page;
          sync();
          box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        count();
      }
    };
  };

  // ---------- Жалоба
  P.report = (type, targetId) => {
    const u = Store.user();
    if (!u) return U.toast('Войдите, чтобы отправить жалобу', 'info', { action: 'Войти', onAction: () => { location.hash = link('/login', { next: location.hash.slice(1) }); } });
    U.modal({
      title: type === 'review' ? 'Жалоба на отзыв' : 'Жалоба на анкету',
      body: `<form id="repForm"><p class="muted">Модератор проверит жалобу. Результат придёт в уведомления. Автор жалобы не раскрывается.</p>
        <div class="radio-list">${Store.REPORT_REASONS[type].map((r, i) => `<label class="radio-it"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? 'checked' : ''}><span>${esc(r)}</span></label>`).join('')}</div>
        <label class="fld"><span>Подробности</span><textarea class="input" name="text" rows="3" placeholder="Что именно не так? Это поможет разобраться быстрее"></textarea></label>
        <button class="btn btn-primary btn-block">${icon('flag')} Отправить жалобу</button></form>`,
      onMount(el, close) {
        el.querySelector('#repForm').addEventListener('submit', async e => {
          e.preventDefault();
          const d = U.form(e.target);
          if (d.reason === 'Другое' && (d.text || '').length < 5) return U.toast('Опишите, что случилось', 'error');
          const b = e.target.querySelector('button'); b.disabled = true;
          const r = await Store.addReport({ type, targetId, reason: d.reason, text: d.text });
          b.disabled = false;
          if (r.error) return U.toast(r.error, 'error');
          close();
          U.toast('Жалоба отправлена модераторам');
        });
      }
    });
  };

  // ---------- Заявка мастеру
  P.openRequest = m => {
    const u = Store.user();
    const lim = u && Store.limit(u, 'requests');
    if (lim) return U.toast(`Вам запрещено отправлять заявки ${Store.until(lim.until)}`, 'error');
    if (m.away) return U.toast('Мастер сейчас не принимает заказы', 'info');
    U.modal({
      title: 'Заявка мастеру',
      body: `<div class="req-to">${C.avatar(m, 'sm')}<div><b>${esc(m.name)}</b><div class="muted sm">${esc(Store.cat(m.categoryId)?.name || '')}, ${esc(m.city)}</div></div></div>
      <form id="reqForm">
        <div class="row">
          <label class="fld"><span>Ваше имя</span><input class="input" name="name" required value="${esc(u?.name || '')}" autocomplete="name"></label>
          <label class="fld"><span>Телефон</span><input class="input" name="phone" type="tel" required placeholder="+7 900 000-00-00" value="${esc(u?.phone || '')}" autocomplete="tel"></label>
        </div>
        <label class="fld"><span>Что нужно сделать</span><textarea class="input" name="text" required minlength="10" placeholder="Опишите задачу: объём работ, адрес или район, пожелания"></textarea></label>
        <label class="fld"><span>Когда удобно</span><input class="input" name="when" placeholder="Например: в субботу после 12:00"></label>
        <button class="btn btn-primary btn-block">${icon('send')} Отправить заявку</button>
        <p class="muted sm center mt">${u ? 'Статус заявки будет виден в кабинете.' : 'Войдите, чтобы видеть статус заявки в кабинете.'} Мастер свяжется с вами по телефону.</p>
      </form>`,
      onMount(el, close) {
        el.querySelector('#reqForm').addEventListener('submit', async e => {
          e.preventDefault();
          const d = U.form(e.target);
          if (String(d.phone).replace(/\D/g, '').length < 10) return U.toast('Проверьте номер телефона', 'error');
          if (d.text.length < 10) return U.toast('Опишите задачу подробнее', 'error');
          const b = e.target.querySelector('button.btn-primary'); b.disabled = true;
          const r = await Store.addRequest({ masterId: m.id, ...d });
          b.disabled = false;
          if (r.error) return U.toast(r.error, 'error');
          close();
          U.toast('Заявка отправлена мастеру');
        });
      }
    });
  };

  // ---------- Анкета мастера
  P.master = ([id]) => {
    const m = Store.master(id), u = Store.user();
    const staff = Store.isStaff(u);
    const isOwner = !!u && u.id === m?.userId;
    if (!m || !(Store.isVisible(m) || staff || isOwner)) return P.notFound();
    Store.trackView(m.id);
    const c = Store.cat(m.categoryId) || {}, r = Store.rating(m.id), price = Store.priceFrom(m);
    const reviews = Store.reviews(x => x.masterId === m.id && x.status === 'published').sort((a, b) => b.date - a.date);
    const similar = Store.search({ cat: m.categoryId }).filter(x => x.id !== m.id).sort((a, b) => (b.city === m.city) - (a.city === m.city)).slice(0, 4);
    const mine = u && Store.reviews(x => x.masterId === m.id && x.userId === u.id)[0];
    const lim = u && Store.limit(u, 'reviews');
    const ownerUser = Store.userById(m.userId);
    const hiddenWhy = m.status !== 'approved' ? C.MASTER_STATUS[m.status][0].toLowerCase() + (m.statusReason ? `: ${m.statusReason}` : '') : Store.isBanned(ownerUser) ? 'аккаунт владельца заблокирован' : '';

    let reviewForm;
    if (!u) reviewForm = `<div class="note">Чтобы оставить отзыв, <a class="link" href="${link('/login', { next: '/m/' + m.id })}">войдите</a> или <a class="link" href="#/register">зарегистрируйтесь</a>.</div>`;
    else if (isOwner || staff) reviewForm = '';
    else if (mine) reviewForm = `<div class="note">Вы уже оставили отзыв${mine.status === 'pending' ? '. Он появится после проверки' : mine.status === 'hidden' ? '. Он скрыт модератором' : ''}. Изменить его можно в <a class="link" href="#/cabinet?tab=reviews">кабинете</a>.</div>`;
    else if (lim) reviewForm = `<div class="note note-warn">${icon('warning', 'fill')} Вам запрещено оставлять отзывы ${esc(Store.until(lim.until))}. Причина: ${esc(lim.reason)}</div>`;
    else reviewForm = `<form class="review-form" id="reviewForm"><h3 class="h3">Ваш отзыв</h3>
      <div class="star-input" role="radiogroup" aria-label="Оценка">${[5, 4, 3, 2, 1].map(i => `<input type="radio" name="rating" id="st${i}" value="${i}"><label for="st${i}" title="${i} из 5">${icon('star', 'fill')}</label>`).join('')}</div>
      <textarea class="input" name="text" placeholder="Расскажите, как всё прошло: качество, сроки, общение" required minlength="10" maxlength="1000"></textarea>
      <button class="btn btn-primary">Опубликовать</button></form>`;

    const dist = [5, 4, 3, 2, 1].map(i => { const n = r.dist[i - 1], pct = r.count ? n / r.count * 100 : 0; return `<div class="dist-row"><span>${i}</span>${icon('star', 'ic-star')}<span class="progress"><i style="width:${pct}%"></i></span><span class="muted">${n}</span></div>`; }).join('');
    const rvItem = x => `<div class="rv"><div class="rv-head"><span class="av av-sm" style="--h:${(x.author.charCodeAt(0) * 7) % 360}"><span>${esc(U.initials(x.author))}</span></span><div><b>${esc(x.author)}</b><div class="muted sm">${U.date(x.date)}${x.edited ? ', изменён' : ''}</div></div>${C.stars(x.rating)}
      ${u && x.userId !== u.id && !staff ? `<button class="btn btn-ghost btn-sm btn-icon rv-flag" data-rep="${x.id}" title="Пожаловаться на отзыв" aria-label="Пожаловаться на отзыв">${icon('flag')}</button>` : ''}
      ${staff ? `<button class="btn btn-ghost btn-sm btn-icon rv-flag" data-hide="${x.id}" title="Скрыть отзыв" aria-label="Скрыть отзыв">${icon('eye-slash')}</button>` : ''}</div>
      <p>${esc(x.text)}</p>${x.reply ? `<div class="rv-reply"><b>Ответ мастера</b><p>${esc(x.reply)}</p></div>` : ''}</div>`;

    const staffCard = staff ? `<div class="card staff-card"><div class="card-head"><h2 class="h3">${icon('shield-warning')} Модерация</h2>${C.pill(C.MASTER_STATUS, m.status)}</div>
      ${m.statusReason ? `<p class="muted sm">Причина: ${esc(m.statusReason)}</p>` : ''}
      ${Store.isBanned(ownerUser) ? `<p class="muted sm">Владелец заблокирован ${esc(Store.until(ownerUser.ban.until))}</p>` : ''}
      <div class="staff-acts">
        ${m.status === 'pending' || m.status === 'rejected' ? `<button class="btn btn-sm btn-primary" data-mod="approve">${icon('check')} Одобрить</button>` : ''}
        ${m.status === 'pending' ? `<button class="btn btn-sm" data-mod="reject">Отклонить</button>` : ''}
        ${m.status === 'blocked' ? `<button class="btn btn-sm" data-mod="unblock">Разблокировать</button>` : `<button class="btn btn-sm btn-danger" data-mod="block">${icon('prohibit')} Заблокировать</button>`}
        ${Store.can('verify') ? `<button class="btn btn-sm" data-mod="verify">${icon('seal-check')} ${m.verified ? 'Снять «Проверен»' : 'Проверен'}</button>` : ''}
        ${Store.can('finance') ? `<button class="btn btn-sm" data-mod="promo">${icon('crown')} Продвижение</button>` : ''}
        ${Store.canSanction(ownerUser) ? `<button class="btn btn-sm" data-mod="sanction">${icon('gavel')} Санкции</button>` : ''}
      </div></div>` : '';

    return {
      title: `${m.name}, ${c.name}, ${m.city}`,
      html: `<div class="wrap page">
      ${hiddenWhy ? `<div class="banner banner-warn">${icon('eye-slash')} Анкета не видна в каталоге: ${esc(hiddenWhy)}. Её видите только вы${staff ? ' как сотрудник площадки' : ''}.</div>` : ''}
      <nav class="crumbs"><a href="#/">Главная</a><span>/</span><a href="${link('/catalog', { cat: m.categoryId })}">${esc(c.name)}</a><span>/</span><a href="${link('/catalog', { cat: m.categoryId, city: m.city })}">${esc(m.city)}</a></nav>
      <div class="profile">
        <div class="profile-main">
          <section class="card p-head">
            ${C.avatar(m, 'xl')}
            <div class="p-id">
              <h1 class="h2">${esc(m.name)}</h1>
              <div class="muted">${C.catIcon(c)} ${esc(c.name)}, ${icon('pin')} ${esc(m.city)}</div>
              ${C.badges(m)}
              <div class="p-facts">
                ${r.count ? `<a href="#reviews" class="rating" data-scroll="reviews">${icon('star', 'ic-star')}<b>${r.avg.toFixed(1)}</b><span class="muted">${r.count} ${plural(r.count, 'отзыв', 'отзыва', 'отзывов')}</span></a>` : '<span class="muted">Нет отзывов</span>'}
                <span>${icon('briefcase')} Опыт ${m.experience} ${plural(m.experience, 'год', 'года', 'лет')}</span>
                ${m.schedule ? `<span>${icon('clock')} ${esc(m.schedule)}</span>` : ''}
                <span>${icon('calendar')} На сайте с ${U.date(m.createdAt)}</span>
              </div>
            </div>
          </section>
          <section class="card"><h2 class="h3">О мастере</h2><p class="pre">${esc(m.about || 'Мастер пока не добавил описание.')}</p></section>
          <section class="card"><h2 class="h3">Услуги и цены</h2>
            ${m.services.length ? `<table class="price-table">${m.services.map(sv => `<tr><td>${esc(sv.name)}</td><td class="pt-dots"></td><td class="nowrap"><b>${money(sv.price)}</b> <span class="muted sm">/ ${esc(sv.unit)}</span></td></tr>`).join('')}</table>
            <p class="muted sm mt">Окончательная стоимость зависит от объёма работ. Уточняйте у мастера.</p>` : '<p class="muted">Цены уточняйте у мастера.</p>'}
          </section>
          <section class="card"><h2 class="h3">Фото работ</h2>
            ${m.portfolio.length ? `<div class="portfolio">${m.portfolio.map((src, i) => `<button class="pf" data-pf="${i}" aria-label="Открыть фото ${i + 1}"><img src="${src}" alt="Работа ${i + 1}" loading="lazy"></button>`).join('')}</div>` : '<p class="muted">Мастер пока не добавил фото работ.</p>'}
          </section>
          <section class="card" id="reviews"><h2 class="h3">Отзывы</h2>
            ${r.count ? `<div class="rv-summary"><div class="rv-big"><b>${r.avg.toFixed(1)}</b>${C.stars(r.avg)}<span class="muted sm">${r.count} ${plural(r.count, 'оценка', 'оценки', 'оценок')}</span></div><div class="dist">${dist}</div></div>` : ''}
            ${reviewForm}
            <div class="rv-list">${reviews.length ? reviews.map(rvItem).join('') : '<p class="muted">Отзывов пока нет. Станьте первым.</p>'}</div>
          </section>
        </div>
        <aside class="profile-side">
          <div class="card contact">
            <div class="contact-price">${price != null ? `<span class="muted sm">Стоимость услуг</span><b>от ${money(price)}</b>` : '<b>Цена по запросу</b>'}</div>
            ${m.away ? `<div class="note note-warn sm">${icon('pause-circle', 'fill')} Мастер сейчас не принимает заказы. Можно позвонить и уточнить сроки.</div>` : ''}
            ${isOwner ? `<a class="btn btn-primary btn-block" href="#/cabinet?tab=profile">${icon('edit')} Редактировать анкету</a>` : `
            <button class="btn btn-primary btn-block" id="phoneBtn">${icon('phone')} Показать телефон</button>
            ${m.telegram ? `<a class="btn btn-block" href="https://t.me/${esc(m.telegram)}" target="_blank" rel="noopener">${icon('telegram')} Написать в Telegram</a>` : ''}
            <button class="btn btn-block" id="reqBtn" ${m.away ? 'disabled' : ''}>${icon('msg')} Оставить заявку</button>
            <button class="btn btn-ghost btn-block fav-wide ${Store.isFav(m.id) ? 'on' : ''}" data-act="fav" data-id="${m.id}"><i class="ph ph-heart i-off"></i><i class="ph-fill ph-heart i-on"></i> <span>В избранное</span></button>`}
            <p class="muted sm center">Скажите мастеру, что нашли его на «${esc(Store.settings().siteName)}»</p>
            ${!isOwner && !staff ? `<button class="link-muted" id="reportBtn">${icon('flag')} Пожаловаться на анкету</button>` : ''}
          </div>
          ${staffCard}
        </aside>
      </div>
      ${similar.length ? `<section class="sec"><h2 class="h2">Похожие мастера</h2><div class="grid-cards">${similar.map(C.card).join('')}</div></section>` : ''}
      </div>`,
      mount() {
        const pb = document.getElementById('phoneBtn');
        pb && pb.addEventListener('click', () => {
          Store.trackPhone(m.id);
          pb.outerHTML = `<a class="btn btn-primary btn-block" href="tel:${esc(m.phone)}">${icon('phone')} ${esc(U.phone(m.phone))}</a>`;
        });
        document.getElementById('reqBtn')?.addEventListener('click', () => P.openRequest(m));
        document.getElementById('reportBtn')?.addEventListener('click', () => P.report('master', m.id));
        const rf = document.getElementById('reviewForm');
        rf && rf.addEventListener('submit', async e => {
          e.preventDefault();
          const d = U.form(rf);
          if (!d.rating) return U.toast('Поставьте оценку', 'error');
          if ((d.text || '').length < 10) return U.toast('Напишите хотя бы пару предложений', 'error');
          const b = rf.querySelector('button'); b.disabled = true;
          const res = await Store.addReview({ masterId: m.id, rating: +d.rating, text: d.text });
          b.disabled = false;
          if (res.error) { if (res.error !== 'skip') U.toast(res.error, 'error'); return; }
          U.toast(res.review.status === 'pending' ? 'Спасибо! Отзыв появится после проверки' : 'Спасибо за отзыв!');
          App.render();
        });
        const main = document.getElementById('main');
        main.addEventListener('click', e => {
          const rep = e.target.closest('[data-rep]'), hide = e.target.closest('[data-hide]'), mod = e.target.closest('[data-mod]');
          if (rep) P.report('review', rep.dataset.rep);
          if (hide) P.mod.hideReview(hide.dataset.hide);
          if (mod) {
            const a = mod.dataset.mod;
            if (a === 'sanction') P.mod.sanction(m.userId);
            else if (a === 'promo') P.mod.promo(m.id);
            else P.mod[a](m.id);
          }
        });
        document.querySelectorAll('[data-pf]').forEach(b => b.addEventListener('click', () => {
          U.modal({ title: m.name, wide: true, body: `<img class="lightbox" src="${m.portfolio[+b.dataset.pf]}" alt="">` });
        }));
        document.querySelector('[data-scroll]')?.addEventListener('click', e => { e.preventDefault(); document.getElementById('reviews').scrollIntoView({ behavior: 'smooth' }); });
      }
    };
  };

  // ---------- Мастерам (пока продвижение бесплатное, подключает администрация)
  P.pricing = () => {
    const s = Store.settings(), u = Store.user();
    const cta = u?.role === 'master' ? '#/cabinet?tab=promo' : u ? '#/catalog' : '#/register?role=master';
    const ctaLabel = u?.role === 'master' ? 'Запросить в кабинете' : u ? 'Открыть каталог' : 'Разместить анкету';
    const plan = (name, per, feats, ic, hl) => `<div class="plan ${hl ? 'plan-hl' : ''}" data-reveal>${hl ? '<span class="plan-tag">Популярный</span>' : ''}
      <div class="plan-ic">${icon(ic, 'fill')}</div><h3 class="h3">${name}</h3><div class="plan-price"><b>0 ₽</b><span class="muted">${per}</span></div>
      <ul>${feats.map(f => `<li>${icon('check')}${f}</li>`).join('')}</ul><a class="btn ${hl ? 'btn-primary' : ''} btn-block" href="${cta}">${ctaLabel}</a></div>`;
    return {
      title: `Мастерам: ${s.siteName}`,
      html: `<div class="wrap page">
        <div class="page-head center"><h1 class="h1">Клиенты без комиссии</h1><p class="lead">Размещение бесплатное. На старте площадки продвижение тоже бесплатное: подключаем его по запросу мастера.</p></div>
        <div class="plans">
          ${plan('Анкета', 'навсегда', ['Анкета в каталоге', 'Услуги и цены', 'Фото работ', 'Заявки от клиентов', 'Отзывы и рейтинг'], 'user')}
          ${plan('Топ', `/ ${s.days.top} дней`, ['Анкета первой в своей категории', 'Значок «В топе»', 'Больше просмотров и звонков', 'Можно продлевать'], 'zap', true)}
          ${plan('Премиум', `/ ${s.days.premium} дней`, ['Показ на главной странице', 'Выделенная карточка в каталоге', 'Значок «Премиум»', 'Выше обычных анкет'], 'crown')}
          ${plan('Проверенный мастер', 'разово', ['Значок «Проверен»', 'Проверка документов модератором', 'Фильтр «Только проверенные»', 'Больше доверия клиентов'], 'shield')}
        </div>
        <div class="faq">
          <h2 class="h2">Частые вопросы</h2>
          <details><summary>Вы берёте процент с заказов?</summary><p>Нет. Клиенты связываются с вами напрямую, деньги за работу вы получаете полностью.</p></details>
          <details><summary>Как подключить продвижение?</summary><p>В кабинете откройте «Продвижение» и нажмите «Запросить». Администрация получит заявку и подключит его.</p></details>
          <details><summary>Сколько времени занимает проверка анкеты?</summary><p>Обычно до 24 часов. Если анкету отклонят, вы увидите причину в кабинете и сможете исправить её.</p></details>
          <details><summary>Можно ли работать в нескольких городах?</summary><p>Да. Укажите основной город в анкете, а в описании напишите, куда ещё выезжаете.</p></details>
          <details><summary>Я в отпуске. Что делать с анкетой?</summary><p>Выключите «Принимаю заказы» в кабинете. Анкета останется в каталоге с пометкой, заявки приходить не будут.</p></details>
        </div></div>`
    };
  };

  // ---------- О сервисе
  P.about = () => {
    const s = Store.settings();
    return {
      title: `О сервисе: ${s.siteName}`,
      html: `<div class="wrap page narrow">
        <h1 class="h1">О сервисе</h1>
        <p class="lead">«${esc(s.siteName)}» объединяет частных мастеров и небольшие команды: ${esc(s.region)}. Помогаем быстро найти исполнителя рядом с домом и честно оценить его по отзывам.</p>
        <div class="card"><h2 class="h3">Для клиентов</h2><ul class="ul">
          <li>Поиск бесплатный, регистрация нужна только для отзывов, заявок с отслеживанием и избранного.</li>
          <li>Договаривайтесь о цене и сроках до начала работ.</li>
          <li>Оставляйте честные отзывы. Нашли нарушение? Нажмите «Пожаловаться» на странице мастера или у отзыва.</li></ul></div>
        <div class="card"><h2 class="h3">Для мастеров</h2><ul class="ul">
          <li>Размещение анкеты бесплатное, без комиссии с заказов.</li>
          <li>Указывайте реальные цены и фото своих работ.</li>
          <li>Несправедливый отзыв можно оспорить в кабинете, его проверит модератор.</li></ul></div>
        <div class="card"><h2 class="h3">Правила и модерация</h2><ul class="ul">
          <li>Запрещены фейковые отзывы, чужие фото, оскорбления, спам и вводящая в заблуждение информация.</li>
          <li>Анкеты и жалобы проверяют модераторы. За нарушения: предупреждение, запрет отзывов или заявок на срок, блокировка аккаунта.</li>
          <li>Причина любого ограничения видна в кабинете. Обжаловать решение: ${esc(C.supportLine())}.</li></ul></div>
        ${C.contacts(s) ? `<div class="card"><h2 class="h3">Контакты</h2><div class="contacts">${C.contacts(s)}</div></div>` : ''}
      </div>`
    };
  };

  // ---------- Вход
  const home = u => Store.isStaff(u) ? '/admin' : '/cabinet';
  P.login = (p, q) => {
    const cur = Store.user();
    if (cur) return App.redirect(q.next || home(cur));
    return {
      title: 'Вход',
      html: `<div class="wrap auth"><div class="card auth-card">
        <h1 class="h2">Вход</h1>
        <form id="loginForm" novalidate>
          <label class="fld"><span>Email</span><input class="input" name="email" type="email" required autocomplete="email"></label>
          <label class="fld"><span>Пароль</span><input class="input" name="password" type="password" required autocomplete="current-password"></label>
          <p class="fld-err" id="loginErr" hidden></p>
          <button class="btn btn-primary btn-block">Войти</button>
        </form>
        <div class="auth-links"><button type="button" class="link sm" id="forgot">Забыли пароль?</button><span class="muted sm">Нет аккаунта? <a class="link" href="#/register">Регистрация</a></span></div>
        </div></div>`,
      mount() {
        const f = document.getElementById('loginForm'), err = document.getElementById('loginErr'), b = f.querySelector('button.btn-primary');
        const fail = t => { err.textContent = t; err.hidden = false; };
        f.addEventListener('submit', async e => {
          e.preventDefault();
          const d = U.form(f);
          if (!d.email || !d.password) return fail('Введите email и пароль');
          b.disabled = true; b.textContent = 'Входим…';
          const r = await Store.login(d.email, d.password);
          b.disabled = false; b.textContent = 'Войти';
          if (r.error) return fail(r.error);
          U.toast('Здравствуйте, ' + (r.user.name || '').split(' ')[0] + '!');
          location.hash = '#' + (q.next || home(r.user));
        });
        f.addEventListener('input', () => { err.hidden = true; });
        document.getElementById('forgot').addEventListener('click', () => U.modal({
          title: 'Восстановление пароля',
          body: `<form id="fgForm"><p class="muted">Пришлём на почту ссылку для смены пароля.</p><label class="fld"><span>Email</span><input class="input" type="email" name="email" required value="${esc(f.email.value)}"></label><button class="btn btn-primary btn-block">Отправить ссылку</button></form>`,
          onMount(el, close) {
            el.querySelector('#fgForm').addEventListener('submit', async e => {
              e.preventDefault();
              const em = e.target.email.value.trim();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return U.toast('Проверьте email', 'error');
              const r = await Store.resetPassword(em);
              if (r.error) return U.toast(r.error, 'error');
              close(); U.toast('Если такой аккаунт есть, письмо уже в пути. Проверьте и папку «Спам»', 'ok', { ms: 6000 });
            });
          }
        }));
      }
    };
  };

  // ---------- Регистрация
  P.register = (p, q) => {
    if (Store.user()) return App.redirect(home(Store.user()));
    const role = q.role === 'master' ? 'master' : 'client';
    return {
      title: 'Регистрация',
      html: `<div class="wrap auth"><div class="card auth-card">
        <h1 class="h2">Регистрация</h1>
        <form id="regForm" novalidate>
          <div class="seg seg-wide mb">
            <label><input type="radio" name="role" value="client" ${role === 'client' ? 'checked' : ''}><span>Ищу мастера</span></label>
            <label><input type="radio" name="role" value="master" ${role === 'master' ? 'checked' : ''}><span>Я мастер</span></label>
          </div>
          <label class="fld"><span>Имя и фамилия</span><input class="input" name="name" required minlength="2" autocomplete="name"></label>
          <label class="fld"><span>Email</span><input class="input" name="email" type="email" required autocomplete="email"></label>
          <label class="fld"><span>Пароль, не короче 6 символов</span><input class="input" name="password" type="password" required minlength="6" autocomplete="new-password"></label>
          <div id="masterFields" ${role === 'master' ? '' : 'hidden'}>
            <label class="fld"><span>Город</span>${C.citySelect('city', 'Кемерово', '')}</label>
            <label class="fld"><span>Категория услуг</span>${C.catSelect('categoryId', '', '')}</label>
            <label class="fld"><span>Телефон для клиентов</span><input class="input" name="phone" type="tel" placeholder="+7 900 000-00-00" autocomplete="tel"></label>
          </div>
          <p class="fld-err" id="regErr" hidden></p>
          <button class="btn btn-primary btn-block">Создать аккаунт</button>
          <p class="muted sm center mt">Регистрируясь, вы соглашаетесь с <a class="link" href="#/about">правилами сервиса</a>.</p>
        </form></div></div>`,
      mount() {
        const f = document.getElementById('regForm'), mf = document.getElementById('masterFields'), err = document.getElementById('regErr');
        const fail = t => { err.textContent = t; err.hidden = false; };
        f.addEventListener('change', () => { mf.hidden = U.form(f).role !== 'master'; });
        f.addEventListener('input', () => { err.hidden = true; });
        f.addEventListener('submit', async e => {
          e.preventDefault();
          const d = U.form(f);
          if ((d.name || '').length < 2) return fail('Укажите имя');
          if ((d.password || '').length < 6) return fail('Пароль должен быть не короче 6 символов');
          if (d.role === 'master' && String(d.phone || '').replace(/\D/g, '').length < 10) return fail('Укажите телефон для клиентов');
          const b = f.querySelector('button.btn-primary'); b.disabled = true; b.textContent = 'Создаём аккаунт…';
          const res = await Store.register(d);
          b.disabled = false; b.textContent = 'Создать аккаунт';
          if (res.error) return fail(res.error);
          if (res.confirm) {
            document.querySelector('.auth-card').innerHTML = `<div class="center"><div class="empty-ic"><i class="ph-duotone ph-envelope-simple"></i></div><h1 class="h2">Подтвердите email</h1><p class="muted">Мы отправили письмо на <b>${esc(d.email)}</b>. Откройте ссылку из письма, и вы сразу войдёте в аккаунт. Письма нет? Проверьте папку «Спам».</p><a class="btn" href="#/login">Ко входу</a></div>`;
            return;
          }
          const u = res.user;
          U.toast(u?.role === 'owner' ? 'Вы владелец площадки. Добро пожаловать!' : d.role === 'master' ? 'Анкета создана! Заполните её в кабинете' : 'Добро пожаловать!');
          location.hash = u?.role === 'owner' ? '#/admin' : d.role === 'master' ? '#/cabinet?tab=profile' : '#/catalog';
        });
      }
    };
  };

  P.notFound = () => ({
    title: 'Страница не найдена',
    html: `<div class="wrap page">${C.empty('Страница не найдена', 'Возможно, анкета скрыта, удалена или ссылка устарела', '<a class="btn btn-primary" href="#/catalog">В каталог</a>')}</div>`
  });
})();
