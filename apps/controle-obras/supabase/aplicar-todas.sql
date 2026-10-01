-- Controle de Obras Cariati — TODAS as migrações em ordem (gerado por supabase/gerar-aplicar-todas.sh).
-- Cole no Editor SQL do projeto cariati-obras-dev e execute UMA vez. Em projeto novo e vazio.
-- Não contém segredos. Depois, rode supabase/primeiro-dono.sql trocando o e-mail.

-- ===== 0001_base.sql =====
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

-- ===== 0002_regras.sql =====
-- Regras críticas no servidor (o navegador continua validando, mas o servidor decide).
-- Rodar só no dev até o Edson liberar a produção.

create or replace function public.trg_regras() returns trigger
language plpgsql security definer set search_path = public as $$
declare papel text := public.papel_atual(); ant jsonb := coalesce(old.dados,'{}'::jsonb); nov jsonb := new.dados;
begin
  if tg_op <> 'UPDATE' then
    -- criação: medição e aditivo não nascem aprovados/assinados; relatório não nasce emitido; obra não nasce encerrada
    if tg_table_name = 'medicoes' and nov->>'status' = 'aprovada' then raise exception 'Medição não pode ser criada já aprovada'; end if;
    if tg_table_name = 'aditivos' and nov->>'status' = 'assinado' then raise exception 'Aditivo não pode ser criado já assinado'; end if;
    return new;
  end if;

  if tg_table_name = 'relatorios' and ant->>'status' = 'emitido' then
    if nov->>'status' is distinct from 'emitido' or nov->'snapshot' is distinct from ant->'snapshot'
       or nov->>'mes' is distinct from ant->>'mes' or nov->>'emitidoEm' is distinct from ant->>'emitidoEm' then
      raise exception 'Relatório emitido é congelado: para corrigir, crie uma retificação';
    end if;
  end if;

  if tg_table_name = 'orcamentos' and nov is distinct from ant then
    raise exception 'Versão de orçamento é imutável: crie uma nova versão';
  end if;
  if tg_table_name = 'orcItens' and old.id not like 'ref\_%' and nov is distinct from ant then
    raise exception 'Itens de uma versão de orçamento são imutáveis';
  end if;

  if tg_table_name = 'contasPagar' and ant->>'status' = 'paga' and nov->>'status' is distinct from 'paga' and papel <> 'dono' then
    raise exception 'Conta paga só volta pelo dono';
  end if;

  if tg_table_name = 'medicoes' then
    if nov->>'status' = 'aprovada' and ant->>'status' is distinct from 'aprovada' and papel not in ('dono','financeiro') then
      raise exception 'Só dono ou financeiro aprovam medição';
    end if;
    if ant->>'status' = 'aprovada' and nov->>'status' is distinct from 'aprovada' and papel <> 'dono' then
      raise exception 'Medição aprovada só volta pelo dono';
    end if;
    if ant->>'status' = 'aprovada' and nov->'itens' is distinct from ant->'itens' then
      raise exception 'Medição aprovada não pode ter os itens alterados';
    end if;
  end if;

  if tg_table_name = 'aditivos' then
    if nov->>'status' = 'assinado' and ant->>'status' is distinct from 'assinado' and papel not in ('dono','gestor','financeiro') then
      raise exception 'Sem permissão para assinar aditivo';
    end if;
    if ant->>'status' = 'assinado' and (nov->'valor' is distinct from ant->'valor' or nov->'assinatura' is distinct from ant->'assinatura' or nov->>'status' is distinct from 'assinado') then
      raise exception 'Aditivo assinado é imutável';
    end if;
  end if;

  if tg_table_name = 'obras' and (nov->>'situacao' is distinct from ant->>'situacao') and papel <> 'dono' then
    raise exception 'Só o dono encerra ou reabre uma obra';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['relatorios','orcamentos','orcItens','contasPagar','medicoes','aditivos','obras'] loop
    execute format('drop trigger if exists trg_regras on public.%I', t);
    execute format('create trigger trg_regras before insert or update on public.%I for each row execute function public.trg_regras()', t);
  end loop;
end $$;

-- Cliente: lê somente relatórios EMITIDOS da própria obra
create policy relatorios_cliente on public.relatorios for select using (
  public.papel_atual() = 'cliente' and excluido_em is null
  and dados->>'status' = 'emitido' and public.na_obra(obra_id));

-- Cliente: valida ou objeta (muda só validacaoCliente)
create or replace function public.validar_relatorio(rid text, situacao text, texto text default '') returns void
language plpgsql security definer set search_path = public as $$
declare oid text;
begin
  if public.papel_atual() is distinct from 'cliente' then raise exception 'Somente o cliente valida o relatório'; end if;
  if situacao not in ('validado','objecao') then raise exception 'Situação inválida'; end if;
  if situacao = 'objecao' and coalesce(btrim(texto),'') = '' then raise exception 'Objeção exige o motivo'; end if;
  select obra_id into oid from public.relatorios where id = rid and excluido_em is null and dados->>'status' = 'emitido';
  if oid is null or not public.na_obra(oid) then raise exception 'Relatório não encontrado'; end if;
  update public.relatorios set dados = jsonb_set(dados, '{validacaoCliente}',
    jsonb_build_object('status', situacao, 'texto', texto, 'data', current_date, 'por', auth.uid())) where id = rid;
