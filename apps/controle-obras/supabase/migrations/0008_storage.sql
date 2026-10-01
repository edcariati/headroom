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
