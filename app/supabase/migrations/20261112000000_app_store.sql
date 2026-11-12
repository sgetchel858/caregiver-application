-- Casanté app store: app data only (family, calendar, saved prep sheets,
-- question lists, message drafts, settings). See app/DATA.md, Part 2.
--
-- Sign-in is Auth0 (Supabase third-party auth), so a user's id is the Auth0
-- `sub` claim (text), not an auth.users uuid.
--
-- DEMO DATA ONLY. prep_sheets.sheet, message_drafts.body, family_updates.summary
-- and the appointment text columns hold health details. Move to a
-- HIPAA-eligible store before real people's data goes in.

create schema if not exists private;
grant usage on schema private to authenticated;

/** The signed-in user's id: the `sub` claim of the Auth0 token. */
create function private.uid() returns text
language sql stable
set search_path = ''
as $$ select nullif(auth.jwt() ->> 'sub', '') $$;

create function private.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

-- One row per signed-in user (id = Auth0 sub)
create table public.app_users (
  id            text primary key default private.uid(),
  first_name    text not null,
  last_name     text not null,
  initials      text not null,
  avatar_color  text not null default '#A5D7C7',
  created_at    timestamptz not null default now()
);

create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                   -- "The Mitchells"
  created_by  text not null default private.uid() references public.app_users(id),
  created_at  timestamptz not null default now()
);
create index families_created_by on public.families (created_by);

-- Everyone in the family, whether or not they use the app.
-- A user who uses the app has their own row (app_user_id set).
create table public.family_members (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  app_user_id       text references public.app_users(id) on delete set null,  -- null for Mom, the kids, …
  health_member_id  text,                            -- Health API memberId, null if not connected
  first_name        text not null,
  relation          text not null,                   -- how the owner refers to them: "Mom"
  user_is           text not null,                   -- how they refer to the owner: "daughter"
  birth_year        int,
  initials          text not null,
  avatar_color      text not null default '#A5D7C7',
  sort_order        int not null default 0,
  unique (id, family_id),                            -- target for same-family foreign keys
  unique (family_id, app_user_id)
);
create index family_members_family on public.family_members (family_id, sort_order);

-- Who can see the family (owner, spouse, siblings…)
create table public.family_access (
  family_id    uuid not null references public.families(id) on delete cascade,
  app_user_id  text not null references public.app_users(id) on delete cascade,
  role         text not null check (role in ('owner', 'editor', 'viewer')),
  primary key (family_id, app_user_id)
);
create index family_access_user on public.family_access (app_user_id);

-- Who gets updates about whom ("Also update Dad and Mike")
create table public.care_circles (
  about_member_id   uuid not null references public.family_members(id) on delete cascade,
  notify_member_id  uuid not null references public.family_members(id) on delete cascade,
  primary key (about_member_id, notify_member_id),
  check (about_member_id <> notify_member_id)
);
create index care_circles_notify on public.care_circles (notify_member_id);

create table public.user_settings (
  app_user_id               text primary key default private.uid() references public.app_users(id) on delete cascade,
  large_text                boolean not null default false,
  share_updates_by_default  boolean not null default true
);

create table public.prep_sheets (
  id                uuid primary key default gen_random_uuid(),
  family_member_id  uuid not null references public.family_members(id) on delete cascade,
  visit_id          text not null,                 -- Health API visit id
  pins              jsonb not null default '[]',   -- [{kind:"vital", id, pinnedAt}]
  sheet             jsonb,                         -- PrepSheet snapshot (demo; holds health details)
  saved_by          text not null default private.uid() references public.app_users(id),
  saved_at          timestamptz not null default now(),
  unique (family_member_id, visit_id)
);

create table public.question_lists (
  family_member_id  uuid not null references public.family_members(id) on delete cascade,
  visit_id          text not null,
  items             jsonb not null default '[]',   -- [{id, text, checked, addedBy}]
  updated_at        timestamptz not null default now(),
  primary key (family_member_id, visit_id)
);

