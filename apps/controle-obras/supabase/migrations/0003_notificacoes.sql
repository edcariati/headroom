-- 7A.1 — Motor de notificações (central no app, e-mail em fila, resumo diário).
-- Regras de "o que é um evento" vivem em eventos_notificaveis(); o app tem a versão espelho
-- (COBX.eventosNotificaveis) e tests/equivalencia.test.js exige resultados idênticos.
-- Rodar só no dev. O envio real de e-mail depende do provedor que o Edson escolher (Edge Function).

create table if not exists public.notificacao_regras (
  tipo text primary key,
  titulo text not null,
  critico boolean not null default false,
  ativo boolean not null default true,
  perfis_destino text[] not null,
  aba text not null default 'resumo'   -- aba da obra aberta pelo link
);

insert into public.notificacao_regras(tipo, titulo, critico, perfis_destino, aba) values
 ('oc_critica',     'Ocorrência crítica aberta',                    true,  array['dono','gestor'],       'ocorrencias'),
 ('oc_vencida',     'Apontamento vencido: cobrar o prestador',      false, array['gestor'],              'ocorrencias'),
 ('oc_escalada',    'Apontamento vencido há muitos dias: diretoria', true, array['dono'],                'ocorrencias'),
 ('conta_vencida',  'Conta a pagar vencida',                        false, array['dono','financeiro'],   'financeiro'),
 ('conta_a_vencer', 'Conta a pagar vence em até 3 dias',            false, array['dono','financeiro'],   'financeiro'),
 ('aporte_atrasado','Aporte do cliente atrasado',                   false, array['dono','financeiro'],   'financeiro'),
 ('medicao_parada', 'Medição em análise há muitos dias',            false, array['dono','financeiro'],   'medicao')
on conflict (tipo) do nothing;

create table if not exists public.notificacoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  obra_id text,
  registro_id text,
  titulo text not null,
  corpo text not null default '',
  link text not null default '',
  critico boolean not null default false,
  chave text not null,
  criada_em timestamptz not null default now(),
  lida_em timestamptz,
  unique (user_id, chave)
);
create index if not exists notificacoes_user_idx on public.notificacoes (user_id, criada_em desc);

create table if not exists public.notificacao_entregas (
  id bigint generated always as identity primary key,
  notificacao_id bigint not null references public.notificacoes(id) on delete cascade,
  canal text not null default 'email',
  estado text not null default 'pendente' check (estado in ('pendente','enviada','falhou','cancelada')),
  enviar_apos timestamptz not null default now(),
  tentativas int not null default 0,
  erro text,
  enviada_em timestamptz,
  unique (notificacao_id, canal)
);

create table if not exists public.notificacao_preferencias (
  user_id uuid primary key references auth.users(id) on delete cascade,
  canais text[] not null default array['app','email'],
  silencio_ini time not null default '20:00',
  silencio_fim time not null default '07:00',
  resumo_diario boolean not null default true
);

alter table public.notificacao_regras enable row level security;
alter table public.notificacoes enable row level security;
alter table public.notificacao_entregas enable row level security;
alter table public.notificacao_preferencias enable row level security;

create policy regras_dono on public.notificacao_regras for all using (public.papel_atual() = 'dono') with check (public.papel_atual() = 'dono');
create policy notif_sel on public.notificacoes for select using (user_id = auth.uid());
create policy notif_upd on public.notificacoes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- entregas: sem política = só o servidor (motor) acessa
create policy pref_own on public.notificacao_preferencias for all using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notificacoes, public.notificacao_entregas, public.notificacao_regras, public.notificacao_preferencias from anon, authenticated;
grant select on public.notificacoes to authenticated;
grant update (lida_em) on public.notificacoes to authenticated;     -- o usuário só marca como lida
grant select, insert, update on public.notificacao_preferencias to authenticated;
grant select, update on public.notificacao_regras to authenticated; -- RLS limita ao dono

-- Eventos: fonte única das regras no servidor. Recebe a DATA (testável em tempo simulado).
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
  select 'medicao_parada', md.obra_id, md.id from md
   where (p_hoje - left(md.dados->>'analiseDesde', 10)::date) > md.dias
$$;
revoke all on function public.eventos_notificaveis(date) from public, anon, authenticated;

-- Destinatários de um evento: papéis da regra, dentro da obra (dono vê todas)
create or replace function public.destinatarios(p_tipo text, p_obra text)
returns table(user_id uuid)
language sql stable security definer set search_path = public as $$
  select p.user_id from public.perfis p
  join public.notificacao_regras r on r.tipo = p_tipo and r.ativo and p.papel = any(r.perfis_destino)
  where p.ativo and (p.papel = 'dono' or exists (select 1 from public.obra_membros m where m.obra_id = p_obra and m.user_id = p.user_id))
$$;
revoke all on function public.destinatarios(text, text) from public, anon, authenticated;