end $$;
revoke all on function public.validar_relatorio(text,text,text) from public, anon;
grant execute on function public.validar_relatorio(text,text,text) to authenticated;

-- ===== 0003_notificacoes.sql =====
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

-- ===== 0004_eventos_extras.sql =====
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

-- ===== 0005_pos_obra.sql =====
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

-- ===== 0006_campo_sem_valores.sql =====
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

-- ===== 0007_endurecer_permissoes.sql =====
-- 0007 — Endurecimento de permissões (auditoria, fase 9). Independe dos privilégios padrão do Supabase.
-- Achados que esta migração fecha:
--  A-01  Tabelas ficavam com os privilégios padrão do Supabase (que podem incluir TRUNCATE, DELETE e REFERENCES
--        para anon/authenticated). RLS NÃO protege TRUNCATE. Agora: revoga tudo e concede só o mínimo.
--  A-02  Funções de uso interno (criar_tabela_colecao, gatilhos) eram executáveis por anon/authenticated.
--  A-03  Funções novas herdariam EXECUTE para PUBLIC. Agora o padrão é negar.

-- 1) Padrão para objetos futuros: nada para anon/authenticated/PUBLIC
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- 2) Tabelas: zera e concede o mínimo
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

do $$
declare c record;
begin
  for c in select nome from public.colecoes loop            -- dados: ler, criar e alterar (excluir só pela função)
    execute format('grant select, insert, update on public.%I to authenticated', c.nome);
  end loop;
end $$;
grant select, insert, update on public.perfis, public.obra_membros to authenticated;           -- RLS: só o dono escreve
grant select on public.permissoes, public.colecoes, public.auditoria to authenticated;           -- RLS: auditoria só o dono
grant select on public.notificacoes to authenticated;
grant update (lida_em) on public.notificacoes to authenticated;
grant select, insert, update on public.notificacao_preferencias to authenticated;
grant select, update on public.notificacao_regras to authenticated;                              -- RLS: só o dono
-- ops_aplicadas e notificacao_entregas: nenhum acesso de cliente (só funções do servidor)

-- 3) Funções: zera e concede só o necessário
revoke execute on all functions in schema public from public, anon, authenticated;
-- usadas pelas políticas de RLS (avaliadas com o papel do usuário logado)
grant execute on function public.papel_atual(), public.nivel_em(text), public.na_obra(text) to authenticated;
-- chamadas pelo aplicativo (cada uma valida o chamador por dentro)
grant execute on function
  public.excluir_registro(text, text), public.validar_relatorio(text, text, text), public.aceitar_chamado(text, boolean, text),
  public.campo_ler(text, text), public.campo_patch(text, text, jsonb, text), public.anexar_item(text, text, text, jsonb, text)
  to authenticated;
-- funções internas e do motor de notificações: nenhum papel de cliente (rodam como dono, pelo agendador)

-- ===== 0008_storage.sql =====
-- 0008 — Storage privado por obra e por zona de sensibilidade (auditoria, achado A-04 / lacuna L-1).
-- Caminho: <obra_id>/<zona>/<ano-mes>/<arquivo>, com zona = 'campo' | 'restrito'.
--   campo    fotos de obra, diário, ocorrências, chamados: membros da obra (incl. cliente da obra).
--   restrito contratos, notas, medições e outros documentos que podem ter valores em R$:
--            leitura dono, gestor, financeiro, leitura; envio dono, gestor, financeiro. Campo e cliente NÃO.
-- Sem política de UPDATE nem DELETE: ninguém substitui nem apaga arquivo pelo aplicativo (retenção de 5 anos).
-- Bucket privado, 10 MB por arquivo, só JPEG, PNG, WebP e PDF (nada de HTML, SVG ou executável).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('obras-arquivos', 'obras-arquivos', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists arquivos_ler on storage.objects;
drop policy if exists arquivos_enviar on storage.objects;

create policy arquivos_ler on storage.objects for select to authenticated using (
  bucket_id = 'obras-arquivos'
  and public.na_obra((storage.foldername(name))[1])
  and (
    (storage.foldername(name))[2] = 'campo'
    or ((storage.foldername(name))[2] = 'restrito' and public.papel_atual() in ('dono','gestor','financeiro','leitura'))
  ));

create policy arquivos_enviar on storage.objects for insert to authenticated with check (
  bucket_id = 'obras-arquivos'
  and name !~ '(^|/)\.\.(/|$)'
  and public.na_obra((storage.foldername(name))[1])
  and (
    ((storage.foldername(name))[2] = 'campo' and public.papel_atual() in ('dono','gestor','financeiro','campo','cliente'))
    or ((storage.foldername(name))[2] = 'restrito' and public.papel_atual() in ('dono','gestor','financeiro'))
  ));