create table public.message_drafts (
  id                uuid primary key default gen_random_uuid(),
  family_member_id  uuid not null references public.family_members(id) on delete cascade,
  draft_key         text not null,                 -- the draft id the Health API gave ("draft-chk-1")
  to_clinician_id   text not null,
  to_name           text not null,
  to_role           text not null,
  channel           text not null default 'MyChart',
  body              text,                          -- demo; holds health details
  about_kind        text,                          -- 'interaction-check'
  about_id          text,
  sent_message_id   text,                          -- set after POST /messages succeeds
  created_by        text not null default private.uid() references public.app_users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (family_member_id, draft_key)
);

create table public.family_updates (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references public.families(id) on delete cascade,
  from_user_id     text not null default private.uid() references public.app_users(id),
  about_member_id  uuid not null,
  to_member_ids    uuid[] not null,
  summary          text not null,                  -- demo; holds health details
  ref_kind         text not null check (ref_kind in ('prep-sheet', 'message', 'interaction-check', 'appointment')),
  ref_id           text not null,
  created_at       timestamptz not null default now(),
  foreign key (about_member_id, family_id) references public.family_members(id, family_id) on delete cascade
);
create index family_updates_family on public.family_updates (family_id, created_at desc);

-- Family calendar: dated health events (visits, refills). Health events only.
create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references public.families(id) on delete cascade,
  family_member_id  uuid not null,
  kind              text not null check (kind in ('visit', 'refill')),
  title             text not null,                 -- "Neurology with Dr. Okafor"
  starts_on         date not null,
  starts_at         timestamp,                     -- wall-clock time, no zone; null = no set time (a refill)
  place             text,                          -- "Riverside Neurology"
  place_phone       text,
  note              text,                          -- "first visit, hand tremor"
  health_visit_id   text,                          -- Health API visit id, when the visit is in the records
  escort_member_id  uuid,                          -- who is taking them ("Who's taking Mom?")
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (family_member_id, family_id) references public.family_members(id, family_id) on delete cascade,
  foreign key (escort_member_id, family_id) references public.family_members(id, family_id)
    on delete set null (escort_member_id),
  check (starts_at is null or starts_at::date = starts_on)
);
create index appointments_family_day on public.appointments (family_id, starts_on);

-- Things that still need booking ("Flu shot · due this month")
create table public.to_book_items (
  id                     uuid primary key default gen_random_uuid(),
  family_id              uuid not null references public.families(id) on delete cascade,
  family_member_id       uuid not null,
  title                  text not null,
  due_by                 date not null,
  booked_appointment_id  uuid references public.appointments(id) on delete set null,  -- set once booked
  created_at             timestamptz not null default now(),
  foreign key (family_member_id, family_id) references public.family_members(id, family_id) on delete cascade
);
create index to_book_items_family on public.to_book_items (family_id, due_by);

create trigger touch_updated_at before update on public.question_lists
  for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.message_drafts
  for each row execute function private.touch_updated_at();
create trigger touch_updated_at before update on public.appointments
  for each row execute function private.touch_updated_at();

/* ------------------------------------------------------------------ */
/* Row-level security                                                  */
/* ------------------------------------------------------------------ */
-- A user reads rows for families they appear in through family_access, and
-- writes need the owner or editor role. The helpers are security definer so
-- the policies on family_access and family_members don't recurse.

create function private.family_role(fid uuid) returns text
language sql stable security definer
set search_path = ''
as $$
  select role from public.family_access
  where family_id = fid and app_user_id = private.uid()
$$;

create function private.can_read_family(fid uuid) returns boolean
language sql stable
set search_path = ''
as $$ select private.family_role(fid) is not null $$;

create function private.can_edit_family(fid uuid) returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(private.family_role(fid) in ('owner', 'editor'), false) $$;

create function private.member_family(mid uuid) returns uuid
language sql stable security definer
set search_path = ''
as $$ select family_id from public.family_members where id = mid $$;

