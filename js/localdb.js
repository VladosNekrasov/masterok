// Тестовый режим: настоящий Postgres (PGlite) прямо в браузере вместо Supabase.
// Запускается та же схема supabase/setup.sql с теми же правами доступа.
// Данные хранятся только в этом браузере. Подтверждения по почте нет.
window.LocalDB = (() => {
  const SKEY = 'masterok_local_session', DBNAME = 'masterok-test', VERSION = 1;
  const JSONB = new Set(['services', 'portfolio', 'warnings', 'limits', 'ban', 'data']);
  const ARR = new Set(['favs']);
  const pgArr = a => '{' + a.map(x => '"' + String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',') + '}';
  const val = (k, v) => v === null || v === undefined ? null : ARR.has(k) ? pgArr(v) : (JSONB.has(k) || (typeof v === 'object')) ? JSON.stringify(v) : v;
  const ident = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('bad identifier ' + s); return s; };
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

  let pg = null, session = null, listener = () => {};
  const files = new Map();
  try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) {}
  const saveSession = () => { try { session ? localStorage.setItem(SKEY, JSON.stringify(session)) : localStorage.removeItem(SKEY); } catch (e) {} };
  const emit = ev => setTimeout(() => listener(ev, session));

  // Запрос от имени текущего пользователя, с проверкой прав в базе
  async function asUser(sql, params = []) {
    return pg.transaction(async tx => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [session?.user?.id || '']);
      await tx.exec(session ? 'set local role authenticated' : 'set local role anon');
      return tx.query(sql, params);
    });
  }
  const wrap = async fn => { try { return await fn(); } catch (e) { return { data: null, error: { message: e.message } }; } };

  function from(table) {
    ident(table);
    let op = 'select', payload = null, single = false, rng = null, lim = null;
    const where = [], params = [], orders = [];
    const p = v => { params.push(v); return '$' + params.length; };
    const q = {
      select() { return q; },
      eq(k, v) { where.push(`${ident(k)} = ${p(v)}`); return q; },
      in(k, vs) { where.push(vs.length ? `${ident(k)} in (${vs.map(p).join(',')})` : 'false'); return q; },
      order(k, o = {}) { orders.push(`${ident(k)} ${o.ascending === false ? 'desc' : 'asc'}`); return q; },
      range(a, b) { rng = [a, b]; return q; }, limit(n) { lim = n; return q; }, maybeSingle() { single = true; return q; },
      insert(v) { op = 'insert'; payload = v; return q; }, update(v) { op = 'update'; payload = v; return q; }, delete() { op = 'delete'; return q; },
      then(res, rej) { run().then(res, rej); }
    };
    const run = () => wrap(async () => {
      const w = where.length ? ' where ' + where.join(' and ') : '';
      if (op === 'insert') {
        for (const row of [].concat(payload)) {
          const ks = Object.keys(row).map(ident), vals = ks.map(k => val(k, row[k]));
          const ph = vals.map((_, i) => '$' + (i + 1));
          await asUser(`insert into public.${table} (${ks.join(',')}) values (${ph.join(',')})`, vals);
        }
        return { data: null, error: null };
      }
      if (op === 'update') {
        const ks = Object.keys(payload);
        if (!ks.length) return { data: null, error: null };
        const set = ks.map(k => `${ident(k)} = ${p(val(k, payload[k]))}`).join(', ');
        await asUser(`update public.${table} set ${set}${w}`, params);
        return { data: null, error: null };
      }
      if (op === 'delete') { await asUser(`delete from public.${table}${w}`, params); return { data: null, error: null }; }
      let sql = `select * from public.${table}${w}${orders.length ? ' order by ' + orders.join(', ') : ''}`;
      if (lim != null) sql += ` limit ${+lim}`;
      else if (rng) sql += ` limit ${rng[1] - rng[0] + 1} offset ${rng[0]}`;
      const r = await asUser(sql, params);
      return { data: single ? (r.rows[0] || null) : r.rows, error: null };
    });
    return q;
  }

  async function rpc(name, args = {}) {
    return wrap(async () => {
      const ks = Object.keys(args);
      const vals = ks.map(k => args[k]);
      await asUser(`select public.${ident(name)}(${ks.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')})`, vals);
      return { data: null, error: null };
    });
  }

  const auth = {
    async getSession() { return { data: { session } }; },
    onAuthStateChange(fn) { listener = fn; },
    async signUp({ email, password, options }) {
      return wrap(async () => {
        if ((await pg.query('select 1 from auth.users where email = $1', [email])).rows.length) return { data: { user: { identities: [] } }, error: null };
        if (password.length < 6) return { data: {}, error: { message: 'Password should be at least 6 characters' } };
        const r = await pg.query('insert into auth.users (email, raw_user_meta_data, pw) values ($1, $2, $3) returning id', [email, JSON.stringify(options?.data || {}), await sha(password)]);
        session = { user: { id: r.rows[0].id, email } };
        saveSession(); emit('SIGNED_IN');
        return { data: { session, user: { identities: [{}] } }, error: null };
      });
    },
    async signInWithPassword({ email, password }) {
      const r = await pg.query('select id from auth.users where email = $1 and pw = $2', [email, await sha(password)]);
      if (!r.rows.length) return { data: {}, error: { message: 'Invalid login credentials' } };
      const was = session?.user?.id;
      session = { user: { id: r.rows[0].id, email } };
      saveSession();
      if (was !== session.user.id) emit('SIGNED_IN');
      return { data: { session }, error: null };
    },
    async signOut() { session = null; saveSession(); emit('SIGNED_OUT'); return { error: null }; },
    async resetPasswordForEmail() { return { error: { message: 'В тестовом режиме письма не отправляются. Войдите в другой аккаунт или сбросьте тестовую базу' } }; },
    async updateUser({ password }) {
      if (!session) return { error: { message: 'Нужно войти' } };
      await pg.query('update auth.users set pw = $1 where id = $2', [await sha(password), session.user.id]);
      return { error: null };
    }
  };

  // Фото хранятся прямо в базе как data URL
  const storage = {
    from: () => ({
      async upload(path, blob) {
        const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
        files.set(path, url);
        return { error: null };
      },
      getPublicUrl: path => ({ data: { publicUrl: files.get(path) || '' } }),
      async remove() { return { error: null }; }
    })
  };

  async function create() {
    const { PGlite } = await import(new URL('vendor/pglite/index.js', document.baseURI).href);
    pg = new PGlite('idb://' + DBNAME);
    await pg.waitReady;
    const ready = (await pg.query(`select to_regclass('public.local_meta') as t`)).rows[0].t;
    if (!ready) {
      const sql = await (await fetch(new URL('supabase/setup.sql', document.baseURI).href, { cache: 'no-store' })).text();
      await pg.exec(`
        do $$ begin create role anon; exception when duplicate_object then null; end $$;
        do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
        create schema if not exists auth;
        create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb, pw text);
        create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
        grant usage on schema auth to anon, authenticated;
        grant execute on function auth.uid() to anon, authenticated;`);
      await pg.exec(sql.split('-- STORAGE')[0]);
      await pg.exec(`create table public.local_meta (v int); insert into public.local_meta values (${VERSION}); revoke all on public.local_meta from anon, authenticated;`);
    }
    if (session && !(await pg.query('select 1 from auth.users where id = $1', [session.user.id])).rows.length) { session = null; saveSession(); }
    return { from, rpc, auth, storage };
  }

  async function wipe() {
    try { await pg?.close(); } catch (e) {}
    localStorage.removeItem(SKEY);
    await new Promise(res => { const r = indexedDB.deleteDatabase('/pglite/' + DBNAME); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  }

  return { create, wipe };
})();
