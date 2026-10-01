-- Auditoria (fase 9): permissões de tabela e função, testadas como o atacante testaria.
reset role; select tt.como(1);

-- catálogo: nenhuma tabela sem RLS; sem política só as de uso interno; funções sensíveis com search_path fixo; sem using(true)
select tt.exige((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity)=0, 'A: toda tabela tem RLS');
select tt.exige((select array_agg(c.relname::text order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and not exists (select 1 from pg_policy p where p.polrelid=c.oid))=array['notificacao_entregas','ops_aplicadas'], 'A: RLS sem política só em notificacao_entregas e ops_aplicadas (uso interno do servidor)');
select tt.exige((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) x where x like 'search_path=%'))=0, 'A: toda função security definer fixa o search_path');
select tt.exige((select count(*) from pg_policy where pg_get_expr(polqual,polrelid)='true' or pg_get_expr(polwithcheck,polrelid)='true')=0, 'A: nenhuma política liberada para todos (using true)');
select tt.exige((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relforcerowsecurity and c.relname in (select nome from public.colecoes))=0, 'A: tabelas de dados com RLS forçada');

-- anon (visitante sem login): nada de tabela, nada de função
select tt.exige((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind = 'r' and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger') or has_any_column_privilege('anon', c.oid, 'select,insert,update,references')))=0, 'anon: nenhum privilégio em nenhuma tabela');
select tt.exige((select count(*) from pg_sequences q where q.schemaname='public' and has_sequence_privilege('anon', (quote_ident(q.schemaname)||'.'||quote_ident(q.sequencename))::regclass, 'usage,update'))=0, 'anon: nenhuma sequência');
select tt.exige((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute'))=0, 'anon: nenhuma função executável');

-- authenticated: sem TRUNCATE, DELETE, REFERENCES, TRIGGER em tabela nenhuma (RLS não protege TRUNCATE)
select tt.exige((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and (has_table_privilege('authenticated', c.oid, 'truncate') or has_table_privilege('authenticated', c.oid, 'delete') or has_table_privilege('authenticated', c.oid, 'references') or has_table_privilege('authenticated', c.oid, 'trigger')))=0, 'authenticated: sem TRUNCATE, DELETE, REFERENCES nem TRIGGER em nenhuma tabela');
select tt.exige((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('ops_aplicadas','notificacao_entregas') and (has_table_privilege('authenticated', c.oid, 'select,insert,update')))=0, 'authenticated: tabelas internas fechadas');
select tt.exige((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('authenticated', p.oid, 'execute') and p.proname not in ('papel_atual','nivel_em','na_obra','excluir_registro','validar_relatorio','aceitar_chamado','campo_ler','campo_patch','anexar_item'))=0, 'authenticated: só executa as funções previstas (lista fechada)');
select tt.exige((select count(*) from pg_sequences q where q.schemaname='public' and has_sequence_privilege('authenticated', (quote_ident(q.schemaname)||'.'||quote_ident(q.sequencename))::regclass, 'usage,update'))=0, 'authenticated: sem acesso a sequências');

-- tentativas reais como usuário logado de cada perfil
set role authenticated;
do $$
declare t text; ok boolean; n int := 0;
begin
  perform set_config('request.uid', '00000000-0000-0000-0000-000000000001', false);   -- até a diretoria
  for t in select nome from public.colecoes loop
    begin execute format('truncate public.%I', t); ok := true; exception when others then ok := false; end;
    if ok then raise exception 'FALHOU: a diretoria conseguiu TRUNCATE em %', t; end if;
    begin execute format('delete from public.%I', t); ok := true; exception when others then ok := false; end;
    if ok then raise exception 'FALHOU: a diretoria conseguiu DELETE direto em %', t; end if;
    n := n + 1;
  end loop;
  foreach t in array array['perfis','obra_membros','auditoria','notificacoes','permissoes','colecoes','notificacao_preferencias','notificacao_regras'] loop
    begin execute format('truncate public.%I', t); ok := true; exception when others then ok := false; end;
    if ok then raise exception 'FALHOU: TRUNCATE em %', t; end if;
  end loop;
  begin perform public.criar_tabela_colecao('lixo'); ok := true; exception when others then ok := false; end;
  if ok then raise exception 'FALHOU: criar_tabela_colecao executável por usuário logado'; end if;
  begin perform public.gerar_notificacoes(now()); ok := true; exception when others then ok := false; end;
  if ok then raise exception 'FALHOU: motor de notificações executável por usuário logado'; end if;
  begin perform public.eventos_notificaveis(current_date); ok := true; exception when others then ok := false; end;
  if ok then raise exception 'FALHOU: eventos_notificaveis executável por usuário logado'; end if;
  begin execute 'create table public.lixo(id int)'; ok := true; exception when others then ok := false; end;
  if ok then raise exception 'FALHOU: usuário logado criou tabela no schema public'; end if;
end $$;
select tt.exige(tt.tenta($$select count(*) from public.obras$$), 'sanidade: a diretoria ainda lê normalmente');

-- anon na prática
reset role; set role anon;
select tt.exige(not tt.tenta($$select count(*) from public.obras$$), 'anon não lê obras');
select tt.exige(not tt.tenta($$select count(*) from public.perfis$$), 'anon não lê perfis');
select tt.exige(not tt.tenta($$insert into public.obras(id,dados) values ('x','{}')$$), 'anon não grava');
select tt.exige(not tt.tenta($$select public.papel_atual()$$), 'anon não executa funções de apoio');
select tt.exige(not tt.tenta($$select public.excluir_registro('obras','o1')$$), 'anon não exclui');
reset role;
