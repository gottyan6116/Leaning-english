alter table public.preferences alter column value drop not null;
alter table public.preferences drop constraint valid_preference;
alter table public.preferences add constraint valid_preference check (
  (setting_key='mode' and value is not null and value in ('"ja"'::jsonb,'"en"'::jsonb)) or
  (setting_key='autoAdvance' and value is not null and jsonb_typeof(value)='boolean') or
  (setting_key in ('daily','weekly') and (value is null or value='null'::jsonb or
    case when jsonb_typeof(value)='number' then
      (value#>>'{}')::numeric=trunc((value#>>'{}')::numeric) and
      (value#>>'{}')::numeric between 1 and case when setting_key='daily' then 1440 else 10080 end
    else false end))
);
