set role authenticated;
-- relatório emitido: congelado; retificação é novo registro
select tt.como(1);
reset role; insert into public.relatorios(id,obra_id,dados) values ('r1','o1','{"status":"emitido","mes":"2026-09","snapshot":{"a":1},"emitidoEm":"x"}'); set role authenticated;
select tt.exige(not tt.tenta($$update public.relatorios set dados=jsonb_set(dados,'{snapshot}','{"a":2}') where id='r1'$$), 'emitido não muda snapshot');
select tt.exige(not tt.tenta($$update public.relatorios set dados=jsonb_set(dados,'{status}','"rascunho"') where id='r1'$$), 'emitido não volta a rascunho');
select tt.exige(tt.tenta($$update public.relatorios set dados=jsonb_set(dados,'{prazoObjecao}','"2026-10-10"') where id='r1'$$), 'emitido aceita prazo de objeção');
-- cliente vê só emitido da própria obra e valida
reset role; insert into public.relatorios(id,obra_id,dados) values ('r2','o1','{"status":"rascunho"}'),('r3','o2','{"status":"emitido"}'); set role authenticated;
select tt.como(5);
select tt.exige(tt.conta('relatorios')=1, 'cliente vê apenas 1 relatório emitido da obra dele');
select tt.exige(not tt.tenta($$select public.validar_relatorio('r1','objecao','')$$), 'objeção exige motivo');
select tt.exige(tt.tenta($$select public.validar_relatorio('r1','validado','ok')$$), 'cliente valida');
select tt.exige(not tt.tenta($$select public.validar_relatorio('r3','validado','ok')$$), 'cliente não valida relatório de outra obra');
update public.relatorios set dados='{}' where id='r1';
select tt.exige((select dados->>'status' from public.relatorios where id='r1')='emitido', 'cliente não edita relatório direto');
select tt.como(2);
select tt.exige(not tt.tenta($$select public.validar_relatorio('r1','validado','ok')$$), 'gestor não valida pelo cliente');
-- orçamento imutável
select tt.como(1);
reset role; insert into public.orcamentos(id,obra_id,dados) values ('b1','o1','{"versao":1,"total":100}'); set role authenticated;
select tt.exige(not tt.tenta($$update public.orcamentos set dados='{"versao":1,"total":1}' where id='b1'$$), 'orçamento v1 imutável');
-- medição: aprovação só dono/financeiro; aprovada congela itens
select tt.como(2);
select tt.exige(not tt.tenta($$update public.medicoes set dados='{"status":"aprovada"}' where id='m1'$$), 'gestor não aprova medição');
select tt.como(4);
select tt.exige(tt.tenta($$update public.medicoes set dados='{"status":"aprovada","itens":[1]}' where id='m1'$$), 'financeiro aprova medição');
select tt.exige(not tt.tenta($$update public.medicoes set dados='{"status":"aprovada","itens":[2]}' where id='m1'$$), 'itens aprovados não mudam');
select tt.exige(not tt.tenta($$insert into public.medicoes(id,obra_id,dados) values ('m9','o1','{"status":"aprovada"}')$$), 'medição não nasce aprovada');
-- conta paga não volta
select tt.como(1);
reset role; insert into public.obra_membros values ('o1','00000000-0000-0000-0000-000000000001') on conflict do nothing; insert into public."contasPagar"(id,obra_id,dados) values ('c1','o1','{"status":"paga"}'); set role authenticated;
select tt.como(4);
select tt.exige(not tt.tenta($$update public."contasPagar" set dados='{"status":"aberta"}' where id='c1'$$), 'financeiro não reabre conta paga');
select tt.como(1);
select tt.exige(tt.tenta($$update public."contasPagar" set dados='{"status":"aberta"}' where id='c1'$$), 'dono reabre conta paga (auditado)');
-- encerrar obra: só dono
select tt.como(2);
select tt.exige(not tt.tenta($$update public.obras set dados='{"situacao":"encerrada"}' where id='o1'$$), 'gestor não encerra obra');
select tt.como(1);
select tt.exige(tt.tenta($$update public.obras set dados='{"situacao":"encerrada"}' where id='o1'$$), 'dono encerra obra');
-- aditivo assinado imutável
reset role; insert into public.aditivos(id,obra_id,dados) values ('a1','o1','{"status":"enviado","valor":10}'); set role authenticated;
select tt.como(3);
update public.aditivos set dados='{"status":"assinado","valor":10}' where id='a1';
select tt.como(2); select tt.exige((select dados->>'status' from public.aditivos where id='a1')='enviado', 'campo não assina aditivo');
select tt.como(2);
select tt.exige(tt.tenta($$update public.aditivos set dados='{"status":"assinado","valor":10,"assinatura":{"ref":"x"}}' where id='a1'$$), 'gestor assina aditivo');
select tt.exige(not tt.tenta($$update public.aditivos set dados='{"status":"assinado","valor":99,"assinatura":{"ref":"x"}}' where id='a1'$$), 'assinado imutável');
reset role;