-- Próximo horário permitido para e-mail (horário silencioso 20h–7h, fuso de São Paulo). Crítico não espera.
create or replace function public.proximo_envio(p_user uuid, p_critico boolean, p_agora timestamptz)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare pr record; local_ts timestamp := p_agora at time zone 'America/Sao_Paulo'; t time := local_ts::time;
        ini time := '20:00'; fim time := '07:00'; em_silencio boolean;
begin
  if p_critico then return p_agora; end if;
  select silencio_ini, silencio_fim into pr from public.notificacao_preferencias where user_id = p_user;
  if found then ini := pr.silencio_ini; fim := pr.silencio_fim; end if;
  em_silencio := case when ini > fim then (t >= ini or t < fim) else (t >= ini and t < fim) end;
  if not em_silencio then return p_agora; end if;
  -- próximo "fim do silêncio": hoje se ainda não chegou, senão amanhã
  return ((case when t < fim then local_ts::date else local_ts::date + 1 end + fim) at time zone 'America/Sao_Paulo');
end $$;
revoke all on function public.proximo_envio(uuid, boolean, timestamptz) from public, anon, authenticated;

-- Motor: cria notificações (idempotente) e entregas de e-mail. Sem valores em R$ no texto.
create or replace function public.gerar_notificacoes(p_agora timestamptz)
returns integer language plpgsql security definer set search_path = public as $$
declare hoje date := (p_agora at time zone 'America/Sao_Paulo')::date; ev record; d record; n int := 0; nid bigint;
        r public.notificacao_regras; link text; corpo text; canais text[];
begin
  for ev in select * from public.eventos_notificaveis(hoje) loop
    select * into r from public.notificacao_regras where tipo = ev.tipo and ativo;
    if not found then continue; end if;
    link := '#/obra/' || ev.obra_id || '/' || r.aba;
    corpo := (select coalesce(dados->>'nome', ev.obra_id) from public.obras where id = ev.obra_id);
    for d in select * from public.destinatarios(ev.tipo, ev.obra_id) loop
      insert into public.notificacoes(user_id, tipo, obra_id, registro_id, titulo, corpo, link, critico, chave, criada_em)
      values (d.user_id, ev.tipo, ev.obra_id, ev.registro_id, r.titulo, 'Obra: ' || corpo, link, r.critico, ev.tipo || ':' || ev.registro_id, p_agora)
      on conflict (user_id, chave) do nothing
      returning id into nid;
      if nid is not null then
        n := n + 1;
        select coalesce((select np.canais from public.notificacao_preferencias np where np.user_id = d.user_id), array['app','email']) into canais;
        if 'email' = any(canais) or r.critico then
          insert into public.notificacao_entregas(notificacao_id, canal, enviar_apos)
          values (nid, 'email', public.proximo_envio(d.user_id, r.critico, p_agora));
        end if;
      end if;
      nid := null;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.gerar_notificacoes(timestamptz) from public, anon, authenticated;

-- Resumo diário (dias úteis): só contagens, nunca valores; não envia se não há nada
create or replace function public.resumo_diario(p_agora timestamptz)
returns integer language plpgsql security definer set search_path = public as $$
declare hoje date := (p_agora at time zone 'America/Sao_Paulo')::date; u record; n int := 0; total int; txt text; nid bigint;
begin
  if extract(isodow from hoje) > 5 then return 0; end if;
  for u in select p.user_id from public.perfis p
           where p.ativo and coalesce((select np.resumo_diario from public.notificacao_preferencias np where np.user_id = p.user_id), true)
  loop
    with ev as (select * from public.eventos_notificaveis(hoje)),
    meus as (select ev.tipo, count(*) c from ev where exists (select 1 from public.destinatarios(ev.tipo, ev.obra_id) d where d.user_id = u.user_id) group by ev.tipo)
    select coalesce(sum(c),0), string_agg(c || ' ' || lower(r.titulo), '; ' order by r.tipo)
      into total, txt from meus join public.notificacao_regras r on r.tipo = meus.tipo;
    if total > 0 then
      insert into public.notificacoes(user_id, tipo, titulo, corpo, link, chave, criada_em)
      values (u.user_id, 'resumo_diario', 'Resumo do dia: ' || total || case when total = 1 then ' pendência' else ' pendências' end, txt, '#/agenda', 'resumo:' || hoje::text, p_agora)
      on conflict (user_id, chave) do nothing returning id into nid;
      if nid is not null then
        n := n + 1;
        if 'email' = any(coalesce((select np.canais from public.notificacao_preferencias np where np.user_id = u.user_id), array['app','email'])) then
          insert into public.notificacao_entregas(notificacao_id, canal, enviar_apos) values (nid, 'email', p_agora);
        end if;
      end if;
      nid := null;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.resumo_diario(timestamptz) from public, anon, authenticated;

-- Agendamento (Supabase): habilitar a extensão pg_cron no projeto e rodar UMA vez:
--   select cron.schedule('notif-15min', '*/15 * * * *', $$select public.gerar_notificacoes(now())$$);
--   select cron.schedule('notif-resumo', '0 10 * * 1-5', $$select public.resumo_diario(now())$$);  -- 7h de Brasília = 10h UTC
-- (não executado aqui: pg_cron só existe no projeto real.)
