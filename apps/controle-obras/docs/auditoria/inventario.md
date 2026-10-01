# Inventário do banco (gerado em 01/10/2026 por supabase/tests/inventario.sh)

Gerado a partir das migrações `0001` a `0007` aplicadas em um Postgres 16 local descartável, **simulando privilégios padrão permissivos**. Para regerar: `bash supabase/tests/inventario.sh`. **Não foi conferido contra um projeto Supabase real** (ele ainda não existe).

## Tabelas e RLS
| Tabela | RLS ligada | RLS forçada | Políticas | Grants (authenticated) | Grants (anon) |
|---|---|---|---|---|---|
| acoes | sim | sim | acoes_ins(insert), acoes_sel(select), acoes_upd(update) | INSERT,SELECT,UPDATE | — |
| aditivos | sim | sim | aditivos_ins(insert), aditivos_sel(select), aditivos_upd(update) | INSERT,SELECT,UPDATE | — |
| aportes | sim | sim | aportes_ins(insert), aportes_sel(select), aportes_upd(update) | INSERT,SELECT,UPDATE | — |
| atas | sim | sim | atas_ins(insert), atas_sel(select), atas_upd(update) | INSERT,SELECT,UPDATE | — |
| atividades | sim | sim | atividades_ins(insert), atividades_sel(select), atividades_upd(update) | INSERT,SELECT,UPDATE | — |
| auditoria | sim | não | auditoria_sel(select) | SELECT | — |
| avaliacoes | sim | sim | avaliacoes_ins(insert), avaliacoes_sel(select), avaliacoes_upd(update) | INSERT,SELECT,UPDATE | — |
| chamadosCustos | sim | sim | chamadosCustos_ins(insert), chamadosCustos_sel(select), chamadosCustos_upd(update) | INSERT,SELECT,UPDATE | — |
| chamadosGarantia | sim | sim | chamadosGarantia_ins(insert), chamadosGarantia_sel(select), chamadosGarantia_upd(update), chamados_cliente_ins(insert), chamados_cliente_sel(select) | INSERT,SELECT,UPDATE | — |
| colecoes | sim | não | colecoes_sel(select) | SELECT | — |
| compras | sim | sim | compras_ins(insert), compras_sel(select), compras_upd(update) | INSERT,SELECT,UPDATE | — |
| config | sim | sim | config_ins(insert), config_sel(select), config_upd(update) | INSERT,SELECT,UPDATE | — |
| contasPagar | sim | sim | contasPagar_ins(insert), contasPagar_sel(select), contasPagar_upd(update) | INSERT,SELECT,UPDATE | — |
| contratosCliente | sim | sim | contratosCliente_ins(insert), contratosCliente_sel(select), contratosCliente_upd(update) | INSERT,SELECT,UPDATE | — |
| contratosPrest | sim | sim | contratosPrest_ins(insert), contratosPrest_sel(select), contratosPrest_upd(update) | INSERT,SELECT,UPDATE | — |
| danos | sim | sim | danos_ins(insert), danos_sel(select), danos_upd(update) | INSERT,SELECT,UPDATE | — |
| diarios | sim | sim | diarios_ins(insert), diarios_sel(select), diarios_upd(update) | INSERT,SELECT,UPDATE | — |
| docsLegais | sim | sim | docsLegais_ins(insert), docsLegais_sel(select), docsLegais_upd(update) | INSERT,SELECT,UPDATE | — |
| docsPrest | sim | sim | docsPrest_ins(insert), docsPrest_sel(select), docsPrest_upd(update) | INSERT,SELECT,UPDATE | — |
| empresas | sim | sim | empresas_ins(insert), empresas_sel(select), empresas_upd(update) | INSERT,SELECT,UPDATE | — |
| etapas | sim | sim | etapas_ins(insert), etapas_sel(select), etapas_upd(update) | INSERT,SELECT,UPDATE | — |
| eventos | sim | sim | eventos_ins(insert), eventos_sel(select), eventos_upd(update) | INSERT,SELECT,UPDATE | — |
| fichas | sim | sim | fichas_ins(insert), fichas_sel(select), fichas_upd(update) | INSERT,SELECT,UPDATE | — |
| fornecedores | sim | sim | fornecedores_ins(insert), fornecedores_sel(select), fornecedores_upd(update) | INSERT,SELECT,UPDATE | — |
| garantias | sim | sim | garantias_cliente(select), garantias_ins(insert), garantias_sel(select), garantias_upd(update) | INSERT,SELECT,UPDATE | — |
| lancamentos | sim | sim | lancamentos_ins(insert), lancamentos_sel(select), lancamentos_upd(update) | INSERT,SELECT,UPDATE | — |
| licoes | sim | sim | licoes_ins(insert), licoes_sel(select), licoes_upd(update) | INSERT,SELECT,UPDATE | — |
| locacoes | sim | sim | locacoes_ins(insert), locacoes_sel(select), locacoes_upd(update) | INSERT,SELECT,UPDATE | — |
| locs | sim | sim | locs_ins(insert), locs_sel(select), locs_upd(update) | INSERT,SELECT,UPDATE | — |
| materiais | sim | sim | materiais_ins(insert), materiais_sel(select), materiais_upd(update) | INSERT,SELECT,UPDATE | — |
| medicoes | sim | sim | medicoes_ins(insert), medicoes_sel(select), medicoes_upd(update) | INSERT,SELECT,UPDATE | — |
| movEstoque | sim | sim | movEstoque_ins(insert), movEstoque_sel(select), movEstoque_upd(update) | INSERT,SELECT,UPDATE | — |
| notificacao_entregas | sim | não | **nenhuma** | — | — |
| notificacao_preferencias | sim | não | pref_own(todas) | INSERT,SELECT,UPDATE | — |
| notificacao_regras | sim | não | regras_dono(todas) | SELECT,UPDATE | — |
| notificacoes | sim | não | notif_sel(select), notif_upd(update) | SELECT | — |
| obra_membros | sim | não | membros_dono(todas), membros_sel(select) | INSERT,SELECT,UPDATE | — |
| obras | sim | sim | obras_cliente(select), obras_ins(insert), obras_sel(select), obras_upd(update) | INSERT,SELECT,UPDATE | — |
| ocorrencias | sim | sim | ocorrencias_ins(insert), ocorrencias_sel(select), ocorrencias_upd(update) | INSERT,SELECT,UPDATE | — |
| ops_aplicadas | sim | não | **nenhuma** | — | — |
| orcItens | sim | sim | orcItens_ins(insert), orcItens_sel(select), orcItens_upd(update) | INSERT,SELECT,UPDATE | — |
| orcamentos | sim | sim | orcamentos_ins(insert), orcamentos_sel(select), orcamentos_upd(update) | INSERT,SELECT,UPDATE | — |
| pacotes | sim | sim | pacotes_ins(insert), pacotes_sel(select), pacotes_upd(update) | INSERT,SELECT,UPDATE | — |
| perfis | sim | não | perfis_dono(todas), perfis_sel(select) | INSERT,SELECT,UPDATE | — |
| permissoes | sim | não | permissoes_sel(select) | SELECT | — |
| pesquisasSatisfacao | sim | sim | pesquisasSatisfacao_ins(insert), pesquisasSatisfacao_sel(select), pesquisasSatisfacao_upd(update), pesquisas_cliente_ins(insert), pesquisas_cliente_sel(select) | INSERT,SELECT,UPDATE | — |
| prestadores | sim | sim | prestadores_ins(insert), prestadores_sel(select), prestadores_upd(update) | INSERT,SELECT,UPDATE | — |
| relatorios | sim | sim | relatorios_cliente(select), relatorios_ins(insert), relatorios_sel(select), relatorios_upd(update) | INSERT,SELECT,UPDATE | — |
| rfis | sim | sim | rfis_ins(insert), rfis_sel(select), rfis_upd(update) | INSERT,SELECT,UPDATE | — |
| servicos | sim | sim | servicos_ins(insert), servicos_sel(select), servicos_upd(update) | INSERT,SELECT,UPDATE | — |
| termos | sim | sim | termos_ins(insert), termos_sel(select), termos_upd(update) | INSERT,SELECT,UPDATE | — |
| treinamentos | sim | sim | treinamentos_ins(insert), treinamentos_sel(select), treinamentos_upd(update) | INSERT,SELECT,UPDATE | — |
| visitasPosObra | sim | sim | visitasPosObra_ins(insert), visitasPosObra_sel(select), visitasPosObra_upd(update), visitas_cliente(select) | INSERT,SELECT,UPDATE | — |

