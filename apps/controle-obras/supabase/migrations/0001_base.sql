-- Controle de Obras Cariati — migração 0001 (base, perfis, RLS, auditoria)
-- Rodar SOMENTE no projeto cariati-obras-dev. Produção só com confirmação do Edson.
-- Nunca usar a chave service_role no app. Exclusão é sempre lógica (excluido_em).

create table if not exists public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  papel text not null default 'leitura' check (papel in ('dono','gestor','financeiro','campo','cliente','leitura')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.obra_membros (
  obra_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (obra_id, user_id)
);

-- Matriz de permissões: dado, não código. nivel: 'L' leitura, 'E' leitura+escrita.
create table if not exists public.permissoes (
  papel text not null,
  grupo text not null,
  nivel text not null check (nivel in ('L','E')),
  primary key (papel, grupo)
);

-- Coleção -> grupo de permissão
create table if not exists public.colecoes (
  nome text primary key,
  grupo text not null,
  tem_obra boolean not null default true
);

insert into public.colecoes(nome, grupo, tem_obra) values
 ('obras','obras',true),('etapas','obras',true),('atividades','obras',true),('pacotes','obras',true),
 ('locs','obras',true),('servicos','obras',true),('eventos','obras',true),
 ('diarios','campo',true),('fichas','campo',true),('ocorrencias','campo',true),('atas','campo',true),('acoes','campo',true),
 ('docsLegais','campo',true),('docsPrest','campo',true),('rfis','campo',true),('materiais','campo',true),('treinamentos','campo',true),
 ('prestadores','cadastros',false),('fornecedores','cadastros',false),
 ('compras','suprimentos',true),('movEstoque','estoque',true),('locacoes','suprimentos',true),
 ('contratosPrest','contratos',true),('termos','contratos',true),('danos','contratos',true),
 ('orcamentos','orcamento',true),('orcItens','orcamento',true),('aditivos','orcamento',true),
 ('medicoes','medicao',true),('contasPagar','financeiro',true),('aportes','financeiro',true),
 ('empresas','dre',false),('contratosCliente','dre',true),('lancamentos','dre',false),
 ('relatorios','relatorio',true),('avaliacoes','avaliacao',true),('licoes','avaliacao',true),
 ('config','config',false)
on conflict (nome) do nothing;

-- L = leitura, E = escrita (aprovar/encerrar passam por RPC nos passos seguintes)
insert into public.permissoes(papel, grupo, nivel)
select p, g, n from (values
 ('dono','obras','E'),('dono','campo','E'),('dono','cadastros','E'),('dono','suprimentos','E'),('dono','estoque','E'),('dono','contratos','E'),('dono','orcamento','E'),('dono','medicao','E'),('dono','financeiro','E'),('dono','dre','E'),('dono','relatorio','E'),('dono','avaliacao','E'),('dono','config','E'),
 ('gestor','obras','E'),('gestor','campo','E'),('gestor','cadastros','E'),('gestor','suprimentos','E'),('gestor','estoque','E'),('gestor','contratos','E'),('gestor','orcamento','E'),('gestor','medicao','E'),('gestor','financeiro','L'),('gestor','relatorio','E'),('gestor','avaliacao','E'),
 ('financeiro','obras','L'),('financeiro','campo','L'),('financeiro','cadastros','E'),('financeiro','suprimentos','E'),('financeiro','estoque','L'),('financeiro','contratos','E'),('financeiro','orcamento','E'),('financeiro','medicao','E'),('financeiro','financeiro','E'),('financeiro','dre','E'),('financeiro','relatorio','E'),('financeiro','avaliacao','L'),
 ('campo','obras','L'),('campo','campo','E'),('campo','cadastros','L'),('campo','suprimentos','E'),('campo','estoque','E'),('campo','contratos','L'),
 ('leitura','obras','L'),('leitura','campo','L'),('leitura','cadastros','L'),('leitura','suprimentos','L'),('leitura','estoque','L'),('leitura','contratos','L'),('leitura','orcamento','L'),('leitura','medicao','L'),('leitura','financeiro','L'),('leitura','relatorio','L'),('leitura','avaliacao','L')
) v(p,g,n)
on conflict do nothing;

-- Funções de apoio (security definer para não cair em recursão de RLS)
create or replace function public.papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.perfis where user_id = auth.uid() and ativo
$$;

create or replace function public.nivel_em(tab text) returns text
language sql stable security definer set search_path = public as $$
  select p.nivel from public.permissoes p
  join public.colecoes c on c.grupo = p.grupo
  where c.nome = tab and p.papel = public.papel_atual()
$$;

create or replace function public.na_obra(oid text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.papel_atual() = 'dono'
      or exists (select 1 from public.obra_membros m where m.obra_id = oid and m.user_id = auth.uid())
$$;

-- Tabelas de dados: uma por coleção, mesmo formato
create or replace function public.criar_tabela_colecao(tab text) returns void
language plpgsql as $f$
begin
  execute format($t$
    create table if not exists public.%1$I (
      id text primary key,
      obra_id text,
      dados jsonb not null default '{}'::jsonb,
      versao integer not null default 1,
      criado_em timestamptz not null default now(),
      criado_por uuid default auth.uid(),
      atualizado_em timestamptz not null default now(),
      atualizado_por uuid default auth.uid(),
      excluido_em timestamptz
    )$t$, tab);
  execute format('create index if not exists %I on public.%I (obra_id)', tab || '_obra_idx', tab);
  execute format('alter table public.%I enable row level security', tab);
  execute format('alter table public.%I force row level security', tab);
  -- leitura: papel com nível L ou E, dentro da obra (ou sem obra), registro não excluído
  execute format($p$create policy %1$I on public.%2$I for select using (
      public.nivel_em(%2$L) is not null and excluido_em is null
      and (obra_id is null or public.na_obra(obra_id)))$p$, tab || '_sel', tab);
  execute format($p$create policy %1$I on public.%2$I for insert with check (
      public.nivel_em(%2$L) = 'E' and (obra_id is null or public.na_obra(obra_id)))$p$, tab || '_ins', tab);
  execute format($p$create policy %1$I on public.%2$I for update using (
      public.nivel_em(%2$L) = 'E' and (obra_id is null or public.na_obra(obra_id)))
      with check (public.nivel_em(%2$L) = 'E' and (obra_id is null or public.na_obra(obra_id)))$p$, tab || '_upd', tab);
  -- sem política de DELETE: exclusão física negada; exclusão é lógica (excluido_em)
  execute format('revoke all on public.%I from anon', tab);
  execute format('grant select, insert, update on public.%I to authenticated', tab);
end $f$;

-- Auditoria
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text not null,
  acao text not null,
  antes jsonb,
  depois jsonb,
  user_id uuid default auth.uid(),
  em timestamptz not null default now()
);
alter table public.auditoria enable row level security;
create policy auditoria_sel on public.auditoria for select using (public.papel_atual() = 'dono');
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

create or replace function public.trg_registro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.versao := old.versao + 1;
    new.atualizado_em := now();
    new.atualizado_por := auth.uid();
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
    if new.excluido_em is distinct from old.excluido_em and coalesce(current_setting('app.excluindo', true),'') <> 'on' then
      raise exception 'Exclusão só pela função excluir_registro';
    end if;
  end if;
  insert into public.auditoria(tabela, registro_id, acao, antes, depois)
  values (tg_table_name, new.id,
          case when tg_op = 'UPDATE' and new.excluido_em is not null and old.excluido_em is null then 'excluir' else lower(tg_op) end,
          case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;

do $$
declare c record;
begin
  for c in select nome from public.colecoes loop
    perform public.criar_tabela_colecao(c.nome);
    execute format('drop trigger if exists trg_registro on public.%I', c.nome);
    execute format('create trigger trg_registro before insert or update on public.%I for each row execute function public.trg_registro()', c.nome);
  end loop;
end $$;

-- Exclusão lógica: única via permitida (o UPDATE direto de excluido_em é bloqueado pelo gatilho)
create or replace function public.excluir_registro(tab text, rid text) returns void
language plpgsql security definer set search_path = public as $$
declare oid text; n int;
begin
  if not exists (select 1 from public.colecoes where nome = tab) then raise exception 'Coleção inválida'; end if;
  if public.nivel_em(tab) is distinct from 'E' then raise exception 'Sem permissão para excluir em %', tab; end if;
  execute format('select obra_id from public.%I where id = $1 and excluido_em is null', tab) into oid using rid;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Registro não encontrado'; end if;
  if oid is not null and not public.na_obra(oid) then raise exception 'Sem acesso a esta obra'; end if;
  perform set_config('app.excluindo', 'on', true);
  execute format('update public.%I set excluido_em = now() where id = $1', tab) using rid;
  perform set_config('app.excluindo', 'off', true);
end $$;
revoke all on function public.excluir_registro(text, text) from public, anon;
grant execute on function public.excluir_registro(text, text) to authenticated;

-- Tabelas de sistema: RLS ligada
alter table public.perfis enable row level security;
alter table public.obra_membros enable row level security;
alter table public.permissoes enable row level security;
alter table public.colecoes enable row level security;
create policy perfis_sel on public.perfis for select using (user_id = auth.uid() or public.papel_atual() = 'dono');
create policy perfis_dono on public.perfis for all using (public.papel_atual() = 'dono') with check (public.papel_atual() = 'dono');
create policy membros_sel on public.obra_membros for select using (user_id = auth.uid() or public.papel_atual() = 'dono');
create policy membros_dono on public.obra_membros for all using (public.papel_atual() = 'dono') with check (public.papel_atual() = 'dono');
create policy permissoes_sel on public.permissoes for select using (auth.uid() is not null);
create policy colecoes_sel on public.colecoes for select using (auth.uid() is not null);

grant select on public.perfis, public.obra_membros, public.permissoes, public.colecoes to authenticated;
grant insert, update on public.perfis, public.obra_membros to authenticated; -- a RLS limita ao dono
grant usage on schema public to authenticated;
