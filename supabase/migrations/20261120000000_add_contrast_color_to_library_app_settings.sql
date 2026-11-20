alter table public.library_app_settings
  add column if not exists contrast_color text not null default '#c7f5ec';