## Funções
| Função | security definer | search_path fixo | Executável por |
|---|---|---|---|
| aceitar_chamado(rid text, aceito boolean, texto text) | sim | sim | authenticated |
| anexar_item(tab text, rid text, campo text, item jsonb, p_op text) | sim | sim | authenticated |
| campo_ler(tab text, p_obra text) | sim | sim | authenticated |
| campo_patch(tab text, rid text, patch jsonb, p_op text) | sim | sim | authenticated |
| criar_tabela_colecao(tab text) | não | n/a | só dono |
| dados_sem_valores(tab text, d jsonb) | não | sim | só dono |
| destinatarios(p_tipo text, p_obra text) | sim | sim | só dono |
| eventos_notificaveis(p_hoje date) | sim | sim | só dono |
| excluir_registro(tab text, rid text) | sim | sim | authenticated |
| gerar_notificacoes(p_agora timestamp with time zone) | sim | sim | só dono |
| na_obra(oid text) | sim | sim | authenticated |
| nivel_em(tab text) | sim | sim | authenticated |
| papel_atual() | sim | sim | authenticated |
| proximo_envio(p_user uuid, p_critico boolean, p_agora timestamp with time zone) | sim | sim | só dono |
| resumo_diario(p_agora timestamp with time zone) | sim | sim | só dono |
| resumo_semanal(p_agora timestamp with time zone) | sim | sim | só dono |
| trg_chamado() | sim | sim | só dono |
| trg_registro() | sim | sim | só dono |
| trg_regras() | sim | sim | só dono |
| validar_relatorio(rid text, situacao text, texto text) | sim | sim | authenticated |