create function private.shares_family_with(other text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_access mine
    join public.family_access theirs using (family_id)
    where mine.app_user_id = private.uid() and theirs.app_user_id = other
  )
$$;

create function private.created_family(fid uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.families where id = fid and created_by = private.uid()) $$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

alter table public.app_users      enable row level security;
alter table public.families       enable row level security;
alter table public.family_members enable row level security;
alter table public.family_access  enable row level security;
alter table public.care_circles   enable row level security;
alter table public.user_settings  enable row level security;
alter table public.prep_sheets    enable row level security;
alter table public.question_lists enable row level security;
alter table public.message_drafts enable row level security;
alter table public.family_updates enable row level security;
alter table public.appointments   enable row level security;
alter table public.to_book_items  enable row level security;

-- app_users: yourself, plus the people you share a family with (read only)
create policy app_users_select on public.app_users for select to authenticated
  using (id = private.uid() or private.shares_family_with(id));
create policy app_users_insert on public.app_users for insert to authenticated
  with check (id = private.uid());
create policy app_users_update on public.app_users for update to authenticated
  using (id = private.uid()) with check (id = private.uid());

-- user_settings: your own row
create policy user_settings_all on public.user_settings for all to authenticated
  using (app_user_id = private.uid()) with check (app_user_id = private.uid());

-- families
create policy families_select on public.families for select to authenticated
  using (private.can_read_family(id) or created_by = private.uid());
create policy families_insert on public.families for insert to authenticated
  with check (created_by = private.uid());
create policy families_update on public.families for update to authenticated
  using (private.can_edit_family(id)) with check (private.can_edit_family(id));
create policy families_delete on public.families for delete to authenticated
  using (private.family_role(id) = 'owner');

-- family_access: owners manage it; a family's creator may add themselves as its first owner
create policy family_access_select on public.family_access for select to authenticated
  using (private.can_read_family(family_id));
create policy family_access_insert on public.family_access for insert to authenticated
  with check (
    private.family_role(family_id) = 'owner'
    or (app_user_id = private.uid() and role = 'owner' and private.created_family(family_id))
  );
create policy family_access_update on public.family_access for update to authenticated
  using (private.family_role(family_id) = 'owner') with check (private.family_role(family_id) = 'owner');
create policy family_access_delete on public.family_access for delete to authenticated
  using (private.family_role(family_id) = 'owner');

-- Tables with a family_id
create policy family_members_select on public.family_members for select to authenticated
  using (private.can_read_family(family_id));
create policy family_members_write on public.family_members for all to authenticated
  using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));

create policy appointments_select on public.appointments for select to authenticated
  using (private.can_read_family(family_id));
create policy appointments_write on public.appointments for all to authenticated
  using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));

create policy to_book_items_select on public.to_book_items for select to authenticated
  using (private.can_read_family(family_id));
create policy to_book_items_write on public.to_book_items for all to authenticated
  using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));

create policy family_updates_select on public.family_updates for select to authenticated
  using (private.can_read_family(family_id));
create policy family_updates_insert on public.family_updates for insert to authenticated
  with check (private.can_edit_family(family_id) and from_user_id = private.uid());

-- Tables that hang off a family member
create policy care_circles_select on public.care_circles for select to authenticated
  using (private.can_read_family(private.member_family(about_member_id)));
create policy care_circles_write on public.care_circles for all to authenticated
  using (private.can_edit_family(private.member_family(about_member_id)))
  with check (
    private.can_edit_family(private.member_family(about_member_id))
    and private.member_family(notify_member_id) = private.member_family(about_member_id)
  );

create policy prep_sheets_select on public.prep_sheets for select to authenticated
  using (private.can_read_family(private.member_family(family_member_id)));
create policy prep_sheets_write on public.prep_sheets for all to authenticated
  using (private.can_edit_family(private.member_family(family_member_id)))
  with check (private.can_edit_family(private.member_family(family_member_id)) and saved_by = private.uid());

create policy question_lists_select on public.question_lists for select to authenticated
  using (private.can_read_family(private.member_family(family_member_id)));
