-- Armazenamento do financeiro no Supabase: uma tabela de "arquivos" JSON (mesma ideia do Blob) dentro do schema privado
-- "financeiro", que a API pública não enxerga. O aplicativo só chega nela pelas funções abaixo, e cada uma exige o segredo
-- do aplicativo (guardado na tabela financeiro.config, que ninguém lê pela API). Sem o segredo, nada é lido nem gravado.
create schema if not exists financeiro;

create table if not exists financeiro.arquivos (
  caminho text primary key,
  dados jsonb not null,
  etag text not null default gen_random_uuid()::text,
  atualizado_em timestamptz not null default now()
);
create table if not exists financeiro.config (chave text primary key, valor text not null);
alter table financeiro.arquivos enable row level security;
alter table financeiro.config enable row level security;
revoke all on schema financeiro from anon, authenticated;
revoke all on all tables in schema financeiro from anon, authenticated;

-- O segredo é criado uma única vez, dentro do banco.
insert into financeiro.config (chave, valor) values ('segredo', encode(extensions.gen_random_bytes(32), 'hex')) on conflict do nothing;

create or replace function public.fin_autorizado(p_segredo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p_segredo = (select valor from financeiro.config where chave = 'segredo'), false)
$$;

create or replace function public.fin_listar(p_segredo text, p_prefixo text) returns table(caminho text, etag text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.fin_autorizado(p_segredo) then raise exception 'nao autorizado' using errcode = '28000'; end if;
  return query select a.caminho, a.etag from financeiro.arquivos a where starts_with(a.caminho, p_prefixo) order by a.caminho;
end $$;

create or replace function public.fin_ler(p_segredo text, p_caminho text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.fin_autorizado(p_segredo) then raise exception 'nao autorizado' using errcode = '28000'; end if;
  select a.dados into r from financeiro.arquivos a where a.caminho = p_caminho;
  return r;
end $$;

create or replace function public.fin_ler_muitos(p_segredo text, p_caminhos text[]) returns table(caminho text, dados jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.fin_autorizado(p_segredo) then raise exception 'nao autorizado' using errcode = '28000'; end if;
  return query select a.caminho, a.dados from financeiro.arquivos a where a.caminho = any(p_caminhos);
end $$;

create or replace function public.fin_gravar(p_segredo text, p_caminho text, p_dados jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare e text := gen_random_uuid()::text;
begin
  if not public.fin_autorizado(p_segredo) then raise exception 'nao autorizado' using errcode = '28000'; end if;
  insert into financeiro.arquivos (caminho, dados, etag, atualizado_em) values (p_caminho, p_dados, e, now())
  on conflict (caminho) do update set dados = excluded.dados, etag = excluded.etag, atualizado_em = now();
  return e;
end $$;

-- p_itens = [{"caminho": "...", "dados": {...}}, ...]
create or replace function public.fin_gravar_muitos(p_segredo text, p_itens jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.fin_autorizado(p_segredo) then raise exception 'nao autorizado' using errcode = '28000'; end if;
  insert into financeiro.arquivos (caminho, dados, etag, atualizado_em)
  select x.caminho, x.dados, gen_random_uuid()::text, now() from jsonb_to_recordset(p_itens) as x(caminho text, dados jsonb)
  on conflict (caminho) do update set dados = excluded.dados, etag = excluded.etag, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.fin_excluir(p_segredo text, p_caminho text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.fin_autorizado(p_segredo) then raise exception 'nao autorizado' using errcode = '28000'; end if;
  delete from financeiro.arquivos where caminho = p_caminho;
end $$;

-- Só a API (papel anon) executa as funções; a tabela em si fica fechada.
revoke all on function public.fin_autorizado(text), public.fin_listar(text, text), public.fin_ler(text, text), public.fin_ler_muitos(text, text[]),
  public.fin_gravar(text, text, jsonb), public.fin_gravar_muitos(text, jsonb), public.fin_excluir(text, text) from public;
grant execute on function public.fin_listar(text, text), public.fin_ler(text, text), public.fin_ler_muitos(text, text[]),
  public.fin_gravar(text, text, jsonb), public.fin_gravar_muitos(text, jsonb), public.fin_excluir(text, text) to anon;
