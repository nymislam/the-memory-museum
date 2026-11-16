-- ============================================================================
-- THE MEMORY MUSEUM — LAUGNA DIGITALE
-- Schema, row-level security, storage and realtime policies.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------- enums
create type public.user_role     as enum ('customer', 'admin');
create type public.museum_status as enum ('draft', 'published');
create type public.plan_id       as enum ('starter', 'premium', 'luxury', 'custom');
create type public.room_kind     as enum ('entrance', 'first_memories', 'love', 'journey', 'final', 'custom');
create type public.member_role   as enum ('owner', 'partner');

-- ---------------------------------------------------------------- tables
create table public.users (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  full_name        text not null default '' check (char_length(full_name) <= 80),
  role             public.user_role not null default 'customer',
  consent_terms_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.museums (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.users (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 80),
  slug       text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  status     public.museum_status not null default 'draft',
  plan       public.plan_id not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index museums_owner_idx on public.museums (owner_id);

create table public.couples (
  id                uuid primary key default gen_random_uuid(),
  museum_id         uuid not null unique references public.museums (id) on delete cascade,
  partner_one_name  text not null default '' check (char_length(partner_one_name) <= 40),
  partner_two_name  text not null default '' check (char_length(partner_two_name) <= 40),
  anniversary_date  date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.museum_members (
  id         uuid primary key default gen_random_uuid(),
  museum_id  uuid not null references public.museums (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  role       public.member_role not null,
  created_at timestamptz not null default now(),
  unique (museum_id, user_id),
  unique (museum_id, role)            -- exactly one owner and at most one partner
);
create index museum_members_user_idx on public.museum_members (user_id);

create table public.museum_settings (
  museum_id          uuid primary key references public.museums (id) on delete cascade,
  welcome_message    text not null default '' check (char_length(welcome_message) <= 600),
  final_message      text not null default '' check (char_length(final_message) <= 1200),
  music_path         text,
  music_volume       numeric(3,2) not null default 0.40 check (music_volume between 0 and 1),
  allow_partner_edit boolean not null default false,
  updated_at         timestamptz not null default now()
);

create table public.rooms (
  id         uuid primary key default gen_random_uuid(),
  museum_id  uuid not null references public.museums (id) on delete cascade,
  kind       public.room_kind not null default 'custom',
  title      text not null check (char_length(title) between 1 and 60),
  subtitle   text not null default '' check (char_length(subtitle) <= 80),
  position   integer not null default 0,
  width      numeric(5,2) not null default 13 check (width between 8 and 30),
  depth      numeric(5,2) not null default 16 check (depth between 8 and 60),
  height     numeric(5,2) not null default 6.5 check (height between 4.5 and 12),
  wall_color text not null default '#F3EBDD' check (wall_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_museum_position_idx on public.rooms (museum_id, position);

create table public.photo_assets (
  id                   uuid primary key default gen_random_uuid(),
  museum_id            uuid not null references public.museums (id) on delete cascade,
  storage_path         text not null unique,
  mime_type            text not null check (mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm')),
  width                integer not null default 0 check (width >= 0),
  height               integer not null default 0 check (height >= 0),
  bytes                bigint  not null default 0 check (bytes between 0 and 52428800),
  uploaded_by          uuid references public.users (id) on delete set null,
  -- the uploader confirmed they have the right to use the image and that the people in it agree
  consent_confirmed_at timestamptz not null,
  created_at           timestamptz not null default now()
);
create index photo_assets_museum_idx on public.photo_assets (museum_id);

create table public.memories (
  id          uuid primary key default gen_random_uuid(),
  museum_id   uuid not null references public.museums (id) on delete cascade,
  room_id     uuid not null references public.rooms (id) on delete cascade,
  asset_id    uuid references public.photo_assets (id) on delete set null,
  title       text not null default '' check (char_length(title) <= 80),
  caption     text not null default '' check (char_length(caption) <= 240),
  message     text not null default '' check (char_length(message) <= 1200),
  memory_date date,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index memories_room_position_idx on public.memories (room_id, position);
create index memories_museum_idx on public.memories (museum_id);

create table public.avatars (
  id                   uuid primary key default gen_random_uuid(),
  museum_id            uuid not null references public.museums (id) on delete cascade,
  user_id              uuid not null references public.users (id) on delete cascade,
  display_name         text not null default '' check (char_length(display_name) <= 40),
  config               jsonb not null default '{}'::jsonb,
  reference_photo_path text,
  reference_consent_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (museum_id, user_id),
  -- a reference photograph may only be stored together with a recorded consent
  check (reference_photo_path is null or reference_consent_at is not null)
);

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  museum_id   uuid not null references public.museums (id) on delete cascade,
  email       text check (email is null or char_length(email) <= 254),
  token_hash  text not null unique,            -- sha-256 of the token; the token itself is never stored
  created_by  uuid not null references public.users (id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.users (id) on delete set null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index invitations_museum_idx on public.invitations (museum_id);

create table public.museum_sessions (
  id         uuid primary key default gen_random_uuid(),
  museum_id  uuid not null references public.museums (id) on delete cascade,
  started_by uuid references public.users (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);
create index museum_sessions_museum_idx on public.museum_sessions (museum_id, started_at desc);

create table public.player_presence (
  museum_id    uuid not null references public.museums (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  room_id      uuid references public.rooms (id) on delete set null,
  last_seen_at timestamptz not null default now(),
  primary key (museum_id, user_id)
);

-- ------------------------------------------------------ helper functions
-- SECURITY DEFINER so policies can consult membership without recursing into RLS.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_museum_member(p_museum uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.museum_members where museum_id = p_museum and user_id = auth.uid());
$$;

create or replace function public.is_museum_owner(p_museum uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.museums where id = p_museum and owner_id = auth.uid());
$$;

create or replace function public.can_edit_museum(p_museum uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.is_museum_owner(p_museum)
      or (public.is_museum_member(p_museum)
          and exists (select 1 from public.museum_settings s where s.museum_id = p_museum and s.allow_partner_edit));
$$;

create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger users_touch    before update on public.users           for each row execute function public.touch_updated_at();
create trigger museums_touch  before update on public.museums         for each row execute function public.touch_updated_at();
create trigger couples_touch  before update on public.couples         for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.museum_settings for each row execute function public.touch_updated_at();
create trigger rooms_touch    before update on public.rooms           for each row execute function public.touch_updated_at();
create trigger memories_touch before update on public.memories        for each row execute function public.touch_updated_at();
create trigger avatars_touch  before update on public.avatars         for each row execute function public.touch_updated_at();

-- New auth user → profile row.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, consent_terms_at)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80),
          case when new.raw_user_meta_data ->> 'accepted_terms' = 'true' then now() end)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers can never promote themselves, change a museum's plan or hand it to someone else.
-- (auth.uid() is null in the SQL editor and for the service role, which are trusted.)
create or replace function public.guard_privileged_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_table_name = 'users' and new.role is distinct from old.role then
    raise exception 'Only an administrator can change roles';
  end if;
  if tg_table_name = 'museums' and (new.plan is distinct from old.plan or new.owner_id is distinct from old.owner_id) then
    raise exception 'Only an administrator can change the plan or owner';
  end if;
  return new;
end $$;
create trigger users_guard   before update on public.users   for each row execute function public.guard_privileged_columns();
create trigger museums_guard before update on public.museums for each row execute function public.guard_privileged_columns();

-- Package limits, enforced in the database so the client cannot bypass them.
create or replace function public.plan_limit(p_plan public.plan_id, p_what text) returns integer
language sql immutable as $$
  select case p_what
    when 'photos' then case p_plan when 'starter' then 15 when 'premium' then 50 when 'luxury' then 150 else 500 end
    when 'rooms'  then case p_plan when 'starter' then 3  when 'premium' then 5  when 'luxury' then 8   else 16  end
  end;
$$;

create or replace function public.enforce_plan_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plan public.plan_id; v_count integer;
begin
  select plan into v_plan from public.museums where id = new.museum_id;
  if tg_table_name = 'photo_assets' then
    select count(*) into v_count from public.photo_assets where museum_id = new.museum_id;
    if v_count >= public.plan_limit(v_plan, 'photos') then raise exception 'Photograph limit reached for this package'; end if;
    if new.mime_type like 'video/%' and v_plan in ('starter', 'premium') then raise exception 'Video memories need the Luxury package'; end if;
  else
    select count(*) into v_count from public.rooms where museum_id = new.museum_id;
    if v_count >= public.plan_limit(v_plan, 'rooms') then raise exception 'Room limit reached for this package'; end if;
  end if;
  return new;
end $$;
create trigger photo_assets_limit before insert on public.photo_assets for each row execute function public.enforce_plan_limits();
create trigger rooms_limit        before insert on public.rooms        for each row execute function public.enforce_plan_limits();

-- ------------------------------------------------------------------- RPCs

-- Creates a museum with its couple, settings, default rooms, membership and avatar in one transaction.
create or replace function public.create_museum(p_name text, p_partner_one text, p_partner_two text default '', p_plan public.plan_id default 'starter')
returns public.museums
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_museum public.museums;
  v_slug text;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if not public.is_admin() and (select count(*) from public.museums where owner_id = v_uid) >= 3 then
    raise exception 'You already have three museums';
  end if;
  v_slug := trim(both '-' from regexp_replace(lower(left(p_name, 40)), '[^a-z0-9]+', '-', 'g'));
  v_slug := case when v_slug = '' then 'museum' else v_slug end || '-' || encode(gen_random_bytes(5), 'hex');

  insert into public.museums (owner_id, name, slug, plan) values (v_uid, trim(p_name), v_slug, p_plan) returning * into v_museum;
  insert into public.museum_members (museum_id, user_id, role) values (v_museum.id, v_uid, 'owner');
  insert into public.couples (museum_id, partner_one_name, partner_two_name) values (v_museum.id, trim(p_partner_one), trim(coalesce(p_partner_two, '')));
  insert into public.museum_settings (museum_id, welcome_message) values (v_museum.id, 'Welcome to our museum.');
  insert into public.avatars (museum_id, user_id, display_name) values (v_museum.id, v_uid, trim(p_partner_one));

  insert into public.rooms (museum_id, kind, title, subtitle, position, width, depth, height, wall_color) values
    (v_museum.id, 'entrance', 'The Grand Entrance', 'Welcome', 0, 16, 14, 8, '#F3EBDD'),
    (v_museum.id, 'first_memories', 'The First Memories Gallery', 'Where it began', 1, 13, 16, 6.5, '#EFE4D2');
  if p_plan <> 'starter' then
    insert into public.rooms (museum_id, kind, title, subtitle, position, width, depth, height, wall_color) values
      (v_museum.id, 'love', 'The Love Gallery', 'The years between', 2, 14, 18, 7, '#EADBCB'),
      (v_museum.id, 'journey', 'The Journey Gallery', 'Everywhere, together', 3, 13, 16, 6.5, '#DDCFBB');
  end if;
  insert into public.rooms (museum_id, kind, title, subtitle, position, width, depth, height, wall_color) values
    (v_museum.id, 'final', 'The Final Memory Room', 'For you', 4, 14, 14, 8, '#4A3525');
  return v_museum;
end $$;

-- Returns the raw invitation token exactly once. Only its SHA-256 hash is stored.
create or replace function public.create_invitation(p_museum uuid, p_email text default null)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if not (public.is_museum_owner(p_museum) or public.is_admin()) then raise exception 'Not allowed'; end if;
  -- rate limit: ten invitations per museum per hour
  if (select count(*) from public.invitations where museum_id = p_museum and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many invitations. Please try again later.';
  end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.invitations (museum_id, email, token_hash, created_by)
  values (p_museum, nullif(trim(coalesce(p_email, '')), ''), encode(digest(v_token, 'sha256'), 'hex'), auth.uid());
  return v_token;
end $$;

-- What an invited person may see before signing in: names only, never photographs.
create or replace function public.get_invitation(p_token text)
returns table (museum_name text, partner_one text, valid boolean)
language sql stable security definer set search_path = public, extensions as $$
  select m.name, c.partner_one_name,
         (i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  from public.invitations i
  join public.museums m on m.id = i.museum_id
  left join public.couples c on c.museum_id = m.id
  where i.token_hash = encode(digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.accept_invitation(p_token text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations;
  v_slug text;
  v_name text;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select * into v_inv from public.invitations
   where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'This invitation is no longer valid';
  end if;
  if exists (select 1 from public.museum_members where museum_id = v_inv.museum_id and user_id = v_uid) then
    raise exception 'You are already a member of this museum';
  end if;
  if exists (select 1 from public.museum_members where museum_id = v_inv.museum_id and role = 'partner') then
    raise exception 'This museum already has a partner';
  end if;
  select partner_two_name into v_name from public.couples where museum_id = v_inv.museum_id;
  insert into public.museum_members (museum_id, user_id, role) values (v_inv.museum_id, v_uid, 'partner');
  insert into public.avatars (museum_id, user_id, display_name) values (v_inv.museum_id, v_uid, coalesce(v_name, ''))
    on conflict (museum_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  select slug into v_slug from public.museums where id = v_inv.museum_id;
  return v_slug;
end $$;

-- Right to erasure. Deleting the auth user cascades through every table above.
-- The app removes the user's stored files through the Storage API before calling this.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.create_museum(text, text, text, public.plan_id) from public, anon;
revoke all on function public.create_invitation(uuid, text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.create_museum(text, text, text, public.plan_id) to authenticated;
grant execute on function public.create_invitation(uuid, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- ---------------------------------------------------- row-level security
alter table public.users           enable row level security;
alter table public.museums         enable row level security;
alter table public.couples         enable row level security;
alter table public.museum_members  enable row level security;
alter table public.museum_settings enable row level security;
alter table public.rooms           enable row level security;
alter table public.photo_assets    enable row level security;
alter table public.memories        enable row level security;
alter table public.avatars         enable row level security;
alter table public.invitations     enable row level security;
alter table public.museum_sessions enable row level security;
alter table public.player_presence enable row level security;

-- users
create policy users_select on public.users for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy users_update on public.users for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- museums (created only through create_museum)
create policy museums_select on public.museums for select to authenticated
  using (public.is_museum_member(id) or public.is_admin());
create policy museums_update on public.museums for update to authenticated
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy museums_delete on public.museums for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- members
create policy members_select on public.museum_members for select to authenticated
  using (public.is_museum_member(museum_id) or public.is_admin());
create policy members_delete on public.museum_members for delete to authenticated
  using ((public.is_museum_owner(museum_id) and role = 'partner') or (user_id = auth.uid() and role = 'partner') or public.is_admin());

-- content tables share one pattern: members read, editors write
create policy couples_select on public.couples for select to authenticated using (public.is_museum_member(museum_id) or public.is_admin());
create policy couples_write  on public.couples for update to authenticated using (public.can_edit_museum(museum_id)) with check (public.can_edit_museum(museum_id));

create policy settings_select on public.museum_settings for select to authenticated using (public.is_museum_member(museum_id) or public.is_admin());
create policy settings_write  on public.museum_settings for update to authenticated
  using (public.is_museum_owner(museum_id) or public.is_admin()) with check (public.is_museum_owner(museum_id) or public.is_admin());

create policy rooms_select on public.rooms for select to authenticated using (public.is_museum_member(museum_id) or public.is_admin());
create policy rooms_insert on public.rooms for insert to authenticated with check (public.can_edit_museum(museum_id));
create policy rooms_update on public.rooms for update to authenticated using (public.can_edit_museum(museum_id)) with check (public.can_edit_museum(museum_id));
create policy rooms_delete on public.rooms for delete to authenticated using (public.can_edit_museum(museum_id));

create policy assets_select on public.photo_assets for select to authenticated using (public.is_museum_member(museum_id) or public.is_admin());
create policy assets_insert on public.photo_assets for insert to authenticated
  with check (public.can_edit_museum(museum_id) and uploaded_by = auth.uid() and storage_path like museum_id::text || '/%');
create policy assets_delete on public.photo_assets for delete to authenticated using (public.can_edit_museum(museum_id));

create policy memories_select on public.memories for select to authenticated using (public.is_museum_member(museum_id) or public.is_admin());
create policy memories_insert on public.memories for insert to authenticated with check (public.can_edit_museum(museum_id));
create policy memories_update on public.memories for update to authenticated using (public.can_edit_museum(museum_id)) with check (public.can_edit_museum(museum_id));
create policy memories_delete on public.memories for delete to authenticated using (public.can_edit_museum(museum_id));

-- avatars: both partners see both avatars, each edits only their own
create policy avatars_select on public.avatars for select to authenticated using (public.is_museum_member(museum_id) or public.is_admin());
create policy avatars_insert on public.avatars for insert to authenticated
  with check ((user_id = auth.uid() and public.is_museum_member(museum_id)) or public.is_admin());
create policy avatars_update on public.avatars for update to authenticated
  using ((user_id = auth.uid() and public.is_museum_member(museum_id)) or public.is_admin())
  with check ((user_id = auth.uid() and public.is_museum_member(museum_id)) or public.is_admin());

-- invitations: created through create_invitation; the owner can list and revoke
create policy invitations_select on public.invitations for select to authenticated using (public.is_museum_owner(museum_id) or public.is_admin());
create policy invitations_update on public.invitations for update to authenticated
  using (public.is_museum_owner(museum_id) or public.is_admin()) with check (public.is_museum_owner(museum_id) or public.is_admin());
create policy invitations_delete on public.invitations for delete to authenticated using (public.is_museum_owner(museum_id) or public.is_admin());

-- visit log and presence
create policy sessions_select on public.museum_sessions for select to authenticated using (public.is_museum_member(museum_id) or public.is_admin());
create policy sessions_insert on public.museum_sessions for insert to authenticated with check (started_by = auth.uid() and (public.is_museum_member(museum_id) or public.is_admin()));
create policy sessions_update on public.museum_sessions for update to authenticated using (started_by = auth.uid()) with check (started_by = auth.uid());

create policy presence_select on public.player_presence for select to authenticated using (public.is_museum_member(museum_id) or public.is_admin());
create policy presence_insert on public.player_presence for insert to authenticated with check (user_id = auth.uid() and (public.is_museum_member(museum_id) or public.is_admin()));
create policy presence_update on public.player_presence for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- storage
-- One PRIVATE bucket. Objects live under "<museum_id>/…", and are only ever served
-- through short-lived signed URLs that members request for themselves.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', false, 52428800,
        array['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/ogg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy memories_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'memories' and (public.is_museum_member(public.try_uuid((storage.foldername(name))[1])) or public.is_admin()));

create policy memories_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memories' and (
      public.can_edit_museum(public.try_uuid((storage.foldername(name))[1]))
      -- any member may upload their own avatar reference photograph
      or (public.is_museum_member(public.try_uuid((storage.foldername(name))[1]))
          and (storage.foldername(name))[2] = 'avatars'
          and storage.filename(name) like auth.uid()::text || '-%')
    )
  );

create policy memories_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'memories' and (
      public.can_edit_museum(public.try_uuid((storage.foldername(name))[1]))
      or ((storage.foldername(name))[2] = 'avatars' and storage.filename(name) like auth.uid()::text || '-%')
    )
  );

-- --------------------------------------------------------------- realtime
-- Realtime Authorization: only members may join the private channel "museum:<museum_id>"
-- that carries live avatar positions.
create policy museum_channel_read on realtime.messages for select to authenticated
  using (
    split_part(realtime.topic(), ':', 1) = 'museum'
    and (public.is_museum_member(public.try_uuid(split_part(realtime.topic(), ':', 2))) or public.is_admin())
  );
create policy museum_channel_write on realtime.messages for insert to authenticated
  with check (
    split_part(realtime.topic(), ':', 1) = 'museum'
    and (public.is_museum_member(public.try_uuid(split_part(realtime.topic(), ':', 2))) or public.is_admin())
  );

-- ----------------------------------------------------------------- admin
-- After signing up, promote the first administrator from the SQL editor:
--   update public.users set role = 'admin' where email = 'you@example.com';
