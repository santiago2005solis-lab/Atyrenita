alter table public.hr_documents
  add column if not exists file_path text,
  add column if not exists file_size bigint not null default 0,
  add column if not exists mime_type text,
  add column if not exists uploaded_at timestamptz;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hr-documents',
  'hr-documents',
  false,
  4194304,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
