-- =====================================================================
-- Мастерок: схема базы данных для Supabase.
-- Откройте Supabase -> SQL Editor -> New query, вставьте файл целиком и нажмите Run.
-- Скрипт можно запускать повторно: он ничего не удаляет из данных.
-- Права проверяются на сервере (Row Level Security), поэтому подделать
-- роль или чужие данные из браузера нельзя.
-- =====================================================================


create or replace function public.now_ms() returns bigint language sql stable as $$
  select (extract(epoch from now()) * 1000)::bigint
$$;

-- ---------- таблицы
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null
);

create table if not exists public.categories (
  id text primary key,
  name text not null check (length(name) between 1 and 60),
  icon text not null default 'squares-four',
  sort int not null default 0
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '' check (length(name) <= 80),
  email text not null default '',
  phone text not null default '' check (length(phone) <= 30),
  role text not null default 'client' check (role in ('owner', 'moderator', 'master', 'client')),
  favs text[] not null default '{}',
  ban jsonb,
  limits jsonb not null default '{}',
  warnings jsonb not null default '[]',
  created_at bigint not null default now_ms()
);

create table if not exists public.masters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  category_id text references public.categories(id) on update cascade,
  city text not null default '',
  about text not null default '' check (length(about) <= 3000),
  experience int not null default 0 check (experience between 0 and 80),
  services jsonb not null default '[]',
  phone text not null default '' check (length(phone) <= 30),
  telegram text not null default '' check (length(telegram) <= 64),
  schedule text not null default '' check (length(schedule) <= 120),
  hue int not null default 20,
  avatar text,
  portfolio jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'blocked')),
  status_reason text not null default '',
  away boolean not null default false,
  verified boolean not null default false,
  premium_until bigint not null default 0,
  top_until bigint not null default 0,
  banned_until bigint not null default 0,
  views int not null default 0,
  phone_views int not null default 0,
  created_at bigint not null default now_ms()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  author text not null default '',
  rating int not null check (rating between 1 and 5),
  text text not null check (length(text) between 10 and 1000),
  date bigint not null default now_ms(),
  status text not null default 'published' check (status in ('published', 'pending', 'hidden')),
  reply text not null default '' check (length(reply) <= 600),
  hide_reason text not null default '',
  edited bigint
);
create unique index if not exists reviews_one_per_user on public.reviews (master_id, user_id) where user_id is not null;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (length(name) between 1 and 80),
  phone text not null check (length(phone) between 6 and 30),
  text text not null check (length(text) between 10 and 2000),
  when_txt text not null default '' check (length(when_txt) <= 120),
  date bigint not null default now_ms(),
  status text not null default 'new' check (status in ('new', 'accepted', 'done', 'declined'))
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('master', 'review')),
  target_id uuid not null,
  reason text not null check (length(reason) <= 80),
  text text not null default '' check (length(text) <= 1000),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date bigint not null default now_ms(),
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  resolution text not null default '',
  by uuid references public.profiles(id) on delete set null,
  at bigint
);
create unique index if not exists reports_one_open on public.reports (user_id, target_id) where status = 'open';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  link text not null default '',
  date bigint not null default now_ms(),
  read boolean not null default false
);
create index if not exists notifications_user on public.notifications (user_id, date desc);

create table if not exists public.log (
  id uuid primary key default gen_random_uuid(),
  at bigint not null default now_ms(),
  by uuid references public.profiles(id) on delete set null,
  action text not null,
  target text not null default ''
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  type text not null check (type in ('top', 'premium', 'verify')),
  amount int not null default 0,
  date bigint not null default now_ms(),
  gift boolean not null default true,
  days int not null default 0,
  status text not null default 'paid' check (status in ('paid', 'refunded')),
  by uuid references public.profiles(id) on delete set null,
  refunded_at bigint
);

