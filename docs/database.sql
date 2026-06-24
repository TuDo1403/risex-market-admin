create table if not exists users (
  github_id text primary key,
  login text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists market_reviews (
  id text primary key,
  share_id text not null unique,
  owner_github_id text not null references users(github_id),
  owner_login text not null,
  env text not null,
  draft_json jsonb not null,
  generated_tx_json jsonb not null,
  validation_json jsonb not null,
  shadow_json jsonb not null,
  status text not null check (status in ('draft', 'ready', 'revoked')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists review_events (
  id bigserial primary key,
  review_id text not null references market_reviews(id),
  actor_github_id text not null,
  event_type text not null,
  event_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
