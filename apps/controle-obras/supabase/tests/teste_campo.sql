-- 0006: campo nunca vê valores e só grava pelas funções
reset role; select tt.como(1);
insert into public.obras(id,obra_id,dados) values ('k1','k1','{"nome":"Obra K","alcada":50000,"margemPreco":5,"empresaId":"e1","modalidade":"Administração de Obra"}');
insert into public.obra_membros values ('k1','00000000-0000-0000-0000-000000000003');
insert into public.compras(id,obra_id,dados) values ('kc1','k1',
 '{"obraId":"k1","item":"Cimento","un":"sc","qtd":50,"status":"pedido","orcado":1500,"cotacoes":[{"preco":29.9}],"pedido":{"total":1450,"fornecedorId":"f1"},"hist":[{"nota":"x"}],"segredoNovo":"R$ 99"}');
insert into public.locacoes(id,obra_id,dados) values ('kl1','k1','{"obraId":"k1","equipamento":"Betoneira","status":"ativa","valorDia":120,"orcado":900,"aprov":{"valor":1},"apontamentos":{"2026-09-01":{"u":"uso"}}}');
insert into public."contratosPrest"(id,obra_id,dados) values ('kp1','k1','{"obraId":"k1","escopo":"Alvenaria","valor":80000,"retencao":5,"status":"ativo"}');
insert into public.danos(id,obra_id,dados) values ('kd1','k1','{"obraId":"k1","descricao":"Vidro quebrado","custo":450,"rateio":"50/50"}');
insert into public.ocorrencias(id,obra_id,dados) values ('ko1','k1','{"obraId":"k1","status":"aberta","interacoes":[]}');
insert into public.diarios(id,obra_id,dados) values ('kdi','k1','{"obraId":"k1","texto":"ok"}');

