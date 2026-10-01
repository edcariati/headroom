-- Documentos por etapa: modelos (do fluxo) e arquivos anexados a cada projeto
create table documento_modelos (
  id uuid primary key default gen_random_uuid(),
  etapa_codigo text not null references etapa_modelos(codigo) on delete cascade,
  nome text not null,
  padrao_arquivo text,          -- ex.: ATA_CAXXXXXX_BRF_DATA ; null = não precisa salvar
  ordem int not null default 0
);
create index on documento_modelos(etapa_codigo);

create table projeto_documentos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  etapa_codigo text not null references etapa_modelos(codigo),
  modelo_id uuid references documento_modelos(id) on delete set null,
  nome text not null,
  codigo_arquivo text,
  arquivo_path text not null,   -- caminho no bucket "documentos"
  arquivo_nome text not null,
  enviado_por uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on projeto_documentos(projeto_id);

alter table documento_modelos enable row level security;
alter table projeto_documentos enable row level security;
create policy docmod_ler on documento_modelos for select to authenticated using (true);
create policy docmod_admin on documento_modelos for all to authenticated using (is_admin()) with check (is_admin());
create policy projdoc_ler on projeto_documentos for select to authenticated using (true);
create policy projdoc_criar on projeto_documentos for insert to authenticated with check (true);
create policy projdoc_editar on projeto_documentos for update to authenticated using (true) with check (true);
create policy projdoc_excluir on projeto_documentos for delete to authenticated using (is_admin());

-- Bucket privado (arquivos acessados por link assinado)
insert into storage.buckets (id, name, public) values ('documentos','documentos',false)
on conflict (id) do nothing;
create policy documentos_ler on storage.objects for select to authenticated using (bucket_id = 'documentos');
create policy documentos_enviar on storage.objects for insert to authenticated with check (bucket_id = 'documentos');
create policy documentos_excluir on storage.objects for delete to authenticated using (bucket_id = 'documentos' and is_admin());
