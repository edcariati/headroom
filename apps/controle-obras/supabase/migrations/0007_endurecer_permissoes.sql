-- 0007 — Endurecimento de permissões (auditoria, fase 9). Independe dos privilégios padrão do Supabase.
-- Achados que esta migração fecha:
--  A-01  Tabelas ficavam com os privilégios padrão do Supabase (que podem incluir TRUNCATE, DELETE e REFERENCES
--        para anon/authenticated). RLS NÃO protege TRUNCATE. Agora: revoga tudo e concede só o mínimo.
--  A-02  Funções de uso interno (criar_tabela_colecao, gatilhos) eram executáveis por anon/authenticated.
--  A-03  Funções novas herdariam EXECUTE para PUBLIC. Agora o padrão é negar.

-- 1) Padrão para objetos futuros: nada para anon/authenticated/PUBLIC
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- 2) Tabelas: zera e concede o mínimo
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

do $$
declare c record;
begin
  for c in select nome from public.colecoes loop            -- dados: ler, criar e alterar (excluir só pela função)
    execute format('grant select, insert, update on public.%I to authenticated', c.nome);
  end loop;
end $$;
grant select, insert, update on public.perfis, public.obra_membros to authenticated;           -- RLS: só o dono escreve
grant select on public.permissoes, public.colecoes, public.auditoria to authenticated;           -- RLS: auditoria só o dono
grant select on public.notificacoes to authenticated;
grant update (lida_em) on public.notificacoes to authenticated;
grant select, insert, update on public.notificacao_preferencias to authenticated;
grant select, update on public.notificacao_regras to authenticated;                              -- RLS: só o dono
-- ops_aplicadas e notificacao_entregas: nenhum acesso de cliente (só funções do servidor)

-- 3) Funções: zera e concede só o necessário
revoke execute on all functions in schema public from public, anon, authenticated;
-- usadas pelas políticas de RLS (avaliadas com o papel do usuário logado)
grant execute on function public.papel_atual(), public.nivel_em(text), public.na_obra(text) to authenticated;
-- chamadas pelo aplicativo (cada uma valida o chamador por dentro)
grant execute on function
  public.excluir_registro(text, text), public.validar_relatorio(text, text, text), public.aceitar_chamado(text, boolean, text),
  public.campo_ler(text, text), public.campo_patch(text, text, jsonb, text), public.anexar_item(text, text, text, jsonb, text)
  to authenticated;
-- funções internas e do motor de notificações: nenhum papel de cliente (rodam como dono, pelo agendador)
