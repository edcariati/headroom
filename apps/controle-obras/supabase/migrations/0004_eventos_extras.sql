-- 7A.2 — mais eventos do catálogo, resumo semanal da diretoria.
-- ATENÇÃO: eventos_notificaveis() tem espelho no app (COBX.eventosNotificaveis). Mudou aqui, muda lá.

insert into public.notificacao_regras(tipo, titulo, critico, perfis_destino, aba) values
 ('acao_vencida',    'Ação de reunião vencida',                         false, array['gestor'], 'reunioes'),
 ('acao_escalada',   'Ação de reunião vencida há muitos dias: diretoria', true, array['dono'],   'reunioes'),
 ('rfi_vencido',     'RFI sem resposta e vencido',                      false, array['gestor'], 'projeto'),
 ('material_vencido','Decisão de material ou amostra vencida',          false, array['gestor'], 'projeto'),
 ('aditivo_parado',  'Aditivo aguardando o cliente há muitos dias',     false, array['dono'],   'orcamento')
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
  select 'medicao_parada', md.obra_id, md.id from md
   where (p_hoje - left(md.dados->>'analiseDesde', 10)::date) > md.dias
$$;
revoke all on function public.eventos_notificaveis(date) from public, anon, authenticated;

-- Resumo semanal da diretoria (segunda-feira): só contagens por obra, nunca valores
create or replace function public.resumo_semanal(p_agora timestamptz)
returns integer language plpgsql security definer set search_path = public as $$
declare hoje date := (p_agora at time zone 'America/Sao_Paulo')::date; u record; n int := 0; total int; txt text; nid bigint;
begin
  if extract(isodow from hoje) <> 1 then return 0; end if;
  select coalesce(count(*),0), string_agg(nome || ' (' || c || ')', '; ' order by c desc, nome)
    into total, txt
    from (select coalesce(o.dados->>'nome', e.obra_id) as nome, count(*) c
            from public.eventos_notificaveis(hoje) e left join public.obras o on o.id = e.obra_id group by 1) t;
  if total = 0 then return 0; end if;
  for u in select user_id from public.perfis where ativo and papel = 'dono'
           and coalesce((select np.resumo_diario from public.notificacao_preferencias np where np.user_id = perfis.user_id), true)
  loop
    insert into public.notificacoes(user_id, tipo, titulo, corpo, link, chave, criada_em)
    values (u.user_id, 'resumo_semanal', 'Resumo da semana: ' || total || ' pendências abertas', txt, '#/painel', 'semanal:' || hoje::text, p_agora)
    on conflict (user_id, chave) do nothing returning id into nid;
    if nid is not null then
      n := n + 1;
      insert into public.notificacao_entregas(notificacao_id, canal, enviar_apos) values (nid, 'email', p_agora);
    end if;
    nid := null;
  end loop;
  return n;
end $$;
revoke all on function public.resumo_semanal(timestamptz) from public, anon, authenticated;
-- Agendamento (no projeto real): select cron.schedule('notif-semanal', '0 10 * * 1', $$select public.resumo_semanal(now())$$);
