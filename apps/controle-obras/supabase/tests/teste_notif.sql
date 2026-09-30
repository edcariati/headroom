reset role;
select tt.como(1);
-- cenário: obra administrada n1 com engenharia (u2), financeiro (u4); u6 é gestor de outra obra
insert into public.obras(id,obra_id,dados) values ('n1','n1','{"nome":"Casa N1","modalidade":"Administração de Obra","diasEscalar":7}');
insert into public.obra_membros values ('n1','00000000-0000-0000-0000-000000000002'),('n1','00000000-0000-0000-0000-000000000004'),('n1','00000000-0000-0000-0000-000000000003');
insert into public.ocorrencias(id,obra_id,dados) values
 ('c1','n1','{"gravidade":"critica","status":"aberta"}'),
 ('v1','n1','{"gravidade":"media","status":"aberta","prazo":"2026-09-28"}'),
 ('e1','n1','{"gravidade":"media","status":"aberta","prazo":"2026-09-20"}'),
 ('f1','n1','{"gravidade":"critica","status":"fechada","prazo":"2026-09-01"}');
insert into public."contasPagar"(id,obra_id,dados) values
 ('a1','n1','{"status":"aberta","vencimento":"2026-09-29","valor":12345.67}'),
 ('a2','n1','{"status":"aberta","vencimento":"2026-10-02","valor":500}'),
 ('a3','n1','{"status":"paga","vencimento":"2026-09-01"}'),
 ('a4','n1','{"status":"aberta","vencimento":"2026-10-20"}');
insert into public.aportes(id,obra_id,dados) values ('p1','n1','{"dataPrevista":"2026-09-27"}'),('p2','n1','{"dataPrevista":"2026-09-27","dataRecebida":"2026-09-28"}');
insert into public.medicoes(id,obra_id,dados) values ('md1','n1','{"status":"em_analise","analiseDesde":"2026-09-21T10:00:00Z"}'),('md2','n1','{"status":"em_analise","analiseDesde":"2026-09-29"}');

select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30')
  where obra_id='n1')=8, '8 eventos esperados: crit, 2 vencidas, 1 escalada, conta vencida, a vencer, aporte, medição');
select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30') where tipo='oc_escalada' and registro_id='e1')=1, 'escalada só a de 10 dias');
select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30') where registro_id in ('f1','a3','p2','md2','a4'))=0, 'fechada, paga, recebida, recente e distante não geram evento');
-- obra encerrada não gera
update public.obras set dados = dados || '{"situacao":"encerrada"}' where id='n1';
select tt.exige((select count(*) from public.eventos_notificaveis('2026-09-30') where obra_id='n1')=0, 'obra encerrada não notifica');
update public.obras set dados = dados - 'situacao' where id='n1';

