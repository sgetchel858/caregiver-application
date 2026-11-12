-- Member profiles: family members get a last name, so a profile can show a
-- full name ("Mike Mitchell") before any health records are connected.
--
-- The user's own entry (app_user_id set) already exists; the app now shows it
-- as part of the family. Editing it also updates app_users.

alter table public.family_members add column last_name text not null default '';

-- Existing rows: the user's own entry takes their name; the demo family shares it.
update public.family_members m
set last_name = u.last_name
from public.families f
join public.app_users u on u.id = f.created_by
where f.id = m.family_id and m.last_name = '';

/**
 * Same demo seed as before, now with last names.
 * Mirrors src/services/mock/fixtures/app.ts. Remove before real users sign up.
 */
create or replace function public.bootstrap_demo_family() returns text
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

  insert into public.family_members (family_id, app_user_id, first_name, last_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, me, 'Sarah', 'Mitchell', 'Me', 'self', 1981, 'SM', '#A5D7C7', 0) returning id into sarah;

  insert into public.family_members (family_id, health_member_id, first_name, last_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'margaret', 'Margaret', 'Mitchell', 'Mom', 'daughter', 1948, 'MM', '#B4D455', 1) returning id into margaret;
  insert into public.family_members (family_id, health_member_id, first_name, last_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'robert', 'Robert', 'Mitchell', 'Dad', 'daughter', 1946, 'RM', '#A5D7C7', 2) returning id into robert;
  insert into public.family_members (family_id, health_member_id, first_name, last_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'mike', 'Mike', 'Mitchell', 'Husband', 'wife', 1979, 'MK', '#D8ECF5', 3) returning id into mike;
  insert into public.family_members (family_id, health_member_id, first_name, last_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'emma', 'Emma', 'Mitchell', 'Daughter', 'mom', 2012, 'EM', '#FFF6C8', 4) returning id into emma;
  insert into public.family_members (family_id, health_member_id, first_name, last_name, relation, user_is, birth_year, initials, avatar_color, sort_order)
  values (fam, 'leo', 'Leo', 'Mitchell', 'Son', 'mom', 2017, 'LM', '#E8F5F1', 5) returning id into leo;

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

