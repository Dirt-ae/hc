create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  device_id text not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (device_id),
  unique (ip_hash)
);

create table if not exists round_state (
  id int primary key default 1 check (id = 1),
  active boolean not null default false,
  submissions_open boolean not null default false,
  voting_locked boolean not null default false,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into round_state (id)
values (1)
on conflict (id) do nothing;

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  title text not null,
  edit_video_id text not null,
  proof_video_id text not null,
  created_at timestamptz not null default now(),
  unique (participant_id)
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  voter_device_id text not null,
  voter_ip_hash text not null,
  concept int not null check (concept between 1 and 10),
  individuality int not null check (individuality between 1 and 10),
  style_application int not null check (style_application between 1 and 10),
  execution int not null check (execution between 1 and 10),
  overall int not null check (overall between 1 and 10),
  created_at timestamptz not null default now(),
  unique (submission_id, voter_device_id),
  unique (submission_id, voter_ip_hash)
);
