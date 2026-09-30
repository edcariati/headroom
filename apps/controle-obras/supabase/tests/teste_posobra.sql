-- 7B: pós-obra e acesso do cliente
reset role; select tt.como(1);
insert into public.obras(id,obra_id,dados) values ('p1','p1','{"nome":"Pós N","situacao":"encerrada","entregueEm":"2026-03-01"}'),('p2','p2','{"nome":"Outra"}');
insert into public.obra_membros values ('p1','00000000-0000-0000-0000-000000000005'),('p1','00000000-0000-0000-0000-000000000002');
insert into public.garantias(id,obra_id,dados) values
 ('g1','p1','{"sistema":"Hidráulica","fim":"2026-10-20"}'),   -- 20 dias de 2026-09-30
 ('g2','p1','{"sistema":"Elétrica","fim":"2026-11-15"}'),     -- 46 dias
 ('g3','p1','{"sistema":"Pintura","fim":"2027-09-01"}'),
 ('g4','p2','{"sistema":"X","fim":"2026-10-05"}');
insert into public."chamadosGarantia"(id,obra_id,dados) values
 ('h1','p1','{"status":"aberto","criadoEm":"2026-09-20T10:00:00Z","slaRespDias":3,"slaResDias":30,"abertoPor":"equipe"}'),
 ('h2','p1','{"status":"em_atendimento","criadoEm":"2026-09-10T10:00:00Z","slaRespDias":3,"slaResDias":15}'),
 ('h3','p1','{"status":"resolvido","criadoEm":"2026-01-01T10:00:00Z","slaResDias":3}');
insert into public."visitasPosObra"(id,obra_id,dados) values
 ('v1','p1','{"marco":30,"status":"pendente","dataPrevista":"2026-10-03"}'),
 ('v2','p1','{"marco":90,"status":"realizada","dataPrevista":"2026-06-01"}'),
 ('v3','p1','{"marco":180,"status":"pendente","dataPrevista":"2026-12-01"}');
insert into public."pesquisasSatisfacao"(id,obra_id,dados) values ('p1_30','p1','{"marco":30,"notas":{"recomendacao":6}}'),('p1_90','p1','{"marco":90,"notas":{"recomendacao":9}}');

-- eventos (obra encerrada ainda recebe eventos de pós-obra)
select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30') where obra_id='p1' and tipo='chamado_novo')=1, 'chamado aberto gera aviso novo');
select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30') where tipo='chamado_fora_sla' and registro_id in ('h1','h2'))=2, 'h1 sem resposta há 10 dias e h2 passou de 15: fora do SLA');
select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30') where tipo='chamado_fora_sla' and registro_id='h3')=0, 'chamado resolvido não gera SLA');
select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30') where tipo='garantia_30')=2, 'garantias vencendo em 30 dias (g1 e g4)');
select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30') where tipo='garantia_60' and registro_id='g2')=1, 'g2 cai na janela de 60 dias');
select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30') where registro_id='g3')=0, 'garantia longe não avisa');
select tt.exige((select array_agg(registro_id order by registro_id) from public.eventos_notificaveis('2026-09-30') where tipo='visita_proxima')=array['v1'], 'só a visita pendente dentro de 7 dias');
select tt.exige((select array_agg(registro_id) from public.eventos_notificaveis('2026-09-30') where tipo='satisfacao_baixa')=array['p1_30'], 'nota 6 é baixa, 9 não');