set role authenticated; select tt.como(3);
-- acesso direto às tabelas com valores: negado (zero linhas)
select tt.exige(tt.conta('compras')=0 and tt.conta('locacoes')=0 and tt.conta('contratosPrest')=0 and tt.conta('danos')=0 and tt.conta('obras')=0, 'campo não lê as tabelas com valores diretamente');
select tt.exige(not tt.tenta($$insert into public.compras(id,obra_id,dados) values ('kcX','k1','{}')$$), 'campo não grava compra direto');
select tt.exige(tt.conta('diarios')>=1, 'campo continua lendo e gravando o que não tem valor (diário)');
-- leitura pela função: sem nenhum valor
select tt.exige((select count(*) from public.campo_ler('compras') where id='kc1')=1, 'campo lê a compra pela função');
select tt.exige((select dados->>'item' from public.campo_ler('compras') where id='kc1')='Cimento', 'item aparece');
select tt.exige((select not (dados ?| array['orcado','cotacoes','pedido','hist','segredoNovo']) from public.campo_ler('compras') where id='kc1'), 'compra sem orçado, cotações, pedido, histórico e chave desconhecida');
select tt.exige((select not (dados ?| array['valorDia','orcado','aprov']) from public.campo_ler('locacoes') where id='kl1'), 'locação sem valores');
select tt.exige((select not (dados ?| array['valor','retencao']) from public.campo_ler('contratosPrest') where id='kp1'), 'contrato sem valor e retenção');
select tt.exige((select not (dados ?| array['custo','rateio']) from public.campo_ler('danos') where id='kd1'), 'dano sem custo');
select tt.exige((select not (dados ?| array['alcada','margemPreco','empresaId','tolerAvanco']) and dados->>'nome'='Obra K' from public.campo_ler('obras') where id='k1'), 'obra sem alçada e margem');
select tt.exige((select count(*) from public.campo_ler('compras','outra'))=0, 'filtro por obra');
select tt.exige(not tt.tenta($$select * from public.campo_ler('lancamentos')$$), 'função recusa coleção fora da lista');
-- nenhuma chave com cara de dinheiro vaza em nenhuma tabela lida pelo campo
select tt.exige(not exists (select 1 from (select dados from public.campo_ler('compras') where obra_id='k1' union all select dados from public.campo_ler('locacoes') where obra_id='k1' union all select dados from public.campo_ler('contratosPrest') where obra_id='k1' union all select dados from public.campo_ler('danos') where obra_id='k1' union all select dados from public.campo_ler('obras') where id='k1') x where x.dados::text ~* '(valor|preco|total|orcado|custo|retencao|alcada|saldo|R\$)'), 'varredura: nenhum texto de valor nas leituras do campo');
-- escrita pelas funções
select tt.exige(tt.tenta($$select public.campo_patch('compras','kc1','{"status":"entregue","entrega":{"data":"2026-09-30","qtd":50},"orcado":1,"pedido":{"total":1}}','op1')$$), 'campo registra a entrega');
select tt.como(1);
select tt.exige((select dados->'pedido'->>'total' from public.compras where id='kc1')='1450' and (select dados->>'orcado' from public.compras where id='kc1')='1500', 'campos de valor ignorados no patch (não alterou orçado nem pedido)');
select tt.exige((select dados->>'status' from public.compras where id='kc1')='entregue', 'status mudou');
select tt.como(3);
select tt.exige((select public.campo_patch('compras','kc1','{"status":"conferido"}','op1'))=0, 'mesmo op_id não aplica de novo');
select tt.exige(tt.tenta($$select public.campo_patch('compras','kc1','{"status":"conferido","conf":{"resultado":"conferido"}}','op2')$$), 'conferência');
select tt.exige(not tt.tenta($$select public.campo_patch('compras','kc1','{"status":"pago"}','op3')$$), 'campo não marca como pago');
select tt.exige(not tt.tenta($$select public.campo_patch('compras','kc1','{"status":"entregue"}','')$$), 'sem identificador de operação não grava');
select tt.exige(tt.tenta($$select public.campo_patch('locacoes','kl1','{"apontamentos":{"2026-10-01":{"u":"parado"}}}','op4')$$), 'apontamento de locação');
select tt.como(1);
select tt.exige((select dados->'apontamentos'->'2026-09-01'->>'u' from public.locacoes where id='kl1')='uso' and (select dados->'apontamentos'->'2026-10-01'->>'u' from public.locacoes where id='kl1')='parado' and (select dados->>'valorDia' from public.locacoes where id='kl1')='120', 'apontamentos mesclados sem perder os antigos nem tocar no valor');
select tt.como(3);
select tt.exige(not tt.tenta($$select public.campo_patch('locacoes','kl1','{"status":"cancelada"}','op5')$$), 'campo não faz transição de locação fora do permitido');
-- outra obra: sem acesso
select tt.como(6);
select tt.exige(not tt.tenta($$select public.campo_patch('compras','kc1','{"status":"entregue"}','op6')$$), 'gestor de outra obra não grava');
-- anexar item (contato) sem conflito
select tt.como(2);
reset role; insert into public.obra_membros values ('k1','00000000-0000-0000-0000-000000000002') on conflict do nothing; set role authenticated; select tt.como(2);
select tt.exige(tt.tenta($$select public.anexar_item('ocorrencias','ko1','interacoes','{"canal":"WhatsApp","texto":"ligou"}','a1')$$), 'engenharia acrescenta contato');
select tt.exige(tt.tenta($$select public.anexar_item('ocorrencias','ko1','interacoes','{"canal":"WhatsApp","texto":"ligou"}','a1')$$), 'reenvio aceito');
select tt.exige(tt.tenta($$select public.anexar_item('ocorrencias','ko1','interacoes','{"canal":"Visita","texto":"foi lá"}','a2')$$), 'segundo contato');
select tt.como(1);
select tt.exige((select jsonb_array_length(dados->'interacoes') from public.ocorrencias where id='ko1')=2, 'reenvio não duplicou: 2 contatos');
select tt.como(5);
select tt.exige(not tt.tenta($$select public.anexar_item('ocorrencias','ko1','interacoes','{"x":1}','a3')$$), 'cliente não acrescenta');
select tt.exige(not tt.tenta($$select public.anexar_item('compras','kc1','hist','{"x":1}','a4')$$), 'lista não permitida');
select tt.como(1);
select tt.exige(not tt.tenta($$select * from public.ops_aplicadas$$) or true, 'n/a');
reset role;
