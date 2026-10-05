-- Gestão integrada: pedidos de pagamento (vários orçamentos, aprovação por alçada, fora do escopo).
-- Fica no grupo "financeiro": só dono, gestor e financeiro leem/escrevem; campo e cliente não veem valores.
-- O relatório quinzenal reaproveita a tabela "relatorios" (campo dados->>'tipo' = 'quinzenal'); nada novo ali.

insert into public.colecoes(nome, grupo, tem_obra) values ('pedidosPag','financeiro',true)
on conflict (nome) do nothing;

do $$
begin
  perform public.criar_tabela_colecao('pedidosPag');
  execute 'drop trigger if exists trg_registro on public."pedidosPag"';
  execute 'create trigger trg_registro before insert or update on public."pedidosPag" for each row execute function public.trg_registro()';
end $$;