create policy question_lists_write on public.question_lists for all to authenticated
  using (private.can_edit_family(private.member_family(family_member_id)))
  with check (private.can_edit_family(private.member_family(family_member_id)));

create policy message_drafts_select on public.message_drafts for select to authenticated
  using (private.can_read_family(private.member_family(family_member_id)));
create policy message_drafts_write on public.message_drafts for all to authenticated
  using (private.can_edit_family(private.member_family(family_member_id)))
  with check (private.can_edit_family(private.member_family(family_member_id)));

-- Signed-in users only. The publishable (anon) key alone reads nothing.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

/* ------------------------------------------------------------------ */
/* Demo seed                                                           */
/* ------------------------------------------------------------------ */

/**
 * Gives the signed-in user their own copy of the demo family (the Mitchells,
 * with the user as Sarah) the first time they open the app. Does nothing on
 * later calls. Returns the user's id.
 *
 * Mirrors src/services/mock/fixtures/app.ts. Remove before real users sign up.
 */
create function public.bootstrap_demo_family() returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  me text := private.uid();
  fam uuid;
  sarah uuid; margaret uuid; robert uuid; mike uuid; emma uuid; leo uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  insert into public.app_users (id, first_name, last_name, initials, avatar_color)
  values (me, 'Sarah', 'Mitchell', 'SM', '#A5D7C7')
  on conflict (id) do nothing;
  if not found then
    return me;  -- already set up
  end if;

  insert into public.user_settings (app_user_id) values (me);

  insert into public.families (name, created_by) values ('The Mitchells', me) returning id into fam;
  insert into public.family_access (family_id, app_user_id, role) values (fam, me, 'owner');

  insert into public.family_members (family_id, app_user_id, first_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, me, 'Sarah', 'Me', 'self', 1981, 'SM', '#A5D7C7', 0) returning id into sarah;

  insert into public.family_members (family_id, health_member_id, first_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'margaret', 'Margaret', 'Mom', 'daughter', 1948, 'MM', '#B4D455', 1) returning id into margaret;
  insert into public.family_members (family_id, health_member_id, first_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'robert', 'Robert', 'Dad', 'daughter', 1946, 'RM', '#A5D7C7', 2) returning id into robert;
  insert into public.family_members (family_id, health_member_id, first_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'mike', 'Mike', 'Husband', 'wife', 1979, 'MK', '#D8ECF5', 3) returning id into mike;
  insert into public.family_members (family_id, health_member_id, first_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'emma', 'Emma', 'Daughter', 'mom', 2012, 'EM', '#FFF6C8', 4) returning id into emma;
  insert into public.family_members (family_id, health_member_id, first_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'leo', 'Leo', 'Son', 'mom', 2017, 'LM', '#E8F5F1', 5) returning id into leo;

  insert into public.care_circles (about_member_id, notify_member_id) values
    (margaret, robert), (margaret, mike),
    (emma, mike), (leo, mike);

  insert into public.appointments
    (family_id, family_member_id, kind, title, starts_on, starts_at, place, place_phone, note, health_visit_id, escort_member_id)
  values
    (fam, margaret, 'visit', 'Neurology with Dr. Okafor', '2026-11-12', '2026-11-12 10:30:00',
     'Riverside Neurology', '(555) 014-3300', 'first visit, hand tremor', 'v-okafor', sarah),
    (fam, margaret, 'refill', 'Warfarin refill due', '2026-11-29', null,
     'Main Street Pharmacy', null, null, null, null),
    (fam, emma, 'visit', 'Annual physical', '2026-12-03', '2026-12-03 15:45:00',
     null, null, null, null, null);

  insert into public.to_book_items (family_id, family_member_id, title, due_by)
  values (fam, mike, 'Flu shot', '2026-11-30');

  return me;
end $$;

revoke all on function public.bootstrap_demo_family() from public, anon;
grant execute on function public.bootstrap_demo_family() to authenticated;
