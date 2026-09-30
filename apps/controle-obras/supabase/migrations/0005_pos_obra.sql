-- 7B — Pós-obra: garantias, chamados, visitas de 30/90/180 dias e satisfação.
-- Acesso do cliente: só a própria obra. Valor do reparo fica em tabela separada (chamadosCustos).
-- ATENÇÃO: eventos_notificaveis() tem espelho no app (COBX.eventosNotificaveis).

insert into public.colecoes(nome, grupo, tem_obra) values
 ('garantias','garantia',true),('chamadosGarantia','chamados',true),('chamadosCustos','custoGarantia',true),
 ('visitasPosObra','posobra',true),('pesquisasSatisfacao','satisfacao',true)
on conflict (nome) do nothing;

insert into public.permissoes(papel, grupo, nivel) values
 ('dono','garantia','E'),('dono','chamados','E'),('dono','custoGarantia','E'),('dono','posobra','E'),('dono','satisfacao','L'),
 ('gestor','garantia','E'),('gestor','chamados','E'),('gestor','custoGarantia','E'),('gestor','posobra','E'),('gestor','satisfacao','L'),('gestor','config','L'),
 ('financeiro','garantia','L'),('financeiro','chamados','L'),('financeiro','custoGarantia','E'),('financeiro','config','L'),
 ('campo','chamados','L'),('campo','posobra','L'),
 ('leitura','garantia','L'),('leitura','chamados','L'),('leitura','posobra','L')
on conflict do nothing;

do $$
declare c text;
begin
  foreach c in array array['garantias','chamadosGarantia','chamadosCustos','visitasPosObra','pesquisasSatisfacao'] loop
    perform public.criar_tabela_colecao(c);
    execute format('drop trigger if exists trg_registro on public.%I', c);
    execute format('create trigger trg_registro before insert or update on public.%I for each row execute function public.trg_registro()', c);
  end loop;
end $$;

-- Cliente: lê a própria obra e o pós-obra dela; abre chamado; responde pesquisa (uma por marco)
create policy obras_cliente on public.obras for select using (public.papel_atual() = 'cliente' and excluido_em is null and public.na_obra(id));
create policy garantias_cliente on public.garantias for select using (public.papel_atual() = 'cliente' and excluido_em is null and public.na_obra(obra_id));
create policy chamados_cliente_sel on public."chamadosGarantia" for select using (public.papel_atual() = 'cliente' and excluido_em is null and public.na_obra(obra_id));
create policy chamados_cliente_ins on public."chamadosGarantia" for insert with check (
  public.papel_atual() = 'cliente' and public.na_obra(obra_id)
  and dados->>'abertoPor' = 'cliente' and dados->>'status' = 'aberto' and coalesce(dados->>'parecer','') = '');
create policy visitas_cliente on public."visitasPosObra" for select using (public.papel_atual() = 'cliente' and excluido_em is null and dados->>'status' = 'realizada' and public.na_obra(obra_id));
create policy pesquisas_cliente_sel on public."pesquisasSatisfacao" for select using (public.papel_atual() = 'cliente' and excluido_em is null and public.na_obra(obra_id));
create policy pesquisas_cliente_ins on public."pesquisasSatisfacao" for insert with check (public.papel_atual() = 'cliente' and public.na_obra(obra_id));
-- (pesquisa: id = obra_marco, então responder duas vezes o mesmo marco é negado pela chave primária; sem UPDATE para o cliente)

-- Regras do chamado no servidor
create or replace function public.trg_chamado() returns trigger
language plpgsql security definer set search_path = public as $$
declare papel text := public.papel_atual(); ant jsonb := coalesce(old.dados,'{}'::jsonb); nov jsonb := new.dados;
begin
  if (nov->>'status' = 'negado' or nov->>'parecer' = 'nao_coberto') and coalesce(btrim(nov->>'justificativa'),'') = '' then
    raise exception 'Negar ou marcar como não coberto exige a justificativa';
  end if;
  if tg_op = 'UPDATE' and nov->>'status' = 'negado' and ant->>'status' is distinct from 'negado' and papel not in ('dono','gestor') then
    raise exception 'Só a diretoria ou a engenharia negam um chamado';
  end if;
  if tg_op = 'UPDATE' and nov->'aceiteCliente' is distinct from ant->'aceiteCliente' and papel is distinct from 'cliente' and coalesce(current_setting('app.aceite', true),'') <> 'on' then
    raise exception 'O aceite é do cliente';
  end if;
  return new;