## Gatilhos
- acoes: trg_registro (INSERT)
- acoes: trg_registro (UPDATE)
- aditivos: trg_registro (INSERT)
- aditivos: trg_registro (UPDATE)
- aditivos: trg_regras (INSERT)
- aditivos: trg_regras (UPDATE)
- aportes: trg_registro (INSERT)
- aportes: trg_registro (UPDATE)
- atas: trg_registro (INSERT)
- atas: trg_registro (UPDATE)
- atividades: trg_registro (INSERT)
- atividades: trg_registro (UPDATE)
- avaliacoes: trg_registro (INSERT)
- avaliacoes: trg_registro (UPDATE)
- chamadosCustos: trg_registro (INSERT)
- chamadosCustos: trg_registro (UPDATE)
- chamadosGarantia: trg_chamado (INSERT)
- chamadosGarantia: trg_chamado (UPDATE)
- chamadosGarantia: trg_registro (INSERT)
- chamadosGarantia: trg_registro (UPDATE)
- compras: trg_registro (INSERT)
- compras: trg_registro (UPDATE)
- config: trg_registro (INSERT)
- config: trg_registro (UPDATE)
- contasPagar: trg_registro (INSERT)
- contasPagar: trg_registro (UPDATE)
- contasPagar: trg_regras (INSERT)
- contasPagar: trg_regras (UPDATE)
- contratosCliente: trg_registro (INSERT)
- contratosCliente: trg_registro (UPDATE)
- contratosPrest: trg_registro (INSERT)
- contratosPrest: trg_registro (UPDATE)
- danos: trg_registro (INSERT)
- danos: trg_registro (UPDATE)
- diarios: trg_registro (INSERT)
- diarios: trg_registro (UPDATE)
- docsLegais: trg_registro (INSERT)
- docsLegais: trg_registro (UPDATE)
- docsPrest: trg_registro (INSERT)
- docsPrest: trg_registro (UPDATE)
- empresas: trg_registro (INSERT)
- empresas: trg_registro (UPDATE)
- etapas: trg_registro (INSERT)
- etapas: trg_registro (UPDATE)
- eventos: trg_registro (INSERT)
- eventos: trg_registro (UPDATE)
- fichas: trg_registro (INSERT)
- fichas: trg_registro (UPDATE)
- fornecedores: trg_registro (INSERT)
- fornecedores: trg_registro (UPDATE)
- garantias: trg_registro (INSERT)
- garantias: trg_registro (UPDATE)
- lancamentos: trg_registro (INSERT)
- lancamentos: trg_registro (UPDATE)
- licoes: trg_registro (INSERT)
- licoes: trg_registro (UPDATE)
- locacoes: trg_registro (INSERT)
- locacoes: trg_registro (UPDATE)
- locs: trg_registro (INSERT)
- locs: trg_registro (UPDATE)
- materiais: trg_registro (INSERT)
- materiais: trg_registro (UPDATE)
- medicoes: trg_registro (INSERT)
- medicoes: trg_registro (UPDATE)
- medicoes: trg_regras (INSERT)
- medicoes: trg_regras (UPDATE)
- movEstoque: trg_registro (INSERT)
- movEstoque: trg_registro (UPDATE)
- obras: trg_registro (INSERT)
- obras: trg_registro (UPDATE)
- obras: trg_regras (INSERT)
- obras: trg_regras (UPDATE)
- ocorrencias: trg_registro (INSERT)
- ocorrencias: trg_registro (UPDATE)
- orcItens: trg_registro (INSERT)
- orcItens: trg_registro (UPDATE)
- orcItens: trg_regras (INSERT)
- orcItens: trg_regras (UPDATE)
- orcamentos: trg_registro (INSERT)
- orcamentos: trg_registro (UPDATE)

## Contagens
tabelas=53
tabelas sem RLS=0
tabelas com RLS e sem política=2
funções security definer sem search_path=0
funções executáveis por anon=0
políticas com using(true)=0

## Fora do banco (inventário complementar, conferido nos arquivos)
| Item | Onde | Finalidade | Quem acessa |
|---|---|---|---|
| Bucket de Storage `obras-arquivos` | `src/core.js` (`BUCKET`) e `supabase/schema.sql` (esquema antigo) | fotos e PDFs | **A definir na auditoria**: o desenho de políticas de Storage por obra e perfil **ainda não existe** (ver plano, lacuna L-1) |
| Service worker `sw.js`, `manifest.webmanifest`, ícones | raiz do app (gerados por `build.py`) | uso offline | navegador |
| Banco local do aparelho (IndexedDB `cob-<usuário>`) | `src/offline.js` | cache de leitura, fila, fotos pendentes | o próprio usuário no aparelho |
| Funções de borda (Edge Functions) | **não existem** | e-mail, webhooks, WhatsApp | — |
| Tarefas agendadas (`pg_cron`) | só como comandos comentados nas migrações 0003 e 0004 | motor de avisos | — |
| Segredos | nenhum no repositório (chave `anon` é pública por definição) | — | — |