-- ---------- вспомогательные функции
create or replace function public.my_role() returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('owner', 'moderator') from profiles where id = auth.uid()), false)
$$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'owner' from profiles where id = auth.uid()), false)
$$;
create or replace function public.is_banned(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (ban->>'until')::bigint > now_ms() from profiles where id = uid), false)
$$;
create or replace function public.is_limited(uid uuid, k text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (limits->k->>'until')::bigint > now_ms() from profiles where id = uid), false)
$$;
create or replace function public.owns_master(mid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from masters where id = mid and user_id = auth.uid())
$$;
create or replace function public.short_name(n text) returns text language sql immutable as $$
  select split_part(trim(n), ' ', 1) || case when split_part(trim(n), ' ', 2) <> '' then ' ' || left(split_part(trim(n), ' ', 2), 1) || '.' else '' end
$$;
create or replace function public.notify_user(uid uuid, msg text, lnk text default '') returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, text, link) select uid, msg, coalesce(lnk, '') where uid is not null
$$;
revoke execute on function public.notify_user(uuid, text, text) from public, anon, authenticated;

-- ---------- регистрация: профиль и анкета мастера создаются на сервере
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  r text := coalesce(meta->>'role', 'client');
  s jsonb := (select data from settings where id = 1);
begin
  if r not in ('client', 'master') then r := 'client'; end if;
  -- самый первый зарегистрированный пользователь становится владельцем
  if not exists (select 1 from profiles where role = 'owner') then r := 'owner'; end if;
  insert into profiles (id, name, email, phone, role)
  values (new.id, left(coalesce(meta->>'name', ''), 80), coalesce(new.email, ''), left(coalesce(meta->>'phone', ''), 30), r);
  if r = 'master' then
    insert into masters (user_id, name, category_id, city, phone, hue, status)
    values (new.id, left(coalesce(nullif(meta->>'name', ''), 'Мастер'), 80),
      (select id from categories where id = meta->>'category_id'),
      coalesce(meta->>'city', ''), left(coalesce(meta->>'phone', ''), 30), floor(random() * 360)::int,
      case when coalesce((s->>'autoApprove')::boolean, false) then 'approved' else 'pending' end);
    perform notify_user(new.id, 'Анкета создана. Заполните услуги и фото работ, после проверки она появится в каталоге', '/cabinet?tab=profile');
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- защита профиля: роль и санкции меняют только сотрудники
create or replace function public.protect_profile() returns trigger language plpgsql security definer set search_path = public as $$
declare me text := my_role();
begin
  if auth.uid() is null or current_setting('masterok.sys', true) = '1' then return new; end if;
  new.id := old.id; new.email := old.email; new.created_at := old.created_at;
  if old.id <> auth.uid() then
    new.name := old.name; new.phone := old.phone; new.favs := old.favs;
  end if;
  -- санкции: сотрудники, но не себе; модератор не трогает сотрудников; владельца не трогает никто
  if old.id = auth.uid() or me is null or me not in ('owner', 'moderator')
     or (me = 'moderator' and old.role in ('owner', 'moderator')) or old.role = 'owner' then
    new.ban := old.ban; new.limits := old.limits; new.warnings := old.warnings;
  end if;
  -- роли: только владелец, только client <-> moderator и master -> client
  if new.role is distinct from old.role then
    if me is distinct from 'owner' or old.id = auth.uid()
       or not ((old.role in ('client', 'moderator') and new.role in ('client', 'moderator')) or (old.role = 'master' and new.role = 'client')) then
      new.role := old.role;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile();

create or replace function public.after_profile() returns trigger language plpgsql security definer set search_path = public as $$
declare term text;
begin
  if new.role is distinct from old.role then
    if new.role = 'moderator' then perform notify_user(new.id, 'Вам выданы права модератора', '/admin');
    elsif old.role = 'moderator' then perform notify_user(new.id, 'Права модератора сняты', ''); end if;
  end if;
  if new.ban is distinct from old.ban then
    perform set_config('masterok.sys', '1', true);
    update masters set banned_until = coalesce((new.ban->>'until')::bigint, 0) where user_id = new.id;
    perform set_config('masterok.sys', '', true);
  end if;
  if new.limits is distinct from old.limits then
    if (new.limits->'reviews') is not null and (new.limits->'reviews') is distinct from (old.limits->'reviews') then
      perform notify_user(new.id, 'Запрет оставлять отзывы: ' || coalesce(new.limits->'reviews'->>'reason', ''), '/cabinet');
    end if;
    if (new.limits->'requests') is not null and (new.limits->'requests') is distinct from (old.limits->'requests') then
      perform notify_user(new.id, 'Запрет отправлять заявки: ' || coalesce(new.limits->'requests'->>'reason', ''), '/cabinet');
    end if;
    if (old.limits ? 'reviews' and not new.limits ? 'reviews') or (old.limits ? 'requests' and not new.limits ? 'requests') then
      perform notify_user(new.id, 'Ограничение снято', '/cabinet');
    end if;
  end if;
  if jsonb_array_length(new.warnings) > jsonb_array_length(old.warnings) then
    perform notify_user(new.id, 'Предупреждение от модератора: ' || coalesce(new.warnings->-1->>'reason', '') || '. При повторных нарушениях аккаунт будет ограничен', '/cabinet');
  end if;
  return new;