end $$;
drop trigger if exists trg_chamado on public."chamadosGarantia";
create trigger trg_chamado before insert or update on public."chamadosGarantia" for each row execute function public.trg_chamado();

-- Cliente confirma (ou contesta) a resolução do chamado
create or replace function public.aceitar_chamado(rid text, aceito boolean, texto text default '') returns void
language plpgsql security definer set search_path = public as $$
declare oid text; st text;
begin
  if public.papel_atual() is distinct from 'cliente' then raise exception 'Somente o cliente confirma a resolução'; end if;
  if not aceito and coalesce(btrim(texto),'') = '' then raise exception 'Se não aceitar, explique o motivo'; end if;
  select obra_id, dados->>'status' into oid, st from public."chamadosGarantia" where id = rid and excluido_em is null;
  if oid is null or not public.na_obra(oid) then raise exception 'Chamado não encontrado'; end if;
  if st is distinct from 'resolvido' then raise exception 'O chamado ainda não foi marcado como resolvido'; end if;
  perform set_config('app.aceite', 'on', true);
  update public."chamadosGarantia" set dados = jsonb_set(
      case when aceito then dados else jsonb_set(dados, '{status}', '"em_atendimento"') end,
      '{aceiteCliente}', jsonb_build_object('aceito', aceito, 'texto', texto, 'data', current_date, 'por', auth.uid())) where id = rid;
  perform set_config('app.aceite', 'off', true);
end $$;
revoke all on function public.aceitar_chamado(text, boolean, text) from public, anon;
grant execute on function public.aceitar_chamado(text, boolean, text) to authenticated;

insert into public.notificacao_regras(tipo, titulo, critico, perfis_destino, aba) values
 ('chamado_novo',     'Chamado de garantia novo',                      false, array['gestor'],         'chamados'),
 ('chamado_fora_sla', 'Chamado de garantia fora do prazo (SLA)',       true,  array['dono','gestor'],  'chamados'),
 ('garantia_60',      'Garantia vence em até 60 dias',                 false, array['gestor'],         'garantias'),
 ('garantia_30',      'Garantia vence em até 30 dias',                 false, array['gestor'],         'garantias'),
 ('visita_proxima',   'Visita pós-obra nos próximos 7 dias',           false, array['gestor'],         'visitas'),
 ('satisfacao_baixa', 'Cliente respondeu a pesquisa com nota baixa',   false, array['dono'],           'satisfacao')
on conflict (tipo) do nothing;

