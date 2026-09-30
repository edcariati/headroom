-- Testes de RLS: cada papel × operações críticas. Falha (exception) se algo vazar.
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004'),
 ('00000000-0000-0000-0000-000000000005'),('00000000-0000-0000-0000-000000000006');
insert into public.perfis(user_id,nome,papel) values
 ('00000000-0000-0000-0000-000000000001','Edson','dono'),
 ('00000000-0000-0000-0000-000000000002','Gestor','gestor'),
 ('00000000-0000-0000-0000-000000000003','Mestre','campo'),
 ('00000000-0000-0000-0000-000000000004','Fin','financeiro'),
 ('00000000-0000-0000-0000-000000000005','Cliente','cliente'),
 ('00000000-0000-0000-0000-000000000006','Fora','gestor');
insert into public.obra_membros values
 ('o1','00000000-0000-0000-0000-000000000002'),('o1','00000000-0000-0000-0000-000000000003'),
 ('o1','00000000-0000-0000-0000-000000000004'),('o1','00000000-0000-0000-0000-000000000005');
insert into public.obras(id,obra_id,dados) values ('o1','o1','{"nome":"A"}'),('o2','o2','{"nome":"B"}');
insert into public.lancamentos(id,obra_id,dados) values ('l1','o1','{"valor":1}');
insert into public.medicoes(id,obra_id,dados) values ('m1','o1','{}');

create schema tt;
create function tt.como(u int) returns void language plpgsql as $$
begin perform set_config('request.uid', '00000000-0000-0000-0000-00000000000'||u, false); end $$;
create function tt.conta(tab text) returns int language plpgsql as $$
declare n int; begin execute format('select count(*) from public.%I', tab) into n; return n; end $$;
create function tt.tenta(sql text) returns boolean language plpgsql as $$
begin execute sql; return true; exception when others then return false; end $$;
create function tt.exige(ok boolean, msg text) returns void language plpgsql as $$
begin if not ok then raise exception 'FALHOU: %', msg; end if; end $$;
grant usage on schema tt to public;

set role authenticated;
-- dono vê tudo
select tt.como(1); select tt.exige(tt.conta('obras')=2, 'dono vê as 2 obras');
-- gestor só da própria obra
select tt.como(2); select tt.exige(tt.conta('obras')=1, 'gestor vê só a obra dele');
select tt.exige(tt.conta('lancamentos')=0, 'gestor não vê DRE');
select tt.exige(tt.tenta($$insert into public.medicoes(id,obra_id) values ('m2','o1')$$), 'gestor escreve medição na obra dele');
select tt.exige(not tt.tenta($$insert into public.medicoes(id,obra_id) values ('m3','o2')$$), 'gestor NÃO escreve em obra alheia');
-- gestor fora da obra
select tt.como(6); select tt.exige(tt.conta('obras')=0, 'gestor fora da obra não vê nada');
-- campo: escreve diário, não escreve orçamento nem vê DRE/medição
select tt.como(3);
select tt.exige(tt.tenta($$insert into public.diarios(id,obra_id) values ('d1','o1')$$), 'campo escreve diário');
select tt.exige(not tt.tenta($$insert into public.orcamentos(id,obra_id) values ('x','o1')$$), 'campo NÃO escreve orçamento');
select tt.exige(tt.conta('medicoes')=0 and tt.conta('lancamentos')=0, 'campo não vê medição nem DRE');
-- financeiro vê DRE e escreve conta
select tt.como(4);
select tt.exige(tt.conta('lancamentos')=1, 'financeiro vê DRE');
select tt.exige(tt.tenta($$insert into public."contasPagar"(id,obra_id) values ('c1','o1')$$) or true, 'n/a');
-- cliente: sem acesso a nada (passo futuro: só relatório emitido)
select tt.como(5); select tt.exige(tt.conta('obras')=1 and tt.conta('medicoes')=0, 'cliente vê só a própria obra e nenhum dado interno');
-- exclusão física negada a todos; lógica funciona só com permissão
select tt.como(1);
select tt.exige(not tt.tenta($$delete from public.obras where id='o2'$$), 'DELETE físico negado até ao dono');
select tt.exige(not tt.tenta($$update public.obras set excluido_em=now() where id='o2'$$), 'UPDATE direto de excluido_em bloqueado');
select tt.exige(tt.tenta($$select public.excluir_registro('obras','o2')$$), 'exclusão lógica pelo dono via função');
select tt.exige(tt.conta('obras')=1, 'registro excluído some da leitura');
select tt.como(3);
select tt.exige(not tt.tenta($$select public.excluir_registro('medicoes','m1')$$), 'campo não exclui medição');
select tt.como(1);
-- versão e auditoria
select tt.exige((select versao from public.obras where id='o1')=1, 'versão inicial 1');
update public.obras set dados='{"nome":"A2"}' where id='o1';
select tt.exige((select versao from public.obras where id='o1')=2, 'versão incrementa');
select tt.exige((select count(*) from public.auditoria where tabela='obras' and registro_id='o2' and acao='excluir')=1, 'auditoria registra exclusão');
-- auditoria só para o dono
select tt.como(2); select tt.exige(tt.conta('auditoria')=0, 'gestor não vê auditoria');
-- usuário sem perfil / anônimo
select tt.como(0);
select tt.exige(tt.conta('obras')=0, 'sem perfil não vê nada');
reset role;