end $$;
drop trigger if exists after_profile on public.profiles;
create trigger after_profile after update on public.profiles for each row execute function public.after_profile();

-- ---------- анкеты мастеров
create or replace function public.protect_master() returns trigger language plpgsql security definer set search_path = public as $$
declare me text := my_role();
begin
  if auth.uid() is null or current_setting('masterok.sys', true) = '1' then return new; end if;
  new.id := old.id; new.user_id := old.user_id; new.created_at := old.created_at;
  new.views := old.views; new.phone_views := old.phone_views; new.banned_until := old.banned_until;
  if me is distinct from 'owner' then
    new.top_until := old.top_until; new.premium_until := old.premium_until;
  end if;
  if me is null or me not in ('owner', 'moderator') then
    new.verified := old.verified;
    if not (old.status = 'rejected' and new.status = 'pending') then
      new.status := old.status; new.status_reason := old.status_reason;
    end if;
  end if;
  -- сотрудник правит чужую анкету: меняется только модерация
  if old.user_id <> auth.uid() then
    new.name := old.name; new.category_id := old.category_id; new.city := old.city; new.about := old.about;
    new.experience := old.experience; new.services := old.services; new.phone := old.phone; new.telegram := old.telegram;
    new.schedule := old.schedule; new.hue := old.hue; new.avatar := old.avatar; new.portfolio := old.portfolio; new.away := old.away;
  end if;
  return new;
end $$;
drop trigger if exists protect_master on public.masters;
create trigger protect_master before update on public.masters for each row execute function public.protect_master();

create or replace function public.after_master() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from profiles where id = old.user_id) then
      perform set_config('masterok.sys', '1', true);
      update profiles set role = 'client' where id = old.user_id and role = 'master';
      perform set_config('masterok.sys', '', true);
      perform notify_user(old.user_id, 'Ваша анкета мастера удалена администрацией', '');
    end if;
    return old;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'approved' and old.status = 'blocked' then perform notify_user(new.user_id, 'Блокировка анкеты снята', '/cabinet');
    elsif new.status = 'approved' then perform notify_user(new.user_id, 'Ваша анкета опубликована в каталоге', '/m/' || new.id);
    elsif new.status = 'rejected' then perform notify_user(new.user_id, 'Анкета отклонена: ' || new.status_reason || '. Исправьте её и сохраните, она снова уйдёт на проверку', '/cabinet?tab=profile');
    elsif new.status = 'blocked' then perform notify_user(new.user_id, 'Анкета заблокирована: ' || new.status_reason, '/cabinet');
    end if;
  end if;
  if new.verified is distinct from old.verified then
    perform notify_user(new.user_id, case when new.verified then 'Ваша анкета получила отметку «Проверенный мастер»' else 'Отметка «Проверенный мастер» снята' end, '/cabinet?tab=promo');
  end if;
  if (old.top_until > now_ms() and new.top_until <= now_ms()) then perform notify_user(new.user_id, 'Продвижение «Топ» отключено', '/cabinet?tab=promo'); end if;
  if (old.premium_until > now_ms() and new.premium_until <= now_ms()) then perform notify_user(new.user_id, 'Продвижение «Премиум» отключено', '/cabinet?tab=promo'); end if;
  return new;
end $$;
drop trigger if exists after_master on public.masters;
create trigger after_master after update or delete on public.masters for each row execute function public.after_master();

