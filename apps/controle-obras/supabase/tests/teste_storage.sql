-- 0008: Storage privado por obra e zona
reset role; select tt.como(1);
-- o1: campo(u3), financeiro(u4), cliente(u5), gestor u2 são membros (testes anteriores); u6 é gestor de outra obra; o2 sem membros
insert into storage.objects(bucket_id, name) values
 ('obras-arquivos','o1/campo/2026-10/foto.jpg'),
 ('obras-arquivos','o1/restrito/2026-10/contrato.pdf'),
 ('obras-arquivos','o2/campo/2026-10/foto.jpg'),
 ('obras-arquivos','o2/restrito/2026-10/nota.pdf'),
 ('outro-bucket','o1/campo/2026-10/x.jpg'),
 ('obras-arquivos','solto.jpg'),
 ('obras-arquivos','o1/outra-zona/a.jpg');
create function pg_temp.n(b text default 'obras-arquivos') returns text language sql as $$ select coalesce(string_agg(name, ',' order by name), '') from storage.objects where bucket_id = b $$;

select tt.exige((select public from storage.buckets where id='obras-arquivos')=false, 'bucket é privado');
select tt.exige((select file_size_limit from storage.buckets where id='obras-arquivos')=10485760, 'limite de 10 MB por arquivo');
select tt.exige(not ((select allowed_mime_types from storage.buckets where id='obras-arquivos') && array['text/html','image/svg+xml','application/x-msdownload','application/javascript','application/octet-stream']), 'tipos perigosos fora da lista');

set role authenticated;
select tt.como(3);  -- campo (membro de o1)
select tt.exige((select string_agg(name, ',' order by name) from storage.objects where bucket_id='obras-arquivos' and name like 'o1/%')='o1/campo/2026-10/foto.jpg', 'campo vê só a zona campo da obra dele');
select tt.exige((select count(*) from storage.objects where name like 'o2/%')=0, 'campo não vê obra alheia');
select tt.exige((select count(*) from storage.objects where bucket_id='outro-bucket')=0, 'só o bucket das obras');
select tt.como(4);  -- financeiro
select tt.exige((select string_agg(name, ',' order by name) from storage.objects where name like 'o1/%')='o1/campo/2026-10/foto.jpg,o1/restrito/2026-10/contrato.pdf', 'financeiro vê campo e restrito da obra dele');
select tt.exige((select count(*) from storage.objects where name like 'o2/%')=0, 'financeiro não vê obra alheia');
select tt.como(5);  -- cliente
select tt.exige((select string_agg(name, ',' order by name) from storage.objects where name like 'o1/%')='o1/campo/2026-10/foto.jpg', 'cliente vê só as fotos (campo) da obra dele, nunca documentos restritos');
select tt.como(6);  -- gestor de outra obra
select tt.exige((select count(*) from storage.objects where name like 'o1/%')=0, 'gestor de outra obra não vê o1');
select tt.como(1);  -- dono
select tt.exige((select count(*) from storage.objects where name like 'o%/restrito/%')=2, 'dono vê tudo (o1 e o2 restritos)');
select tt.exige((select count(*) from storage.objects where name in ('solto.jpg','o1/outra-zona/a.jpg'))=0, 'caminho sem obra/zona válidas nunca é lido, nem pelo dono');

-- envio
select tt.como(3);
select tt.exige(tt.tenta($$insert into storage.objects(bucket_id,name) values ('obras-arquivos','o1/campo/2026-10/novo.jpg')$$), 'campo envia foto na zona campo da obra dele');
select tt.exige(not tt.tenta($$insert into storage.objects(bucket_id,name) values ('obras-arquivos','o1/restrito/2026-10/x.pdf')$$), 'campo NÃO envia para a zona restrita');
select tt.exige(not tt.tenta($$insert into storage.objects(bucket_id,name) values ('obras-arquivos','o2/campo/2026-10/x.jpg')$$), 'campo não envia para obra alheia');
select tt.exige(not tt.tenta($$insert into storage.objects(bucket_id,name) values ('obras-arquivos','o1/campo/../../o2/restrito/x.pdf')$$), 'caminho com .. é recusado');
select tt.exige(not tt.tenta($$insert into storage.objects(bucket_id,name) values ('obras-arquivos','x.jpg')$$), 'sem pasta da obra é recusado');
select tt.exige(not tt.tenta($$insert into storage.objects(bucket_id,name) values ('outro-bucket','o1/campo/2026-10/x.jpg')$$), 'só o bucket das obras');
select tt.como(5);
select tt.exige(tt.tenta($$insert into storage.objects(bucket_id,name) values ('obras-arquivos','o1/campo/2026-10/chamado.jpg')$$), 'cliente envia foto de chamado na obra dele');
select tt.exige(not tt.tenta($$insert into storage.objects(bucket_id,name) values ('obras-arquivos','o1/restrito/2026-10/x.pdf')$$), 'cliente NÃO envia documento restrito');
select tt.como(4);
select tt.exige(tt.tenta($$insert into storage.objects(bucket_id,name) values ('obras-arquivos','o1/restrito/2026-10/medicao.pdf')$$), 'financeiro envia documento restrito');
select tt.como(6);
select tt.exige(not tt.tenta($$insert into storage.objects(bucket_id,name) values ('obras-arquivos','o1/campo/2026-10/x.jpg')$$), 'gestor de outra obra não envia');
-- ninguém altera nem apaga
select tt.como(1);
select tt.exige(not tt.tenta($$delete from storage.objects where name like 'o1/%'$$) or (select count(*) from storage.objects where name like 'o1/%')>=3, 'ninguém apaga arquivo (sem privilégio ou sem política)');
reset role;
select tt.como(1);
select tt.exige((select count(*) from storage.objects where name='o1/campo/2026-10/foto.jpg')=1, 'arquivo original intacto');
set role anon;
select tt.exige(not tt.tenta($$select count(*) from storage.objects$$), 'visitante sem login não lê arquivo');
reset role;