-- motor
select tt.exige(public.gerar_notificacoes('2026-09-30 15:00:00-03')>0, 'motor cria notificações');
select tt.exige(public.gerar_notificacoes('2026-09-30 15:05:00-03')=0, 'idempotência: rodar de novo não duplica');
select tt.exige((select count(*) from public.notificacoes where user_id='00000000-0000-0000-0000-000000000002')=3, 'engenharia: crítica + 2 vencidas (e1 e v1) = 3');
select tt.exige((select count(*) from public.notificacoes where user_id='00000000-0000-0000-0000-000000000002' and tipo in ('conta_vencida','aporte_atrasado','oc_escalada'))=0, 'engenharia não recebe financeiro nem escalada');
select tt.exige((select count(*) from public.notificacoes where user_id='00000000-0000-0000-0000-000000000004' and tipo in ('conta_vencida','conta_a_vencer','aporte_atrasado','medicao_parada'))=4, 'financeiro recebe os 4 do financeiro');
select tt.exige((select count(*) from public.notificacoes where user_id='00000000-0000-0000-0000-000000000004' and tipo like 'oc_%')=0, 'financeiro não recebe ocorrências');
select tt.exige((select count(*) from public.notificacoes where user_id in ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006'))=0, 'campo, cliente e gestor de outra obra não recebem nada');
select tt.exige((select count(*) from public.notificacoes where user_id='00000000-0000-0000-0000-000000000001' and tipo='oc_escalada')=1, 'diretoria recebe a escalada');
-- nenhum valor em R$ nas mensagens
select tt.exige((select count(*) from public.notificacoes where titulo ~ 'R\$|[0-9]{3,}' or corpo ~ 'R\$|12345|500')=0, 'mensagens sem valores em R$');
-- evento novo depois: só ele é criado
insert into public.ocorrencias(id,obra_id,dados) values ('c2','n1','{"gravidade":"critica","status":"aberta"}');
select tt.exige(public.gerar_notificacoes('2026-09-30 15:10:00-03')=2, 'nova crítica gera 2 avisos (dono e engenharia)');

-- horário silencioso (fuso de São Paulo)
select tt.exige(public.proximo_envio('00000000-0000-0000-0000-000000000004', false, '2026-09-30 23:00:00-03') = '2026-10-01 07:00:00-03', 'normal às 23h espera até 7h');
select tt.exige(public.proximo_envio('00000000-0000-0000-0000-000000000004', false, '2026-09-30 05:00:00-03') = '2026-09-30 07:00:00-03', 'normal às 5h espera até 7h do mesmo dia');
select tt.exige(public.proximo_envio('00000000-0000-0000-0000-000000000004', false, '2026-09-30 10:00:00-03') = '2026-09-30 10:00:00-03', 'normal às 10h sai na hora');
select tt.exige(public.proximo_envio('00000000-0000-0000-0000-000000000004', true, '2026-09-30 23:00:00-03') = '2026-09-30 23:00:00-03', 'crítico fura o silêncio');
insert into public.notificacao_preferencias(user_id, silencio_ini, silencio_fim) values ('00000000-0000-0000-0000-000000000004','22:00','06:00');
select tt.exige(public.proximo_envio('00000000-0000-0000-0000-000000000004', false, '2026-09-30 21:00:00-03') = '2026-09-30 21:00:00-03', 'preferência pessoal de silêncio é respeitada');
delete from public.notificacao_preferencias where user_id='00000000-0000-0000-0000-000000000004';
-- crítico saiu sem esperar; normal às 15h também
select tt.exige((select count(*) from public.notificacao_entregas e join public.notificacoes n on n.id=e.notificacao_id where n.critico and e.enviar_apos=n.criada_em)=(select count(*) from public.notificacoes where critico), 'todo crítico com entrega imediata');

-- resumo diário
select tt.exige(public.resumo_diario('2026-10-03 10:00:00-03')=0, 'sábado não tem resumo');
select tt.exige(public.resumo_diario('2026-09-30 07:00:00-03')=3, 'resumo para dono, engenharia e financeiro (campo/cliente/fora: nada)');
select tt.exige(public.resumo_diario('2026-09-30 07:30:00-03')=0, 'resumo não duplica');
select tt.exige((select corpo from public.notificacoes where user_id='00000000-0000-0000-0000-000000000004' and tipo='resumo_diario') !~ 'R\$', 'resumo sem valores');
insert into public.notificacao_preferencias(user_id, resumo_diario) values ('00000000-0000-0000-0000-000000000004', false);
select tt.exige(public.resumo_diario('2026-10-01 07:00:00-03')=2, 'quem desliga o resumo não recebe');

-- RLS das tabelas novas
set role authenticated;
select tt.como(2);
select tt.exige((select count(*) from public.notificacoes where user_id <> '00000000-0000-0000-0000-000000000002')=0, 'usuário só lê as próprias notificações');
select tt.exige(tt.tenta($$update public.notificacoes set lida_em = now() where tipo='oc_critica'$$), 'marca como lida');
select tt.exige(not tt.tenta($$update public.notificacoes set titulo='x'$$), 'não edita o texto');
select tt.exige(not tt.tenta($$insert into public.notificacoes(user_id,tipo,titulo,chave) values ('00000000-0000-0000-0000-000000000002','x','x','x')$$), 'não cria notificação');
select tt.exige(not tt.tenta($$select count(*) from public.notificacao_entregas$$), 'entregas só o servidor');
select tt.exige(tt.conta('notificacao_regras')=0, 'gestor não vê regras');
select tt.como(3); select tt.exige(tt.conta('notificacoes')=0, 'campo não vê notificações alheias');
select tt.como(1); select tt.exige(tt.conta('notificacao_regras')=7, 'dono vê as regras');
select tt.exige(tt.tenta($$update public.notificacao_regras set ativo=false where tipo='conta_a_vencer'$$), 'dono edita regra');
reset role;
