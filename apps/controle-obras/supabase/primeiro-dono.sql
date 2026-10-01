-- Passo único: torna a primeira pessoa "dono" (diretoria). Antes, crie o usuário em Authentication > Users
-- (Add user, com e-mail e senha) e troque o e-mail abaixo. Não contém segredos.
insert into public.perfis (user_id, nome, papel)
select id, 'Edson Cariati', 'dono' from auth.users where email = 'TROQUE-PELO-SEU-EMAIL@exemplo.com'
on conflict (user_id) do update set papel = 'dono', ativo = true;
-- Conferir: select u.email, p.papel, p.ativo from public.perfis p join auth.users u on u.id = p.user_id;
