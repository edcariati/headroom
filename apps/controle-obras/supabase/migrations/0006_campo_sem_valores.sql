-- 0006 — O perfil "campo" (encarregado e apoio técnico) NUNCA recebe valores em R$.
-- Antes desta migração, campo lia compras, locações, contratos de prestador, danos e a obra
-- com todos os campos (inclusive preços). Agora:
--   * campo perde o acesso direto às tabelas com valores;
--   * lê versões SEM valores por funções (campo_ler), com lista branca de campos;
--   * grava recebimento de compra e movimentos de locação só por funções (campo_patch),
--     que mexem apenas em campos permitidos e são idempotentes (ops_aplicadas).
-- Também cria anexar_item (acrescentar contato/apontamento sem conflito de versão).

-- 1) Quem lê o quê (grupos novos para separar o que tem valor do que não tem)
update public.colecoes set grupo = 'obras_dados' where nome = 'obras';
update public.colecoes set grupo = 'termos' where nome = 'termos';
insert into public.permissoes(papel, grupo, nivel) values
 ('dono','obras_dados','E'),('gestor','obras_dados','E'),('financeiro','obras_dados','L'),('leitura','obras_dados','L'),
 ('dono','termos','E'),('gestor','termos','E'),('financeiro','termos','E'),('campo','termos','L'),('leitura','termos','L')
on conflict do nothing;
delete from public.permissoes where papel = 'campo' and grupo in ('suprimentos','contratos');
delete from public.permissoes where papel = 'campo' and grupo = 'obras' and false;  -- campo continua lendo etapas, cronograma etc. (sem valores)

-- 2) Versão sem valores dos dados (lista branca; chave desconhecida NUNCA passa)
create or replace function public.dados_sem_valores(tab text, d jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare ok text[];
begin
  if tab = 'obras' then
    return d - 'alcada' - 'margemPreco' - 'tolerAvanco' - 'empresaId' - 'abcA' - 'abcB';
  end if;
  ok := case tab
    when 'compras'        then array['obraId','item','etapa','un','qtd','dataUso','prazoEntrega','critico','sobMedida','concretagem','obs','status','criadoEm','entrega','conf']
    when 'locacoes'       then array['obraId','equipamento','fornecedorId','etapa','inicio','fimPrevisto','operador','status','criadoEm','apontamentos','entrada','devolucao']
    when 'contratosPrest' then array['obraId','prestadorId','escopo','inicio','fim','criterio','status','encerradoEm']
    when 'danos'          then array['obraId','descricao','local','causadorId','prazo','status','fotos']
    else null end;
  if ok is null then raise exception 'Coleção sem versão sem valores: %', tab; end if;
  return coalesce((select jsonb_object_agg(k, v) from jsonb_each(d) e(k, v) where k = any(ok)), '{}'::jsonb);
end $$;

-- 3) Leitura do campo (sem valores), sempre limitada às obras dele
create or replace function public.campo_ler(tab text, p_obra text default null)
returns table(id text, obra_id text, dados jsonb, versao integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.papel_atual() is distinct from 'campo' then raise exception 'Função do perfil campo'; end if;
  if tab not in ('obras','compras','locacoes','contratosPrest','danos') then raise exception 'Coleção inválida: %', tab; end if;
  return query execute format(
    'select t.id, t.obra_id, public.dados_sem_valores(%L, t.dados), t.versao from public.%I t
      where t.excluido_em is null and public.na_obra(%s) and ($1 is null or %s = $1)',
    tab, tab, case when tab = 'obras' then 't.id' else 't.obra_id' end, case when tab = 'obras' then 't.id' else 't.obra_id' end) using p_obra;
end $$;
revoke all on function public.campo_ler(text, text) from public, anon;
grant execute on function public.campo_ler(text, text) to authenticated;

-- 4) Operações já aplicadas (idempotência de reenvio vindo do aparelho)
create table if not exists public.ops_aplicadas (
  op_id text primary key,
  user_id uuid not null default auth.uid(),
  tabela text, registro_id text,
  em timestamptz not null default now()
);
alter table public.ops_aplicadas enable row level security;
revoke all on public.ops_aplicadas from anon, authenticated;