-- ---------- отзывы
create or replace function public.before_review() returns trigger language plpgsql security definer set search_path = public as $$
declare
  me text := my_role();
  premod boolean := coalesce((select (data->>'reviewPremod')::boolean from settings where id = 1), false);
  is_author boolean; is_master boolean;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.author := short_name((select name from profiles where id = auth.uid()));
    new.date := now_ms(); new.reply := ''; new.hide_reason := ''; new.edited := null;
    new.status := case when premod then 'pending' else 'published' end;
    return new;
  end if;
  is_author := old.user_id = auth.uid();
  is_master := owns_master(old.master_id);
  new.id := old.id; new.master_id := old.master_id; new.author := old.author; new.date := old.date;
  if new.user_id is not null then new.user_id := old.user_id; end if;
  if not is_author then new.rating := old.rating; new.text := old.text; new.edited := old.edited; end if;
  if not is_master then new.reply := old.reply; end if;
  if me in ('owner', 'moderator') and not is_author then
    return new;
  end if;
  new.hide_reason := old.hide_reason;
  if is_author and (new.text is distinct from old.text or new.rating is distinct from old.rating) then
    new.edited := now_ms();
    new.status := case when old.status = 'hidden' then 'hidden' when premod then 'pending' else old.status end;
  else
    new.status := old.status;
  end if;
  return new;
end $$;
drop trigger if exists before_review on public.reviews;
create trigger before_review before insert or update on public.reviews for each row execute function public.before_review();

create or replace function public.after_review() returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select id, name, user_id into m from masters where id = new.master_id;
  if tg_op = 'INSERT' then
    if new.status = 'published' then perform notify_user(m.user_id, 'Новый отзыв: ' || new.rating || ' из 5', '/cabinet?tab=reviews'); end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'published' then
      perform notify_user(new.user_id, 'Ваш отзыв о мастере ' || m.name || ' опубликован', '/m/' || m.id);
      perform notify_user(m.user_id, 'Новый отзыв: ' || new.rating || ' из 5', '/cabinet?tab=reviews');
    elsif new.status = 'hidden' then
      perform notify_user(new.user_id, 'Ваш отзыв о мастере ' || m.name || ' скрыт: ' || new.hide_reason, '/cabinet?tab=reviews');
    end if;
  end if;
  if old.reply = '' and new.reply <> '' then
    perform notify_user(new.user_id, 'Мастер ' || m.name || ' ответил на ваш отзыв', '/m/' || m.id);
  end if;
  return new;
end $$;
drop trigger if exists after_review on public.reviews;
create trigger after_review after insert or update on public.reviews for each row execute function public.after_review();

-- ---------- заявки
create or replace function public.before_request() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.date := now_ms(); new.status := 'new';
    if (select count(*) from requests where phone = new.phone and date > now_ms() - 3600000) >= 5 then
      raise exception 'Слишком много заявок с этого номера. Попробуйте через час';
    end if;
    return new;
  end if;
  new.id := old.id; new.master_id := old.master_id; new.name := old.name;
  if new.user_id is not null then new.user_id := old.user_id; end if;
  new.phone := old.phone; new.text := old.text; new.when_txt := old.when_txt; new.date := old.date;
  return new;
end $$;
drop trigger if exists before_request on public.requests;
create trigger before_request before insert or update on public.requests for each row execute function public.before_request();

create or replace function public.after_request() returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select id, name, user_id into m from masters where id = new.master_id;
  if tg_op = 'INSERT' then
    perform notify_user(m.user_id, 'Новая заявка от ' || new.name, '/cabinet?tab=requests');
  elsif new.status is distinct from old.status then
    perform notify_user(new.user_id, 'Мастер ' || m.name || ': заявка ' || case new.status when 'accepted' then 'в работе' when 'done' then 'выполнена' when 'declined' then 'отклонена' else 'новая' end, '/cabinet?tab=requests');
  end if;
  return new;
end $$;
drop trigger if exists after_request on public.requests;
create trigger after_request after insert or update on public.requests for each row execute function public.after_request();

