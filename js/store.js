// Хранилище: данные живут в локальной базе (LocalDB), здесь держится копия для быстрой отрисовки.
// Изменения применяются сразу на экране и записываются в базу; при ошибке данные перезагружаются.
window.Store = (() => {
  const VKEY = 'masterok_viewed';
  const DAY = 864e5, FOREVER = 4102444800000;
  const now = () => Date.now();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const DEFAULTS = { siteName: 'Мастерок', region: 'Кемеровская область', regionShort: 'Кузбасс', regionIn: 'в Кузбассе', cities: ['Кемерово'], days: { top: 7, premium: 30 }, autoApprove: false, reviewPremod: false, contactEmail: '', contactPhone: '', contactTelegram: '' };
  const empty = () => ({ settings: { ...DEFAULTS }, categories: [], users: [], masters: [], reviews: [], requests: [], payments: [], reports: [], notifications: [], log: [] });

  let sb = null, db = empty(), session = null, rcache = null, onChange = () => {};

  // ---------- преобразование полей: snake_case в базе, camelCase в коде
  const ALIAS = { when: 'when_txt' }, BACK = { when_txt: 'when' };
  const toCamel = row => { const o = {}; for (const k in row) o[BACK[k] || k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = row[k]; return o; };
  const toSnake = obj => { const o = {}; for (const k in obj) if (obj[k] !== undefined) o[ALIAS[k] || k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())] = obj[k]; return o; };
  const COLS = {
    profiles: ['name', 'phone', 'role', 'favs', 'ban', 'limits', 'warnings'],
    masters: ['name', 'categoryId', 'city', 'about', 'experience', 'services', 'phone', 'telegram', 'schedule', 'hue', 'avatar', 'portfolio', 'status', 'statusReason', 'away', 'verified', 'premiumUntil', 'topUntil'],
    reviews: ['rating', 'text', 'status', 'reply', 'hideReason'],
    requests: ['status'],
    reports: ['status', 'resolution'],
    payments: ['status', 'refundedAt']
  };
  const pick = (table, patch) => { const o = {}; (COLS[table] || Object.keys(patch)).forEach(k => { if (k in patch) o[k] = patch[k]; }); return toSnake(o); };

  const ERR = [
    [/Invalid login credentials/i, 'Неверный email или пароль'],
    [/User already registered|already been registered/i, 'Пользователь с таким email уже зарегистрирован'],
    [/Password should be at least/i, 'Пароль слишком короткий, нужно от 6 символов'],
    [/rate limit|too many/i, 'Слишком много попыток. Подождите немного и повторите'],
    [/row-level security|permission denied/i, 'Недостаточно прав для этого действия'],
    [/reviews_one_per_user/i, 'Вы уже оставляли отзыв этому мастеру'],
    [/reports_one_open/i, 'Вы уже пожаловались, жалоба на рассмотрении'],
    [/Failed to fetch|NetworkError|Load failed/i, 'Нет связи с сервером. Проверьте интернет'],
    [/violates check constraint/i, 'Проверьте заполнение полей']
  ];
  const errText = e => { const m = String(e?.message || e || ''); const f = ERR.find(([re]) => re.test(m)); return f ? f[1] : (/[а-я]/i.test(m) ? m : 'Не удалось сохранить: ' + m); };

  let reloadTimer = null;
  // Отправка изменения на сервер; возвращает true/false
  async function remote(q, { silent } = {}) {
    try {
      const { error } = await q;
      if (error) throw error;
      return true;
    } catch (e) {
      if (!silent) U.toast(errText(e), 'error');
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => reload().then(onChange), 300);
      return false;
    } finally { rcache = null; }
  }
  const T = name => sb.from(name);

  async function fetchAll(table, build) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      let q = T(table).select('*').range(from, from + 999);
      if (build) q = build(q);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out.map(toCamel);
  }

  // ---------- запуск и загрузка
  async function init(cb) {
    onChange = cb || onChange;
    sb = await LocalDB.create();
    const { data } = await sb.auth.getSession();
    session = data.session;
    sb.auth.onAuthStateChange((ev, s) => {
      const changed = (s?.user?.id || null) !== (session?.user?.id || null);
      session = s;
      if (changed) reload().then(onChange);
    });
    await reload();
  }
  async function reload() {
    const uid = session?.user?.id;
    const [st, categories, masters, reviews] = await Promise.all([
      T('settings').select('data').eq('id', 1).maybeSingle(),
      fetchAll('categories', q => q.order('sort').order('name')),
      fetchAll('masters'),
      fetchAll('reviews')
    ]);
    const next = { ...empty(), settings: { ...DEFAULTS, ...(st.data?.data || {}) }, categories, masters, reviews };
    if (uid) {
      const { data: meRow } = await T('profiles').select('*').eq('id', uid).maybeSingle();
      const me = meRow ? toCamel(meRow) : null;
      const staff = me && (me.role === 'owner' || me.role === 'moderator');
      const [users, requests, reports, notifications, log, payments] = await Promise.all([
        staff ? fetchAll('profiles') : Promise.resolve(me ? [me] : []),
        fetchAll('requests'), fetchAll('reports'),
        fetchAll('notifications', q => q.eq('user_id', uid).order('date', { ascending: false }).limit(100)),
        staff ? fetchAll('log', q => q.order('at', { ascending: false }).limit(500)) : Promise.resolve([]),
        fetchAll('payments')
      ]);
      Object.assign(next, { users, requests, reports, notifications, log, payments });
    }
    db = next; rcache = null;
  }

  const settings = () => db.settings;
  function saveSettings(p) {
    Object.assign(db.settings, p);
    addLog('Изменил настройки площадки', 'Настройки');
    return remote(T('settings').update({ data: db.settings }).eq('id', 1));
  }

  // ---------- роли и права
  const ROLES = { owner: 'Владелец', moderator: 'Модератор', master: 'Мастер', client: 'Пользователь' };
  const PERMS = { moderator: ['moderate', 'sanction', 'reports', 'log', 'users', 'requests', 'verify'] };
  const can = (p, u = user()) => !!u && (u.role === 'owner' || (PERMS[u.role] || []).includes(p));
  const isStaff = u => !!u && (u.role === 'owner' || u.role === 'moderator');
  const isBanned = u => !!(u && u.ban && u.ban.until > now());
  const limit = (u, k) => { const l = u?.limits?.[k]; return l && l.until > now() ? l : null; };
  const until = ts => ts >= FOREVER - DAY ? 'навсегда' : 'до ' + U.dateTime(ts);
  const banText = u => `Аккаунт заблокирован ${until(u.ban.until)}. Причина: ${u.ban.reason}`;
  const canSanction = (t, a = user()) => can('sanction', a) && !!t && t.id !== a.id && t.role !== 'owner' && (a.role === 'owner' || !isStaff(t));

  // ---------- аккаунт
  const userById = id => db.users.find(u => u.id === id);
  function user() { const id = session?.user?.id; return id ? userById(id) || null : null; }
  async function login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password });
    if (error) return { error: errText(error) };
    session = data.session;
    await reload();
    const u = user();
    if (!u) return { error: 'Профиль не найден. Напишите в поддержку' };
    if (isBanned(u)) { await logout(); return { error: banText(u) }; }
    return { user: u };
  }
  async function logout() { await sb.auth.signOut(); session = null; await reload(); }
  async function register({ name, email, password, role, phone, categoryId, city }) {
    email = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Проверьте email' };
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name: name.trim(), role: role === 'master' ? 'master' : 'client', phone: phone || '', category_id: categoryId || '', city: city || '' } } });
    if (error) return { error: errText(error) };
    if (data.user && data.user.identities && !data.user.identities.length) return { error: 'Пользователь с таким email уже зарегистрирован' };
    session = data.session;
    await reload();
    return { user: user() };
  }
  async function setPassword(pw) { const { error } = await sb.auth.updateUser({ password: pw }); return error ? { error: errText(error) } : {}; }
  async function changePassword(old, pw) {
    const u = user();
    const { error } = await sb.auth.signInWithPassword({ email: u.email, password: old });
    if (error) return { error: 'Текущий пароль неверный' };
    return setPassword(pw);
  }

  const users = () => db.users;
  function updateUser(id, p) {
    const u = userById(id);
    if (!u) return Promise.resolve(false);
    Object.assign(u, p);
    return remote(T('profiles').update(pick('profiles', p)).eq('id', id));
  }
  async function deleteUser(id) {
    const self = id === user()?.id;
    const { error } = await sb.rpc(self ? 'delete_me' : 'admin_delete_user', self ? {} : { uid: id });
    if (error) { U.toast(errText(error), 'error'); return false; }
    if (self) { await sb.auth.signOut(); session = null; } else addLog('Удалил пользователя', userById(id)?.name);
    await reload();
    return true;
  }
  function setRole(id, role) {
    const u = userById(id);
    if (!u || u.role === 'owner' || u.role === 'master' || !['client', 'moderator'].includes(role) || u.role === role) return;
    addLog(role === 'moderator' ? 'Назначил модератором' : 'Снял права модератора', u.name);
    return updateUser(id, { role });
  }

  // ---------- уведомления (создаются сервером) и журнал
  const myNotifs = () => db.notifications;
  const unread = () => db.notifications.filter(n => !n.read).length;
  function readNotifs(id) {
    const list = db.notifications.filter(n => !n.read && (!id || n.id === id));
    if (!list.length) return;
    list.forEach(n => { n.read = true; });
    remote(T('notifications').update({ read: true }).in('id', list.map(n => n.id)), { silent: true });
  }
  function addLog(action, target = '') {
    const u = user();
    if (!isStaff(u)) return;
    const row = { id: uuid(), at: now(), by: u.id, action, target: target || '' };
    db.log.unshift(row);
    remote(T('log').insert(toSnake(row)), { silent: true });
  }
  const log = () => db.log;

  // ---------- категории
  const categories = () => db.categories;
  const cat = id => db.categories.find(c => c.id === id);
  function saveCategory(c) {
    const ex = c.id && cat(c.id);
    addLog(ex ? 'Изменил категорию' : 'Добавил категорию', c.name);
    if (ex) { Object.assign(ex, c); return remote(T('categories').update({ name: c.name, icon: c.icon }).eq('id', c.id)); }
    const row = { id: 'c' + Date.now().toString(36), name: c.name, icon: c.icon || 'squares-four', sort: db.categories.length + 1 };
    db.categories.push(row);
    return remote(T('categories').insert(row));
  }
  function deleteCategory(id) {
    if (db.masters.some(m => m.categoryId === id)) return false;
    addLog('Удалил категорию', cat(id)?.name);
    db.categories = db.categories.filter(c => c.id !== id);
    remote(T('categories').delete().eq('id', id));
    return true;
  }

  // ---------- мастера
  const masters = () => db.masters;
  const master = id => db.masters.find(m => m.id === id);
  const masterByUser = uid => db.masters.find(m => m.userId === uid);
  const isPremium = m => (m.premiumUntil || 0) > now();
  const isTop = m => (m.topUntil || 0) > now();
  const priceFrom = m => m.services?.length ? Math.min(...m.services.map(s => +s.price || 0)) : null;
  const isVisible = m => !!m && m.status === 'approved' && !((m.bannedUntil || 0) > now());
  const visible = () => db.masters.filter(isVisible);
  function counts(key) { const o = {}; visible().forEach(m => { o[m[key]] = (o[m[key]] || 0) + 1; }); return o; }
  const catCounts = () => counts('categoryId');
  const cityCounts = () => counts('city');

  function ratings() {
    if (rcache) return rcache;
    const acc = {};
    db.reviews.forEach(r => {
      if (r.status !== 'published') return;
      const a = acc[r.masterId] || (acc[r.masterId] = { sum: 0, count: 0, dist: [0, 0, 0, 0, 0] });
      a.sum += r.rating; a.count++; a.dist[r.rating - 1]++;
    });
    Object.values(acc).forEach(a => { a.avg = a.sum / a.count; });
    return rcache = acc;
  }
  const rating = id => ratings()[id] || { avg: 0, count: 0, dist: [0, 0, 0, 0, 0] };

  function search(f = {}) {
    const rm = ratings();
    const R = m => rm[m.id] || { avg: 0, count: 0 };
    const score = m => { const r = R(m); return (r.avg * r.count + 4 * 3) / (r.count + 3); };
    const boost = m => (isTop(m) ? 2 : 0) + (isPremium(m) ? 1 : 0) - (m.away ? 3 : 0);
    let list = visible();
    if (f.cat) list = list.filter(m => m.categoryId === f.cat);
    if (f.city) list = list.filter(m => m.city === f.city);
    if (f.verified) list = list.filter(m => m.verified);
    if (f.open) list = list.filter(m => !m.away);
    if (f.minRating) list = list.filter(m => R(m).avg >= f.minRating);
    if (f.priceMax) list = list.filter(m => { const p = priceFrom(m); return p != null && p <= f.priceMax; });
    if (f.q) {
      const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(m => {
        const hay = [m.name, m.about, cat(m.categoryId)?.name, m.city, ...(m.services || []).map(s => s.name)].join(' ').toLowerCase();
        return words.every(w => hay.includes(w));
      });
    }
    const sorts = {
      rec: (a, b) => boost(b) - boost(a) || score(b) - score(a),
      rating: (a, b) => score(b) - score(a),
      reviews: (a, b) => R(b).count - R(a).count,
      price_asc: (a, b) => (priceFrom(a) ?? 1e12) - (priceFrom(b) ?? 1e12),
      price_desc: (a, b) => (priceFrom(b) ?? -1) - (priceFrom(a) ?? -1),
      new: (a, b) => b.createdAt - a.createdAt
    };
    return list.sort(sorts[f.sort] || sorts.rec);
  }
  function updateMaster(id, p) {
    const m = master(id);
    if (!m) return Promise.resolve(false);
    Object.assign(m, p);
    return remote(T('masters').update(pick('masters', p)).eq('id', id));
  }
  function setMasterStatus(id, status, reason = '') {
    const m = master(id);
    if (!m) return;
    const was = m.status;
    addLog(was === 'blocked' && status === 'approved' ? 'Разблокировал анкету' : { approved: 'Одобрил анкету', rejected: 'Отклонил анкету', blocked: 'Заблокировал анкету' }[status], m.name + (reason ? ': ' + reason : ''));
    return updateMaster(id, { status, statusReason: reason });
  }
  function setVerified(id, v) {
    const m = master(id);
    if (!m) return;
    addLog(v ? 'Отметил проверенным' : 'Снял отметку «Проверен»', m.name);
    return updateMaster(id, { verified: v });
  }
  function deleteMaster(id) {
    const m = master(id);
    if (!m) return;
    addLog('Удалил анкету', m.name);
    db.masters = db.masters.filter(x => x.id !== id);
    db.reviews = db.reviews.filter(r => r.masterId !== id);
    db.requests = db.requests.filter(r => r.masterId !== id);
    const u = userById(m.userId);
    if (u && u.role === 'master') u.role = 'client';
    return remote(T('masters').delete().eq('id', id));
  }

  function trackView(id) {
    const u = user(), m = master(id);
    if (!m || (u && (u.id === m.userId || isStaff(u)))) return;
    let seen = [];
    try { seen = JSON.parse(sessionStorage.getItem(VKEY) || '[]'); } catch (e) {}
    if (seen.includes(id)) return;
    seen.push(id);
    try { sessionStorage.setItem(VKEY, JSON.stringify(seen)); } catch (e) {}
    m.views = (m.views || 0) + 1;
    remote(sb.rpc('track', { mid: id, kind: 'view' }), { silent: true });
  }
  function trackPhone(id) { const m = master(id); if (m) { m.phoneViews = (m.phoneViews || 0) + 1; remote(sb.rpc('track', { mid: id, kind: 'phone' }), { silent: true }); } }

  // ---------- фото
  async function uploadImage(dataUrl, kind) {
    const u = user();
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${u.id}/${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.jpg`;
    const { error } = await sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
  }
  function removeImage(url) {
    const mark = '/object/public/media/';
    const i = String(url || '').indexOf(mark);
    if (i < 0) return;
    sb.storage.from('media').remove([decodeURIComponent(url.slice(i + mark.length))]);
  }

  // ---------- избранное
  const isFav = id => { const u = user(); return !!u && (u.favs || []).includes(id); };
  function toggleFav(id) {
    const u = user();
    if (!u) return null;
    const favs = [...(u.favs || [])], i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    updateUser(u.id, { favs });
    return i < 0;
  }

  // ---------- отзывы
  const reviews = fn => db.reviews.filter(fn || (() => true));
  const review = id => db.reviews.find(r => r.id === id);
  const shortName = n => { const p = String(n).trim().split(/\s+/); return p[0] + (p[1] ? ' ' + p[1][0] + '.' : ''); };
  async function addReview({ masterId, rating, text }) {
    const u = user(), l = limit(u, 'reviews');
    if (l) return { error: `Вам запрещено оставлять отзывы ${until(l.until)}. Причина: ${l.reason}` };
    const r = { id: uuid(), masterId, userId: u.id, author: shortName(u.name), rating, text, date: now(), status: db.settings.reviewPremod ? 'pending' : 'published', reply: '', hideReason: '' };
    const okSave = await remote(T('reviews').insert(toSnake({ id: r.id, masterId, rating, text })));
    if (!okSave) return { error: 'skip' };
    db.reviews.push(r); rcache = null;
    return { review: r };
  }
  function editReview(id, { rating, text }) {
    const r = review(id);
    if (!r) return;
    Object.assign(r, { rating, text, edited: now() });
    if (db.settings.reviewPremod && r.status !== 'hidden') r.status = 'pending';
    return remote(T('reviews').update({ rating, text }).eq('id', id));
  }
  function replyReview(id, reply) { const r = review(id); if (r) { r.reply = reply; return remote(T('reviews').update({ reply }).eq('id', id)); } }
  function setReviewStatus(id, status, reason = '') {
    const r = review(id);
    if (!r) return;
    r.status = status; r.hideReason = reason;
    addLog(status === 'hidden' ? 'Скрыл отзыв' : 'Опубликовал отзыв', `${r.author} о мастере ${master(r.masterId)?.name || ''}${reason ? ': ' + reason : ''}`);
    return remote(T('reviews').update({ status, hide_reason: reason }).eq('id', id));
  }
  function deleteReview(id) {
    const r = review(id), u = user();
    if (!r) return;
    if (isStaff(u) && r.userId !== u.id) addLog('Удалил отзыв', `${r.author} о мастере ${master(r.masterId)?.name || ''}`);
    db.reviews = db.reviews.filter(x => x.id !== id);
    return remote(T('reviews').delete().eq('id', id));
  }
  function latestReviews(n) {
    return db.reviews.filter(r => r.status === 'published' && r.text && isVisible(master(r.masterId))).sort((a, b) => b.date - a.date).slice(0, n);
  }

  // ---------- заявки
  const requests = fn => db.requests.filter(fn || (() => true));
  async function addRequest(d) {
    const u = user(), l = limit(u, 'requests');
    if (l) return { error: `Вам запрещено отправлять заявки ${until(l.until)}. Причина: ${l.reason}` };
    const m = master(d.masterId);
    if (m?.away) return { error: 'Мастер сейчас не принимает заказы' };
    const r = { id: uuid(), masterId: d.masterId, userId: u?.id || null, name: d.name, phone: d.phone, text: d.text, when: d.when || '', date: now(), status: 'new' };
    const { error } = await T('requests').insert(toSnake({ id: r.id, masterId: r.masterId, name: r.name, phone: r.phone, text: r.text, when: r.when }));
    if (error) return { error: errText(error) };
    if (u) db.requests.push(r);
    return { request: r };
  }
  function updateRequest(id, p) { const r = db.requests.find(x => x.id === id); if (r) { Object.assign(r, p); return remote(T('requests').update(pick('requests', p)).eq('id', id)); } }
  function deleteRequest(id) { db.requests = db.requests.filter(r => r.id !== id); addLog('Удалил заявку', ''); return remote(T('requests').delete().eq('id', id)); }

  // ---------- жалобы
  const REPORT_REASONS = {
    master: ['Фейковая анкета', 'Мошенничество', 'Некорректные цены', 'Грубое общение', 'Чужие фото работ', 'Другое'],
    review: ['Ложный отзыв', 'Оскорбления', 'Спам или реклама', 'Отзыв не о мастере', 'Персональные данные', 'Другое']
  };
  const reports = fn => db.reports.filter(fn || (() => true));
  async function addReport({ type, targetId, reason, text }) {
    const u = user();
    if (!u) return { error: 'Войдите, чтобы отправить жалобу' };
    if (db.reports.some(r => r.userId === u.id && r.targetId === targetId && r.status === 'open')) return { error: 'Вы уже пожаловались, жалоба на рассмотрении' };
    const r = { id: uuid(), type, targetId, reason, text: text || '', userId: u.id, date: now(), status: 'open', resolution: '' };
    const { error } = await T('reports').insert(toSnake({ id: r.id, type, targetId, reason, text: r.text }));
    if (error) return { error: errText(error) };
    db.reports.push(r);
    return { report: r };
  }
  const reportTarget = r => r.type === 'review' ? review(r.targetId) : master(r.targetId);
  // Закрывает жалобу и все открытые жалобы на тот же объект
  function resolveReport(id, status, resolution) {
    const base = db.reports.find(r => r.id === id);
    if (!base) return;
    const u = user();
    const list = db.reports.filter(r => r.status === 'open' && (r.id === id || (r.targetId === base.targetId && r.type === base.type)));
    list.forEach(r => Object.assign(r, { status, resolution, by: u?.id, at: now() }));
    addLog(status === 'resolved' ? 'Закрыл жалобу' : 'Отклонил жалобу', `${base.reason}: ${resolution}`);
    return remote(T('reports').update({ status, resolution }).in('id', list.map(r => r.id)));
  }

  // ---------- санкции
  const SANCTION = { warn: 'Предупреждение', reviews: 'Запрет отзывов', requests: 'Запрет заявок', ban: 'Блокировка аккаунта' };
  function sanction(uid, { type, days, reason }) {
    const t = userById(uid), a = user();
    if (!canSanction(t, a)) return false;
    const rec = { until: days ? now() + days * DAY : FOREVER, reason, at: now(), by: a.id };
    const term = days ? `на ${days} дн.` : 'навсегда';
    let patch;
    if (type === 'warn') patch = { warnings: [...(t.warnings || []), { reason, at: now(), by: a.id }] };
    else if (type === 'ban') patch = { ban: rec };
    else patch = { limits: { ...(t.limits || {}), [type]: rec } };
    if (type === 'ban') { const m = masterByUser(uid); if (m) m.bannedUntil = rec.until; }
    addLog(type === 'warn' ? 'Вынес предупреждение' : `${SANCTION[type]} ${term}`, `${t.name}: ${reason}`);
    updateUser(uid, patch);
    return true;
  }
  function liftSanction(uid, type) {
    const t = userById(uid);
    if (!canSanction(t)) return;
    let patch;
    if (type === 'ban') { patch = { ban: null }; const m = masterByUser(uid); if (m) m.bannedUntil = 0; }
    else if (type === 'warn') patch = { warnings: [] };
    else { const l = { ...(t.limits || {}) }; delete l[type]; patch = { limits: l }; }
    addLog(type === 'warn' ? 'Снял предупреждения' : 'Снял ограничение: ' + SANCTION[type].toLowerCase(), t.name);
    return updateUser(uid, patch);
  }
  const isRestricted = u => isBanned(u) || !!limit(u, 'reviews') || !!limit(u, 'requests') || (u.warnings || []).length > 0;

  // ---------- продвижение: выдаёт владелец
  const PAY = { top: 'Топ', premium: 'Премиум', verify: 'Проверка' };
  const payments = () => db.payments;
  function buy(masterId, type, { days } = {}) {
    const m = master(masterId), s = db.settings;
    if (!m) return null;
    days = type === 'verify' ? 0 : (days || s.days[type]);
    const p = { id: uuid(), masterId, type, amount: 0, date: now(), gift: true, days, status: 'paid', by: user()?.id };
    if (type === 'verify') updateMaster(masterId, { verified: true });
    else { const key = type + 'Until'; updateMaster(masterId, { [key]: Math.max(now(), m[key] || 0) + days * DAY }); }
    db.payments.push(p);
    addLog(`Подключил «${PAY[type]}»${days ? ` на ${days} дн.` : ''}`, m.name);
    remote(T('payments').insert(toSnake(p)));
    return p;
  }
  // remove: отмена сразу после выдачи (запись удаляется), иначе отмена с пометкой
  function cancelPayment(id, { remove } = {}) {
    const p = db.payments.find(x => x.id === id);
    if (!p || p.status === 'refunded') return;
    const m = master(p.masterId);
    if (m) {
      if (p.type === 'verify') updateMaster(m.id, { verified: false });
      else { const key = p.type + 'Until'; let v = (m[key] || 0) - p.days * DAY; if (v <= now()) v = 0; updateMaster(m.id, { [key]: v }); }
    }
    if (remove) { db.payments = db.payments.filter(x => x.id !== id); remote(T('payments').delete().eq('id', id)); }
    else { p.status = 'refunded'; p.refundedAt = now(); remote(T('payments').update({ status: 'refunded', refunded_at: p.refundedAt }).eq('id', id)); }
    addLog('Отменил продвижение', `${PAY[p.type]}, ${m?.name || ''}`);
  }
  function revokePromo(masterId, type) {
    const m = master(masterId);
    if (!m) return;
    addLog(`Снял «${PAY[type]}»`, m.name);
    return updateMaster(masterId, { [type + 'Until']: 0 });
  }
  async function requestPromo(type) {
    const { error } = await sb.rpc('request_promo', { kind: type });
    return error ? { error: errText(error) } : {};
  }
  function activityByDay(days, list, key = 'date') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const t0 = start.getTime() - (days - 1) * DAY;
    const arr = Array.from({ length: days }, (_, i) => ({ date: t0 + i * DAY, n: 0 }));
    list.forEach(x => { const i = Math.floor((x[key] - t0) / DAY); if (i >= 0 && i < days) arr[i].n++; });
    return arr;
  }

  function stats() {
    const vis = visible(), ids = new Set(vis.map(m => m.id));
    const pub = db.reviews.filter(r => r.status === 'published' && ids.has(r.masterId));
    return { masters: vis.length, reviews: pub.length, avg: pub.length ? pub.reduce((s, r) => s + r.rating, 0) / pub.length : 0, cities: new Set(vis.map(m => m.city)).size };
  }
  function queue() {
    return { masters: db.masters.filter(m => m.status === 'pending').length, reviews: db.reviews.filter(r => r.status === 'pending').length, reports: db.reports.filter(r => r.status === 'open').length };
  }
  const exportJSON = () => JSON.stringify({ exportedAt: new Date().toISOString(), ...db }, null, 2);

  return {
    FOREVER, ROLES, REPORT_REASONS, SANCTION,
    init, reload, settings, saveSettings,
    can, isStaff, isBanned, limit, until, banText, canSanction, isRestricted,
    user, userById, login, logout, register, setPassword, changePassword, users, updateUser, deleteUser, setRole,
    myNotifs, unread, readNotifs, log,
    categories, cat, saveCategory, deleteCategory, catCounts, cityCounts,
    masters, master, masterByUser, isPremium, isTop, priceFrom, isVisible, rating, search, updateMaster, setMasterStatus, setVerified, deleteMaster, trackView, trackPhone,
    uploadImage, removeImage,
    isFav, toggleFav, reviews, review, addReview, editReview, replyReview, setReviewStatus, deleteReview, latestReviews,
    requests, addRequest, updateRequest, deleteRequest,
    reports, addReport, reportTarget, resolveReport, sanction, liftSanction,
    payments, buy, cancelPayment, revokePromo, requestPromo, activityByDay, stats, queue, exportJSON
  };
})();