-- 5) Gravação do campo em compras e locações: só campos permitidos, só transições permitidas
create or replace function public.campo_patch(tab text, rid text, patch jsonb, p_op text)
returns integer language plpgsql security definer set search_path = public as $$
declare permitido text[]; oid text; st_ant text; st_novo text; filtrado jsonb := '{}'::jsonb; k text; n int;
begin
  if public.papel_atual() not in ('campo','gestor','dono') then raise exception 'Sem permissão'; end if;
  if tab = 'compras' then permitido := array['status','entrega','conf','hist'];
  elsif tab = 'locacoes' then permitido := array['status','apontamentos','entrada','devolucao'];
  else raise exception 'Coleção inválida: %', tab; end if;
  if coalesce(p_op,'') = '' then raise exception 'Operação sem identificador'; end if;
  insert into public.ops_aplicadas(op_id, tabela, registro_id) values (p_op, tab, rid) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return 0; end if;                                  -- já aplicada: reenvio não duplica
  execute format('select obra_id, dados->>''status'' from public.%I where id = $1 and excluido_em is null', tab) into oid, st_ant using rid;
  if oid is null then raise exception 'Registro não encontrado'; end if;
  if not public.na_obra(oid) then raise exception 'Sem acesso a esta obra'; end if;
  for k in select jsonb_object_keys(patch) loop
    if k = any(permitido) then filtrado := filtrado || jsonb_build_object(k, patch->k); end if;
  end loop;
  st_novo := filtrado->>'status';
  if st_novo is not null then
    if tab = 'compras' and (st_novo not in ('entregue','conferido','pedido','necessidade') or st_ant in ('pago')) then raise exception 'Transição de compra não permitida para este perfil'; end if;
    if tab = 'locacoes' and st_novo not in ('ativa','devolvida') then raise exception 'Transição de locação não permitida para este perfil'; end if;
  end if;
  execute format($q$update public.%I set dados = (dados || ($2 - 'apontamentos')) ||
      case when $2 ? 'apontamentos' then jsonb_build_object('apontamentos', coalesce(dados->'apontamentos','{}'::jsonb) || ($2->'apontamentos')) else '{}'::jsonb end
      where id = $1$q$, tab) using rid, filtrado;
  return 1;
end $$;
revoke all on function public.campo_patch(text, text, jsonb, text) from public, anon;
grant execute on function public.campo_patch(text, text, jsonb, text) to authenticated;

-- 6) Acrescentar item em lista (contato, etc.) sem depender de versão e sem duplicar
create or replace function public.anexar_item(tab text, rid text, campo text, item jsonb, p_op text)
returns integer language plpgsql security definer set search_path = public as $$
declare oid text; n int;
begin
  if not (tab, campo) in (('ocorrencias','interacoes'),('acoes','interacoes')) then raise exception 'Lista não permitida'; end if;
  if public.nivel_em(tab) is distinct from 'E' then raise exception 'Sem permissão em %', tab; end if;
  if coalesce(p_op,'') = '' then raise exception 'Operação sem identificador'; end if;
  insert into public.ops_aplicadas(op_id, tabela, registro_id) values (p_op, tab, rid) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return 0; end if;
  execute format('select obra_id from public.%I where id = $1 and excluido_em is null', tab) into oid using rid;
  if oid is null or not public.na_obra(oid) then raise exception 'Registro não encontrado'; end if;
  execute format('update public.%I set dados = jsonb_set(dados, %L, coalesce(dados->%L, ''[]''::jsonb) || jsonb_build_array($2)) where id = $1', tab, array[campo], campo) using rid, item;
  return 1;
end $$;
revoke all on function public.anexar_item(text, text, text, jsonb, text) from public, anon;
grant execute on function public.anexar_item(text, text, text, jsonb, text) to authenticated;