-- ---------- жалобы
create or replace function public.before_report() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.date := now_ms(); new.status := 'open'; new.resolution := ''; new.by := null; new.at := null;
    return new;
  end if;
  new.id := old.id; new.type := old.type; new.target_id := old.target_id; new.reason := old.reason; new.text := old.text;
  new.user_id := old.user_id; new.date := old.date;
  if new.status is distinct from old.status then new.by := auth.uid(); new.at := now_ms(); end if;
  return new;
end $$;
drop trigger if exists before_report on public.reports;
create trigger before_report before insert or update on public.reports for each row execute function public.before_report();

create or replace function public.after_report() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status <> 'open' then
    perform notify_user(new.user_id, case when new.status = 'resolved' then 'Жалоба рассмотрена: ' || lower(new.resolution) || '. Спасибо, что помогаете!' else 'Жалоба рассмотрена: нарушений не найдено' end, '');
  end if;
  return new;
end $$;
drop trigger if exists after_report on public.reports;
create trigger after_report after update on public.reports for each row execute function public.after_report();

-- ---------- выдачи продвижения
create or replace function public.after_payment() returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid; t text;
begin
  select user_id into uid from masters where id = coalesce(new.master_id, old.master_id);
  t := case coalesce(new.type, old.type) when 'top' then 'Топ' when 'premium' then 'Премиум' else 'Проверка' end;
  if tg_op = 'INSERT' then
    perform notify_user(uid, 'Вам подключено продвижение «' || t || '»' || case when new.days > 0 then ' на ' || new.days || ' дн.' else '' end, '/cabinet?tab=promo');
  elsif tg_op = 'UPDATE' and new.status = 'refunded' and old.status <> 'refunded' then
    perform notify_user(uid, 'Продвижение «' || t || '» отменено', '/cabinet?tab=promo');
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists after_payment on public.payments;
create trigger after_payment after insert or update on public.payments for each row execute function public.after_payment();

-- ---------- функции, которые вызывает сайт
create or replace function public.track(mid uuid, kind text) returns void language sql security definer set search_path = public as $$
  update masters set views = views + case when kind = 'view' then 1 else 0 end,
    phone_views = phone_views + case when kind = 'phone' then 1 else 0 end
  where id = mid and status = 'approved'
$$;

create or replace function public.request_promo(kind text) returns void language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select id, name into m from masters where user_id = auth.uid();
  if m.id is null then raise exception 'Анкета не найдена'; end if;
  if exists (select 1 from notifications n join profiles p on p.id = n.user_id where p.role = 'owner' and n.link = '/m/' || m.id and n.date > now_ms() - 86400000 and n.text like 'Мастер % просит%') then
    raise exception 'Заявка уже отправлена, администрация свяжется с вами';
  end if;
  insert into notifications (user_id, text, link)
  select id, 'Мастер ' || m.name || ' просит подключить «' || case kind when 'top' then 'Топ' when 'premium' then 'Премиум' else 'Проверенный мастер' end || '»', '/m/' || m.id
  from profiles where role = 'owner';
end $$;

create or replace function public.delete_me() returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if my_role() = 'owner' then raise exception 'Владелец не может удалить свой аккаунт'; end if;
  delete from auth.users where id = auth.uid();
end $$;

create or replace function public.admin_delete_user(uid uuid) returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not is_owner() then raise exception 'Недостаточно прав'; end if;
  if (select role from profiles where id = uid) = 'owner' then raise exception 'Нельзя удалить владельца'; end if;
  delete from auth.users where id = uid;
end $$;

-- ---------- права доступа (Row Level Security)
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.masters enable row level security;
alter table public.reviews enable row level security;
alter table public.requests enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.log enable row level security;
alter table public.payments enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on function public.track(uuid, text) to anon, authenticated;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy settings_read on public.settings for select using (true);
create policy settings_write on public.settings for update using (is_owner());

create policy categories_read on public.categories for select using (true);
create policy categories_insert on public.categories for insert with check (is_owner());
create policy categories_update on public.categories for update using (is_owner());
create policy categories_delete on public.categories for delete using (is_owner());

create policy profiles_read on public.profiles for select using (id = auth.uid() or is_staff());
create policy profiles_update on public.profiles for update using (id = auth.uid() or is_staff());

