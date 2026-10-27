// Интерфейсные компоненты: всплывающие панели, выпадающие списки, меню, подсказки поиска
window.UI = (() => {
  const { esc } = U;
  const mobile = () => innerWidth < 640;
  let cur = null;

  const closePop = () => cur && cur.close();
  const isOpen = a => !!cur && cur.anchor === a;

  // Панель под элементом; на телефоне - шторка снизу
  function pop(anchor, o = {}) {
    closePop();
    const sheet = o.sheet !== false && mobile();
    const el = document.createElement('div');
    el.className = 'pop ' + (o.cls || '') + (sheet ? ' pop-sheet' : '');
    el.innerHTML = (sheet ? `<div class="pop-grip"></div>${o.title ? `<div class="pop-title">${esc(o.title)}</div>` : ''}` : '') + o.html;
    let ov = null;
    if (sheet) { ov = document.createElement('div'); ov.className = 'pop-ov'; document.body.append(ov); document.body.classList.add('pop-open'); }
    document.body.append(el);
    const place = () => {
      if (sheet || !anchor.isConnected) return;
      const r = anchor.getBoundingClientRect();
      el.style.minWidth = Math.min(innerWidth - 16, Math.max(r.width, o.minWidth || 0)) + 'px';
      if (o.width) el.style.width = Math.min(innerWidth - 16, o.width) + 'px';
      const w = el.offsetWidth, h = el.offsetHeight;
      let left = o.align === 'right' ? r.right - w : r.left;
      left = Math.max(8, Math.min(left, innerWidth - w - 8));
      const below = innerHeight - r.bottom;
      const up = below < h + 16 && r.top > below;
      el.style.left = left + 'px';
      el.style.top = (up ? Math.max(8, r.top - h - 8) : r.bottom + 8) + 'px';
      el.classList.toggle('up', up);
    };
    const onDoc = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); o.focusBack !== false && anchor.focus && anchor.focus(); } };
    const onScroll = e => { if (!el.contains(e.target)) place(); };
    function close() {
      if (!el.isConnected) return;
      el.remove(); ov && ov.remove();
      if (sheet) document.body.classList.remove('pop-open');
      document.removeEventListener('pointerdown', onDoc, true);
      document.removeEventListener('keydown', onKey, true);
      removeEventListener('resize', place);
      removeEventListener('scroll', onScroll, true);
      if (cur && cur.el === el) cur = null;
      o.onClose && o.onClose();
    }
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
    addEventListener('resize', place);
    addEventListener('scroll', onScroll, true);
    cur = { el, close, place, anchor };
    place();
    o.onMount && o.onMount(el, close, place);
    return cur;
  }

  // ---------- выпадающий список вместо системного <select>
  const fieldLabel = sel => sel.closest('.fld')?.querySelector(':scope > span, :scope > legend')?.textContent.trim() || sel.getAttribute('aria-label') || ({ city: 'Город', cat: 'Категория', categoryId: 'Категория', icon: 'Иконка' })[sel.name] || 'Выберите';
  const optHtml = o => (o.dataset.icon ? `<i class="ph-duotone ph-${esc(o.dataset.icon)} cat-glyph"></i>` : '') + `<span class="dd-txt">${esc(o.text)}</span>`;

  function dropdown(sel) {
    const wrap = document.createElement('span');
    wrap.className = 'dd';
    sel.before(wrap);
    wrap.append(sel);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = sel.className + ' dd-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-label', fieldLabel(sel));
    sel.classList.add('dd-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    wrap.append(btn);
    const paint = () => {
      const o = sel.options[sel.selectedIndex];
      btn.innerHTML = `<span class="dd-val">${o ? optHtml(o) : ''}</span><i class="ph ph-caret-down dd-caret"></i>`;
    };
    paint();
    sel.addEventListener('change', paint);

    function open() {
      if (isOpen(btn)) return closePop();
      const opts = [...sel.options], many = opts.length > 8;
      pop(btn, {
        cls: 'dd-pop', title: fieldLabel(sel), minWidth: 230,
        html: `${many ? `<div class="dd-search"><i class="ph ph-magnifying-glass"></i><input type="text" placeholder="Найти" autocomplete="off" aria-label="Поиск по списку"></div>` : ''}
          <div class="dd-list" role="listbox" tabindex="-1">${opts.map((o, i) => `<button type="button" role="option" class="dd-opt ${i === sel.selectedIndex ? 'on' : ''}" data-i="${i}" aria-selected="${i === sel.selectedIndex}">${optHtml(o)}${o.dataset.meta ? `<span class="dd-meta">${esc(o.dataset.meta)}</span>` : ''}<i class="ph ph-check dd-check"></i></button>`).join('')}
          <div class="dd-none" hidden>Ничего не найдено</div></div>`,
        onMount(el, close, place) {
          btn.classList.add('open');
          const list = el.querySelector('.dd-list'), search = el.querySelector('.dd-search input');
          const items = [...list.querySelectorAll('.dd-opt')];
          const vis = () => items.filter(b => !b.hidden);
          const mark = b => { items.forEach(x => x.classList.remove('act')); if (b) { b.classList.add('act'); b.scrollIntoView({ block: 'nearest' }); } };
          mark(items[Math.max(0, sel.selectedIndex)]);
          const pick = b => {
            const i = +b.dataset.i;
            close(); btn.focus({ preventScroll: true });
            if (i === sel.selectedIndex) return;
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          };
          list.addEventListener('click', e => { const b = e.target.closest('.dd-opt'); b && pick(b); });
          list.addEventListener('pointermove', e => { const b = e.target.closest('.dd-opt'); b && !b.classList.contains('act') && mark(b); });
          search && search.addEventListener('input', () => {
            const q = search.value.trim().toLowerCase();
            items.forEach(b => { b.hidden = !!q && !b.textContent.toLowerCase().includes(q); });
            el.querySelector('.dd-none').hidden = vis().length > 0;
            mark(vis()[0]);
            place();
          });
          el.addEventListener('keydown', e => {
            const v = vis(), i = v.indexOf(el.querySelector('.dd-opt.act'));
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); v.length && mark(v[(i + (e.key === 'ArrowDown' ? 1 : -1) + v.length) % v.length]); }
            else if (e.key === 'Enter') { e.preventDefault(); const a = el.querySelector('.dd-opt.act'); a && !a.hidden && pick(a); }
            else if (e.key === 'Tab') close();
          });
          (search && !mobile() ? search : list).focus({ preventScroll: true });
        },
        onClose: () => btn.classList.remove('open')
      });
    }
    btn.addEventListener('click', open);
    btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); } });
  }

  // Применяется после каждой отрисовки: селекты, пароли, ползунки
  function enhance(root = document) {
    root.querySelectorAll('select.input:not(.dd-native)').forEach(dropdown);
    root.querySelectorAll('input[type=password]:not(.pw-ok)').forEach(inp => {
      inp.classList.add('pw-ok');
      const w = document.createElement('span');
      w.className = 'pw';
      inp.before(w); w.append(inp);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pw-eye'; b.setAttribute('aria-label', 'Показать пароль');
      b.innerHTML = '<i class="ph ph-eye"></i>';
      b.onclick = () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = `<i class="ph ph-eye${show ? '-slash' : ''}"></i>`; b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль'); };
      w.append(b);
    });
    root.querySelectorAll('input[type=range]:not(.rg-ok)').forEach(r => {
      r.classList.add('rg-ok');
      const f = () => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
      f(); r.addEventListener('input', f);
    });
  }

  // ---------- меню действий (три точки)
  function menu(anchor, items) {
    items = items.filter(Boolean);
    if (isOpen(anchor)) return closePop();
    pop(anchor, {
      cls: 'menu-pop', align: 'right', minWidth: 240, title: 'Действия',
      html: `<div class="menu" role="menu">${items.map((it, i) => it === '-' ? '<hr>' : `<button type="button" role="menuitem" class="menu-it ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon ? `<i class="ph ph-${esc(it.icon)}"></i>` : ''}<span>${esc(it.label)}</span></button>`).join('')}</div>`,
      onMount(el, close) {
        const btns = [...el.querySelectorAll('.menu-it')];
        el.addEventListener('click', e => { const b = e.target.closest('.menu-it'); if (!b) return; close(); items[+b.dataset.i].on(); });
        el.addEventListener('keydown', e => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          const i = btns.indexOf(document.activeElement);
          btns[(i + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length].focus();
        });
        btns[0] && !mobile() && btns[0].focus({ preventScroll: true });
      }
    });
  }

  // ---------- подсказки под полем поиска
  function suggest(input, { anchor, build, onPick }) {
    input.setAttribute('autocomplete', 'off');
    let p = null;
    const show = () => {
      const html = build(input.value.trim());
      if (!html) { p && p.close(); return; }
      if (p && p.el.isConnected) { p.el.querySelector('.sg').innerHTML = html; p.place(); return; }
      p = pop(anchor, {
        cls: 'sg-pop', sheet: false, focusBack: false, html: `<div class="sg" role="listbox">${html}</div>`,
        onMount(el) {
          el.addEventListener('pointerdown', e => e.preventDefault());
          el.addEventListener('click', e => { const it = e.target.closest('.sg-it'); if (it) { p.close(); onPick({ ...it.dataset }); } });
        },
        onClose: () => { p = null; }
      });
    };
    input.addEventListener('focus', show);
    input.addEventListener('input', show);
    input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) p && p.close(); }, 120));
    input.addEventListener('keydown', e => {
      if (!p) { if (e.key === 'ArrowDown') show(); return; }
      const its = [...p.el.querySelectorAll('.sg-it')], i = its.findIndex(x => x.classList.contains('act'));
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && its.length) {
        e.preventDefault();
        its.forEach(x => x.classList.remove('act'));
        const n = its[e.key === 'ArrowDown' ? (i + 1) % its.length : (i <= 0 ? its.length - 1 : i - 1)];
        n.classList.add('act'); n.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && i >= 0) { e.preventDefault(); const d = { ...its[i].dataset }; p.close(); onPick(d); }
    });
    return { close: () => p && p.close() };
  }

  // ---------- окно с обязательной причиной
  function ask({ title, text = '', reasons = [], ok = 'Подтвердить', danger = true, label = 'Причина', placeholder = 'Её увидит пользователь' }) {
    return new Promise(res => {
      let val = null;
      U.modal({
        title,
        body: `${text ? `<p class="muted">${esc(text)}</p>` : ''}<form class="ask">
          ${reasons.length ? `<div class="chips chips-pick">${reasons.map(r => `<button type="button" class="chip" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
          <label class="fld"><span>${esc(label)}</span><textarea class="input" name="reason" rows="3" placeholder="${esc(placeholder)}"></textarea></label>
          <p class="fld-err" hidden>Укажите причину</p>
          <div class="modal-actions"><button type="button" class="btn" data-close>Отмена</button><button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}">${esc(ok)}</button></div></form>`,
        onMount(el, close) {
          const f = el.querySelector('form'), ta = f.reason, err = el.querySelector('.fld-err');
          el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { el.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); ta.value = b.dataset.r; err.hidden = true; });
          f.onsubmit = e => { e.preventDefault(); if (!ta.value.trim()) { err.hidden = false; ta.focus(); return; } val = ta.value.trim(); close(); };
        },
        onClose: () => res(val)
      });
    });
  }

  return { pop, closePop, isOpen, enhance, menu, suggest, ask };
})();