create or replace function public.eventos_notificaveis(p_hoje date)
returns table(tipo text, obra_id text, registro_id text)
language sql stable security definer set search_path = public as $$
  with o as (
    select id, coalesce(nullif(dados->>'diasEscalar','')::int, 7) as dias,
           (dados->>'modalidade') = 'Administração de Obra' as adm
    from public.obras
    where excluido_em is null and coalesce(dados->>'situacao','') <> 'encerrada'
  ), oc as (
    select x.id, x.obra_id, x.dados, o.dias from public."ocorrencias" x join o on o.id = x.obra_id
    where x.excluido_em is null and coalesce(x.dados->>'status','') <> 'fechada'
  ), ct as (
    select x.id, x.obra_id, x.dados from public."contasPagar" x join o on o.id = x.obra_id and o.adm
    where x.excluido_em is null and x.dados->>'status' = 'aberta' and coalesce(x.dados->>'vencimento','') <> ''
  ), ap as (
    select x.id, x.obra_id, x.dados from public."aportes" x join o on o.id = x.obra_id and o.adm
    where x.excluido_em is null and coalesce(x.dados->>'dataRecebida','') = ''
      and coalesce(x.dados->>'dataPrevista','') <> ''
  ), ac as (
    select x.id, x.obra_id, x.dados, o.dias from public."acoes" x join o on o.id = x.obra_id
    where x.excluido_em is null and x.dados->>'status' = 'aberta' and coalesce(x.dados->>'prazo','') <> ''
      and (x.dados->>'prazo') < p_hoje::text
  ), oa as (
    select id, coalesce(nullif(dados->>'diasEscalar','')::int, 7) as dias from public.obras where excluido_em is null
  ), md as (
    select x.id, x.obra_id, x.dados, o.dias from public."medicoes" x join o on o.id = x.obra_id
    where x.excluido_em is null and x.dados->>'status' = 'em_analise' and coalesce(x.dados->>'analiseDesde','') <> ''
  )
  select 'oc_critica'::text, oc.obra_id, oc.id from oc where oc.dados->>'gravidade' = 'critica'
  union all
  select 'oc_vencida', oc.obra_id, oc.id from oc
   where coalesce(oc.dados->>'prazo','') <> '' and (oc.dados->>'prazo') < p_hoje::text
  union all
  select 'oc_escalada', oc.obra_id, oc.id from oc
   where coalesce(oc.dados->>'prazo','') <> '' and (oc.dados->>'prazo') < p_hoje::text
     and (p_hoje - (oc.dados->>'prazo')::date) > oc.dias
  union all
  select 'conta_vencida', ct.obra_id, ct.id from ct where (ct.dados->>'vencimento') < p_hoje::text
  union all
  select 'conta_a_vencer', ct.obra_id, ct.id from ct
   where (ct.dados->>'vencimento') >= p_hoje::text and (ct.dados->>'vencimento') <= (p_hoje + 3)::text
  union all
  select 'aporte_atrasado', ap.obra_id, ap.id from ap where (ap.dados->>'dataPrevista') < p_hoje::text
  union all
  select 'acao_vencida', ac.obra_id, ac.id from ac
  union all
  select 'acao_escalada', ac.obra_id, ac.id from ac where (p_hoje - (ac.dados->>'prazo')::date) > ac.dias
  union all
  select 'rfi_vencido', x.obra_id, x.id from public."rfis" x join o on o.id = x.obra_id
   where x.excluido_em is null and x.dados->>'status' = 'aberto' and coalesce(x.dados->>'prazo','') <> '' and (x.dados->>'prazo') < p_hoje::text
  union all
  select 'material_vencido', x.obra_id, x.id from public."materiais" x join o on o.id = x.obra_id
   where x.excluido_em is null and x.dados->>'resultado' = 'pendente' and coalesce(x.dados->>'prazo','') <> '' and (x.dados->>'prazo') < p_hoje::text
  union all
  select 'aditivo_parado', x.obra_id, x.id from public."aditivos" x join o on o.id = x.obra_id
   where x.excluido_em is null and x.dados->>'status' = 'aguardando_cliente' and coalesce(x.dados->>'enviadoEm','') <> ''
     and (p_hoje - left(x.dados->>'enviadoEm', 10)::date) > o.dias
  union all
  select 'chamado_novo', x.obra_id, x.id from public."chamadosGarantia" x join oa on oa.id = x.obra_id
   where x.excluido_em is null and x.dados->>'status' = 'aberto'
  union all
  select 'chamado_fora_sla', x.obra_id, x.id from public."chamadosGarantia" x join oa on oa.id = x.obra_id
   where x.excluido_em is null and coalesce(x.dados->>'criadoEm','') <> '' and x.dados->>'status' not in ('resolvido','negado')
     and ( (x.dados->>'status' = 'aberto' and (p_hoje - left(x.dados->>'criadoEm',10)::date) > coalesce(nullif(x.dados->>'slaRespDias','')::int, 3))
        or (p_hoje - left(x.dados->>'criadoEm',10)::date) > coalesce(nullif(x.dados->>'slaResDias','')::int, 30) )
  union all
  select 'garantia_30', x.obra_id, x.id from public."garantias" x join oa on oa.id = x.obra_id
   where x.excluido_em is null and coalesce(x.dados->>'fim','') <> ''
     and (x.dados->>'fim')::date - p_hoje between 0 and 30
  union all
  select 'garantia_60', x.obra_id, x.id from public."garantias" x join oa on oa.id = x.obra_id
   where x.excluido_em is null and coalesce(x.dados->>'fim','') <> ''
     and (x.dados->>'fim')::date - p_hoje between 31 and 60
  union all
  select 'visita_proxima', x.obra_id, x.id from public."visitasPosObra" x join oa on oa.id = x.obra_id
   where x.excluido_em is null and x.dados->>'status' = 'pendente' and coalesce(x.dados->>'dataPrevista','') <> ''
     and (x.dados->>'dataPrevista')::date - p_hoje between 0 and 7
  union all
  select 'satisfacao_baixa', x.obra_id, x.id from public."pesquisasSatisfacao" x join oa on oa.id = x.obra_id
   where x.excluido_em is null and coalesce(nullif(x.dados->'notas'->>'recomendacao',''),'10')::numeric < 7
  union all
  select 'medicao_parada', md.obra_id, md.id from md
   where (p_hoje - left(md.dados->>'analiseDesde', 10)::date) > md.dias
$$;
revoke all on function public.eventos_notificaveis(date) from public, anon, authenticated;
