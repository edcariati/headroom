-- Regras críticas no servidor (o navegador continua validando, mas o servidor decide).
-- Rodar só no dev até o Edson liberar a produção.

create or replace function public.trg_regras() returns trigger
language plpgsql security definer set search_path = public as $$
declare papel text := public.papel_atual(); ant jsonb := coalesce(old.dados,'{}'::jsonb); nov jsonb := new.dados;
begin
  if tg_op <> 'UPDATE' then
    -- criação: medição e aditivo não nascem aprovados/assinados; relatório não nasce emitido; obra não nasce encerrada
    if tg_table_name = 'medicoes' and nov->>'status' = 'aprovada' then raise exception 'Medição não pode ser criada já aprovada'; end if;
    if tg_table_name = 'aditivos' and nov->>'status' = 'assinado' then raise exception 'Aditivo não pode ser criado já assinado'; end if;
    return new;
  end if;

  if tg_table_name = 'relatorios' and ant->>'status' = 'emitido' then
    if nov->>'status' is distinct from 'emitido' or nov->'snapshot' is distinct from ant->'snapshot'
       or nov->>'mes' is distinct from ant->>'mes' or nov->>'emitidoEm' is distinct from ant->>'emitidoEm' then
      raise exception 'Relatório emitido é congelado: para corrigir, crie uma retificação';
    end if;
  end if;

  if tg_table_name = 'orcamentos' and nov is distinct from ant then
    raise exception 'Versão de orçamento é imutável: crie uma nova versão';
  end if;
  if tg_table_name = 'orcItens' and old.id not like 'ref\_%' and nov is distinct from ant then
    raise exception 'Itens de uma versão de orçamento são imutáveis';
  end if;

  if tg_table_name = 'contasPagar' and ant->>'status' = 'paga' and nov->>'status' is distinct from 'paga' and papel <> 'dono' then
    raise exception 'Conta paga só volta pelo dono';
  end if;

  if tg_table_name = 'medicoes' then
    if nov->>'status' = 'aprovada' and ant->>'status' is distinct from 'aprovada' and papel not in ('dono','financeiro') then
      raise exception 'Só dono ou financeiro aprovam medição';
    end if;
    if ant->>'status' = 'aprovada' and nov->>'status' is distinct from 'aprovada' and papel <> 'dono' then
      raise exception 'Medição aprovada só volta pelo dono';
    end if;
    if ant->>'status' = 'aprovada' and nov->'itens' is distinct from ant->'itens' then
      raise exception 'Medição aprovada não pode ter os itens alterados';
    end if;
  end if;

  if tg_table_name = 'aditivos' then
    if nov->>'status' = 'assinado' and ant->>'status' is distinct from 'assinado' and papel not in ('dono','gestor','financeiro') then
      raise exception 'Sem permissão para assinar aditivo';
    end if;
    if ant->>'status' = 'assinado' and (nov->'valor' is distinct from ant->'valor' or nov->'assinatura' is distinct from ant->'assinatura' or nov->>'status' is distinct from 'assinado') then
      raise exception 'Aditivo assinado é imutável';
    end if;
  end if;

  if tg_table_name = 'obras' and (nov->>'situacao' is distinct from ant->>'situacao') and papel <> 'dono' then
    raise exception 'Só o dono encerra ou reabre uma obra';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['relatorios','orcamentos','orcItens','contasPagar','medicoes','aditivos','obras'] loop
    execute format('drop trigger if exists trg_regras on public.%I', t);
    execute format('create trigger trg_regras before insert or update on public.%I for each row execute function public.trg_regras()', t);
  end loop;
end $$;

-- Cliente: lê somente relatórios EMITIDOS da própria obra
create policy relatorios_cliente on public.relatorios for select using (
  public.papel_atual() = 'cliente' and excluido_em is null
  and dados->>'status' = 'emitido' and public.na_obra(obra_id));

-- Cliente: valida ou objeta (muda só validacaoCliente)
create or replace function public.validar_relatorio(rid text, situacao text, texto text default '') returns void
language plpgsql security definer set search_path = public as $$
declare oid text;
begin
  if public.papel_atual() is distinct from 'cliente' then raise exception 'Somente o cliente valida o relatório'; end if;
  if situacao not in ('validado','objecao') then raise exception 'Situação inválida'; end if;
  if situacao = 'objecao' and coalesce(btrim(texto),'') = '' then raise exception 'Objeção exige o motivo'; end if;
  select obra_id into oid from public.relatorios where id = rid and excluido_em is null and dados->>'status' = 'emitido';
  if oid is null or not public.na_obra(oid) then raise exception 'Relatório não encontrado'; end if;
  update public.relatorios set dados = jsonb_set(dados, '{validacaoCliente}',
    jsonb_build_object('status', situacao, 'texto', texto, 'data', current_date, 'por', auth.uid())) where id = rid;
end $$;
revoke all on function public.validar_relatorio(text,text,text) from public, anon;
grant execute on function public.validar_relatorio(text,text,text) to authenticated;
