-- 0009: pedidos de pagamento (grupo financeiro) e relatório quinzenal (tabela relatorios)
reset role; select tt.como(1);
insert into public."pedidosPag"(id,obra_id,dados) values ('pp1','o1','{"obraId":"o1","numero":1,"descricao":"Serviço extra","status":"aprovacao","orcamentos":[{"id":"a","favorecido":"X","valor":1000}]}');
insert into public.relatorios(id,obra_id,dados) values ('rq1','o1','{"obraId":"o1","tipo":"quinzenal","mes":"2026-10-Q1","status":"emitido","textoEngenharia":"ok"}');
insert into public.relatorios(id,obra_id,dados) values ('rq2','o1','{"obraId":"o1","tipo":"quinzenal","mes":"2026-10-Q2","status":"rascunho"}');
set role authenticated;
select tt.como(1); select tt.exige(tt.conta('pedidosPag')>=1, 'dono lê pedidos de pagamento');
select tt.como(2); select tt.exige(tt.conta('pedidosPag')>=1, 'gestor lê pedidos de pagamento');
select tt.como(4); select tt.exige(tt.tenta($$update public."pedidosPag" set dados = dados || '{"obs":"fin"}' where id='pp1'$$), 'financeiro grava pedido de pagamento');
select tt.como(3); select tt.exige(tt.conta('pedidosPag')=0, 'campo não lê pedidos de pagamento');
select tt.exige(not tt.tenta($$insert into public."pedidosPag"(id,obra_id,dados) values ('ppX','o1','{}')$$), 'campo não grava pedido de pagamento');
select tt.como(5); select tt.exige(tt.conta('pedidosPag')=0, 'cliente não lê pedidos de pagamento');
select tt.exige(not tt.tenta($$insert into public."pedidosPag"(id,obra_id,dados) values ('ppY','o1','{}')$$), 'cliente não grava pedido de pagamento');
select tt.exige((select count(*) from public.relatorios where id in ('rq1','rq2'))=1, 'cliente vê só o relatório quinzenal emitido');
select tt.como(6); select tt.exige(tt.conta('pedidosPag')=0, 'gestor de fora (sem a obra) não lê pedidos');