-- cliente
set role authenticated;
select tt.como(5);
select tt.exige(tt.conta('obras')=2, 'cliente vê só as obras dele (o1 e p1; não p2)');
select tt.exige(tt.conta('garantias')=3, 'cliente vê as garantias da obra dele (3)');
select tt.exige(tt.conta('chamadosGarantia')=3, 'cliente vê os chamados da obra dele');
select tt.exige((select count(*) from public."visitasPosObra")=1, 'cliente vê só visita realizada');
select tt.exige(tt.tenta($$insert into public."chamadosGarantia"(id,obra_id,dados) values ('h9','p1','{"status":"aberto","abertoPor":"cliente","descricao":"Infiltração"}')$$), 'cliente abre chamado');
select tt.exige(not tt.tenta($$insert into public."chamadosGarantia"(id,obra_id,dados) values ('h8','p2','{"status":"aberto","abertoPor":"cliente"}')$$), 'cliente não abre chamado em obra alheia');
select tt.exige(not tt.tenta($$insert into public."chamadosGarantia"(id,obra_id,dados) values ('h7','p1','{"status":"resolvido","abertoPor":"cliente"}')$$), 'cliente não abre chamado já resolvido');
select tt.exige(not tt.tenta($$insert into public."chamadosGarantia"(id,obra_id,dados) values ('h6','p1','{"status":"aberto","abertoPor":"cliente","parecer":"coberto"}')$$), 'cliente não dá o parecer');
update public."chamadosGarantia" set dados = dados || '{"status":"negado"}' where id='h9';
select tt.exige((select dados->>'status' from public."chamadosGarantia" where id='h9')='aberto', 'cliente não edita chamado');
select tt.exige(tt.conta('chamadosCustos')=0 and tt.conta('config')=0 and tt.conta('lancamentos')=0, 'cliente não vê custo de reparo nem financeiro');
select tt.exige(tt.tenta($$insert into public."pesquisasSatisfacao"(id,obra_id,dados) values ('p1_180','p1','{"marco":180,"notas":{"recomendacao":10}}')$$), 'cliente responde a pesquisa');
select tt.exige(not tt.tenta($$insert into public."pesquisasSatisfacao"(id,obra_id,dados) values ('p1_180','p1','{"marco":180,"notas":{"recomendacao":1}}')$$), 'segunda resposta do mesmo marco é negada');
select tt.exige(not tt.tenta($$insert into public."pesquisasSatisfacao"(id,obra_id,dados) values ('p2_30','p2','{"marco":30}')$$), 'cliente não responde por obra alheia');
-- aceite do cliente
select tt.exige(not tt.tenta($$select public.aceitar_chamado('h1', true, '')$$), 'só aceita chamado já resolvido');
select tt.exige(not tt.tenta($$select public.aceitar_chamado('h3', false, '')$$), 'contestar exige motivo');
select tt.exige(tt.tenta($$select public.aceitar_chamado('h3', true, 'Ficou bom')$$), 'cliente aceita a resolução');
select tt.exige((select dados->'aceiteCliente'->>'aceito' from public."chamadosGarantia" where id='h3')='true', 'aceite gravado');
-- equipe
select tt.como(2);
select tt.exige(not tt.tenta($$select public.aceitar_chamado('h3', true, 'x')$$), 'engenharia não aceita pelo cliente');
select tt.exige(not tt.tenta($$update public."chamadosGarantia" set dados = dados || '{"status":"negado"}' where id='h1'$$), 'negar exige justificativa');
select tt.exige(tt.tenta($$update public."chamadosGarantia" set dados = dados || '{"status":"negado","parecer":"nao_coberto","justificativa":"Mau uso"}' where id='h1'$$), 'negar com justificativa');
select tt.exige(not tt.tenta($$update public."chamadosGarantia" set dados = jsonb_set(dados,'{aceiteCliente}','{"aceito":true}') where id='h2'$$), 'equipe não forja aceite');
select tt.exige(tt.tenta($$insert into public."chamadosCustos"(id,obra_id,dados) values ('cc1','p1','{"valor":300}')$$), 'engenharia lança custo do reparo');
-- campo não vê pesquisas nem custo
select tt.como(3);
select tt.exige(tt.conta('pesquisasSatisfacao')=0 and tt.conta('chamadosCustos')=0, 'encarregado não vê pesquisa nem custo');
reset role;