create policy masters_read on public.masters for select using ((status = 'approved' and banned_until < now_ms()) or user_id = auth.uid() or is_staff());
create policy masters_update on public.masters for update using ((user_id = auth.uid() and not is_banned(auth.uid())) or is_staff());
create policy masters_delete on public.masters for delete using (is_owner());

create policy reviews_read on public.reviews for select using (status = 'published' or user_id = auth.uid() or owns_master(master_id) or is_staff());
create policy reviews_insert on public.reviews for insert to authenticated with check (
  not is_banned(auth.uid()) and not is_limited(auth.uid(), 'reviews') and my_role() in ('client', 'master')
  and exists (select 1 from masters m where m.id = master_id and m.status = 'approved' and m.user_id <> auth.uid()));
create policy reviews_update on public.reviews for update using ((user_id = auth.uid() or owns_master(master_id)) and not is_banned(auth.uid()) or is_staff());
create policy reviews_delete on public.reviews for delete using (user_id = auth.uid() or is_owner());

create policy requests_read on public.requests for select using (user_id = auth.uid() or owns_master(master_id) or is_staff());
create policy requests_insert on public.requests for insert with check (
  (auth.uid() is null or (not is_banned(auth.uid()) and not is_limited(auth.uid(), 'requests')))
  and exists (select 1 from masters m where m.id = master_id and m.status = 'approved' and not m.away and m.banned_until < now_ms()));
create policy requests_update on public.requests for update using (owns_master(master_id) or is_owner());
create policy requests_delete on public.requests for delete using (is_owner());

create policy reports_read on public.reports for select using (user_id = auth.uid() or is_staff());
create policy reports_insert on public.reports for insert to authenticated with check (not is_banned(auth.uid()));
create policy reports_update on public.reports for update using (is_staff());

create policy notifications_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete using (user_id = auth.uid());

create policy log_read on public.log for select using (is_staff());
create policy log_insert on public.log for insert with check (is_staff() and by = auth.uid());

create policy payments_read on public.payments for select using (is_owner() or owns_master(master_id));
create policy payments_insert on public.payments for insert with check (is_owner());
create policy payments_update on public.payments for update using (is_owner());
create policy payments_delete on public.payments for delete using (is_owner());

-- ---------- начальные данные
insert into public.settings (id, data) values (1, jsonb_build_object(
  'siteName', 'Мастерок', 'region', 'Кемеровская область', 'regionShort', 'Кузбасс', 'regionIn', 'в Кузбассе',
  'cities', jsonb_build_array('Кемерово', 'Новокузнецк', 'Прокопьевск', 'Междуреченск', 'Ленинск-Кузнецкий', 'Киселёвск', 'Белово', 'Юрга', 'Анжеро-Судженск', 'Берёзовский', 'Осинники', 'Мыски', 'Топки', 'Гурьевск', 'Полысаево', 'Мариинск', 'Таштагол', 'Шерегеш'),
  'days', jsonb_build_object('top', 7, 'premium', 30),
  'autoApprove', false, 'reviewPremod', false, 'contactEmail', '', 'contactPhone', '', 'contactTelegram', ''
)) on conflict (id) do nothing;

insert into public.categories (id, name, icon, sort) values
  ('repair', 'Ремонт квартир', 'paint-roller', 1), ('plumbing', 'Сантехники', 'drop', 2), ('electric', 'Электрики', 'lightning', 3),
  ('nails', 'Маникюр и педикюр', 'sparkle', 4), ('hair', 'Парикмахеры', 'scissors', 5), ('tutors', 'Репетиторы', 'graduation-cap', 6),
  ('photo', 'Фото и видео', 'camera', 7), ('cleaning', 'Уборка', 'broom', 8), ('tech', 'Ремонт техники', 'washing-machine', 9),
  ('auto', 'Автоуслуги', 'car', 10), ('moving', 'Грузоперевозки', 'truck', 11), ('massage', 'Массаж и здоровье', 'hand-heart', 12),
  ('computer', 'Компьютерная помощь', 'desktop', 13), ('furniture', 'Сборка мебели', 'armchair', 14)
on conflict (id) do nothing;

-- STORAGE: фото мастеров (каждый пишет только в свою папку)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists media_read on storage.objects;
drop policy if exists media_insert on storage.objects;
drop policy if exists media_delete on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
