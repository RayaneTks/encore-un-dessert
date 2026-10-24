-- Familles de recettes (variantes) et rendement des bases.
alter table public.bases
  add column if not exists family text not null default '',
  add column if not exists yield_qty numeric,
  add column if not exists yield_label text not null default '';
