// Анимации интерфейса: появление при прокрутке, счётчики, подсветка карточек под курсором
window.FX = (() => {
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let io = null;

  function countUp(el) {
    const to = parseFloat(el.dataset.count) || 0, dec = +el.dataset.dec || 0;
    const fmt = v => dec ? v.toFixed(dec).replace('.', ',') : U.num(v);
    if (reduce() || !to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 1400;
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(to * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function run(root) {
    const items = root.querySelectorAll('[data-reveal]:not(.in), [data-count]:not(.in)');
    if (reduce() || !('IntersectionObserver' in window)) {
      items.forEach(el => { el.classList.add('in'); if (el.dataset.count != null) countUp(el); });
      return;
    }
    io = io || new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('in');
      if (el.dataset.count != null) countUp(el);
      io.unobserve(el);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(el => io.observe(el));
  }

  // Подсветка: координаты курсора в CSS-переменных ближайшей .spot
  document.addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest('.spot');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  return { run };
})();
