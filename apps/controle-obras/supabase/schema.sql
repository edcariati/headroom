-- Controle de Obras Cariati — estrutura do banco no Supabase
-- Cole este arquivo inteiro no Supabase: SQL Editor → New query → Run.
-- Pode ser executado de novo sem perder dados (é idempotente).

-- ---------------------------------------------------------------
-- 1. Registros do aplicativo
--    Cada item (obra, etapa, diário, ocorrência, compra…) é uma linha.
--    "colecao" diz o tipo, "id" identifica o item e "dados" guarda o conteúdo.
-- ---------------------------------------------------------------
create table if not exists public.registros (
  colecao        text        not null,
  id             text        not null,
  dados          jsonb       not null default '{}'::jsonb,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid        default auth.uid(),
  primary key (colecao, id)
);
create index if not exists registros_obra_idx on public.registros ((dados ->> 'obraId'));

create or replace function public.registros_carimbo()
returns trigger language plpgsql as $$
begin
  new.atualizado_em  := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;

drop trigger if exists registros_carimbo on public.registros;
create trigger registros_carimbo
  before update on public.registros
  for each row execute function public.registros_carimbo();

-- ---------------------------------------------------------------
-- 2. Histórico: toda criação, alteração e exclusão fica registrada,
--    com quem fez, quando e o conteúdo antes e depois.
-- ---------------------------------------------------------------
create table if not exists public.registros_historico (
  hid             bigint generated always as identity primary key,
  colecao         text        not null,
  registro_id     text        not null,
  acao            text        not null check (acao in ('criado', 'alterado', 'excluido')),
  dados_antes     jsonb,
  dados_depois    jsonb,
  feito_por       uuid,
  feito_por_email text,
  feito_em        timestamptz not null default now()
);
create index if not exists registros_historico_quando_idx on public.registros_historico (feito_em desc);
create index if not exists registros_historico_item_idx   on public.registros_historico (colecao, registro_id);

create or replace function public.registros_historico_grava()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quem  uuid := auth.uid();
  email text := auth.jwt() ->> 'email';
begin
  if tg_op = 'INSERT' then
    insert into registros_historico (colecao, registro_id, acao, dados_depois, feito_por, feito_por_email)
    values (new.colecao, new.id, 'criado', new.dados, quem, email);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.dados is distinct from old.dados then
      insert into registros_historico (colecao, registro_id, acao, dados_antes, dados_depois, feito_por, feito_por_email)
      values (new.colecao, new.id, 'alterado', old.dados, new.dados, quem, email);
    end if;
    return new;
  else
    insert into registros_historico (colecao, registro_id, acao, dados_antes, feito_por, feito_por_email)
    values (old.colecao, old.id, 'excluido', old.dados, quem, email);
    return old;
  end if;
end $$;

drop trigger if exists registros_historico_grava on public.registros;
create trigger registros_historico_grava
  after insert or update or delete on public.registros
  for each row execute function public.registros_historico_grava();

-- ---------------------------------------------------------------
-- 3. Perfis: nome de quem usa o app (aparece no histórico e nos registros)
-- ---------------------------------------------------------------
create table if not exists public.perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  nome          text,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 4. Segurança (RLS): só usuários com login acessam os dados.
--    O histórico é somente leitura para o app; quem grava é o gatilho.
-- ---------------------------------------------------------------
alter table public.registros           enable row level security;
alter table public.registros_historico enable row level security;
alter table public.perfis              enable row level security;

grant select, insert, update, delete on public.registros           to authenticated;
grant select                         on public.registros_historico to authenticated;
grant select, insert, update         on public.perfis              to authenticated;

drop policy if exists "equipe le registros"      on public.registros;
drop policy if exists "equipe cria registros"    on public.registros;
drop policy if exists "equipe altera registros"  on public.registros;
drop policy if exists "equipe exclui registros"  on public.registros;
create policy "equipe le registros"     on public.registros for select to authenticated using (true);
create policy "equipe cria registros"   on public.registros for insert to authenticated with check (true);
create policy "equipe altera registros" on public.registros for update to authenticated using (true) with check (true);
create policy "equipe exclui registros" on public.registros for delete to authenticated using (true);

drop policy if exists "equipe le historico" on public.registros_historico;
create policy "equipe le historico" on public.registros_historico for select to authenticated using (true);

drop policy if exists "equipe le perfis"      on public.perfis;
drop policy if exists "cada um cria o seu"    on public.perfis;
drop policy if exists "cada um altera o seu"  on public.perfis;
create policy "equipe le perfis"     on public.perfis for select to authenticated using (true);
create policy "cada um cria o seu"   on public.perfis for insert to authenticated with check (id = auth.uid());
create policy "cada um altera o seu" on public.perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------
-- 5. Tempo real: alterações de um aparecem na tela dos outros na hora.
-- ---------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registros') then
    alter publication supabase_realtime add table public.registros;
  end if;
end $$;

-- ---------------------------------------------------------------
-- 6. Armazenamento de fotos e PDFs (bucket "obras-arquivos").
--    Leitura pública pelo link (os nomes dos arquivos são aleatórios);
--    só usuários com login enviam arquivos.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('obras-arquivos', 'obras-arquivos', true)
on conflict (id) do nothing;

drop policy if exists "equipe envia arquivos" on storage.objects;
create policy "equipe envia arquivos" on storage.objects
  for insert to authenticated with check (bucket_id = 'obras-arquivos');
