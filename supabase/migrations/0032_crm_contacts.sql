-- CRM foundation: a contact is one human being, however they reached the shop.
--
-- Until now a customer existed as up to three unrelated rows: an account on the storefront
-- (profiles), a person in the bot (bot_users) and, from now on, nothing at all for orders a
-- manager takes by phone. Contacts tie those together, keyed by phone, which is the one
-- identifier a manager always has.

create table if not exists public.contacts (
  id          bigint generated always as identity primary key,
  city        text not null,
  full_name   text,
  phone       text,
  email       text,
  telegram_id bigint,
  user_id     uuid references public.profiles(id) on delete set null,
  tags        text[] not null default '{}',
  blocked     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint contacts_city_chk check (city in ('katowice', 'gliwice', 'warszawa'))
);
-- One phone is one person. Contacts without a phone are allowed (a walk-in with no number)
-- but cannot be deduplicated, so the interface asks for it.
create unique index if not exists contacts_phone_uniq on public.contacts (phone) where phone is not null;
create unique index if not exists contacts_tg_uniq on public.contacts (telegram_id) where telegram_id is not null;
create unique index if not exists contacts_user_uniq on public.contacts (user_id) where user_id is not null;
create index if not exists contacts_city_idx on public.contacts (city);

alter table public.contacts enable row level security;
drop policy if exists contacts_staff on public.contacts;
create policy contacts_staff on public.contacts
  for all using (public.admin_sees_city(city)) with check (public.admin_sees_city(city));

-- Notes carry an author and a time, otherwise "he promised to call back" is worthless.
create table if not exists public.contact_notes (
  id         bigint generated always as identity primary key,
  contact_id bigint not null references public.contacts(id) on delete cascade,
  author     uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint contact_notes_len check (length(body) between 1 and 2000)
);
create index if not exists contact_notes_contact_idx on public.contact_notes (contact_id, created_at desc);
alter table public.contact_notes enable row level security;
drop policy if exists contact_notes_staff on public.contact_notes;
create policy contact_notes_staff on public.contact_notes
  for all using (exists (select 1 from public.contacts c where c.id = contact_id and public.admin_sees_city(c.city)))
  with check (exists (select 1 from public.contacts c where c.id = contact_id and public.admin_sees_city(c.city)));

-- Tags are a fixed list the owner edits, not free text: free tags turn into fifteen spellings
-- of "wholesale" within a month.
create table if not exists public.crm_tags (
  name  text primary key,
  color text not null default 'muted',
  constraint crm_tags_len check (length(name) between 1 and 24)
);
alter table public.crm_tags enable row level security;
drop policy if exists crm_tags_read on public.crm_tags;
create policy crm_tags_read on public.crm_tags for select using (public.is_admin());
drop policy if exists crm_tags_write on public.crm_tags;
create policy crm_tags_write on public.crm_tags for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());
insert into public.crm_tags (name, color) values
  ('оптовик', 'ok'), ('постоянный', 'accent'), ('VIP', 'warn'), ('проблемный', 'danger')
  on conflict (name) do nothing;

-- Why a deal was lost is the one thing a sales report cannot reconstruct afterwards.
create table if not exists public.cancel_reasons (
  id     smallint generated always as identity primary key,
  name   text not null unique,
  active boolean not null default true
);
alter table public.cancel_reasons enable row level security;
drop policy if exists cancel_reasons_read on public.cancel_reasons;
create policy cancel_reasons_read on public.cancel_reasons for select using (public.is_admin());
drop policy if exists cancel_reasons_write on public.cancel_reasons;
create policy cancel_reasons_write on public.cancel_reasons for all
  using (public.is_owner_or_dev()) with check (public.is_owner_or_dev());
insert into public.cancel_reasons (name) values
  ('передумал'), ('нет в наличии'), ('не вышел на связь'), ('дорого'), ('дубль заказа'), ('другое')
  on conflict (name) do nothing;

-- Orders gain the CRM fields. Nothing existing changes meaning.
alter table public.orders add column if not exists contact_id       bigint references public.contacts(id) on delete set null;
alter table public.orders add column if not exists source           text not null default 'shop';
alter table public.orders add column if not exists cancel_reason_id smallint references public.cancel_reasons(id);
alter table public.orders add column if not exists manager_id       uuid references public.profiles(id) on delete set null;
alter table public.orders drop constraint if exists orders_source_chk;
alter table public.orders add constraint orders_source_chk check (source in ('shop', 'manual'));
create index if not exists orders_contact_idx on public.orders (contact_id);

-- Two more funnel stages between "confirmed" and "done".
alter table public.orders drop constraint if exists orders_status_chk;
alter table public.orders add constraint orders_status_chk
  check (status in ('new', 'confirmed', 'packed', 'shipped', 'done', 'cancelled'));

-- Who changed what. The only way to settle an argument about a price or a status later.
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid references public.profiles(id) on delete set null,
  actor_role text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  detail     jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);
alter table public.audit_log enable row level security;
-- Reading the log is an owner matter; nobody writes to it directly, only the RPCs below do.
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select using (public.is_owner_or_dev());

create or replace function public.audit(p_action text, p_entity text, p_id text, p_detail jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor, actor_role, action, entity, entity_id, detail)
  values (auth.uid(), public.admin_role(), p_action, p_entity, p_id, p_detail);
$$;

notify pgrst, 'reload schema';
