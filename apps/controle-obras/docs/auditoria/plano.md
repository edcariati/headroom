# Plano de auditoria (fase 9, passo 1) — PARADA CURTA para o Edson confirmar

## 1. Onde estamos (conferido, não suposto)
| Item | Situação real |
|---|---|
| Fases 1 a 6 | Prontas. 53 tabelas, RLS em todas, 7 migrações, **tudo testado só em Postgres local** (nunca num Supabase real). |
| Fase 7 | 7A, 7B e 7C prontas. **7D (guias, treinamento, ajuda, obra de demonstração, painel de adoção) ainda não feita**: espero seu OK nos índices. |
| Fase 8 | **Não iniciada** (integrações). A auditoria exclui orçamento por API, assinatura, calendário e WhatsApp; ficam para auditoria própria quando existirem. |
| Projeto Supabase de desenvolvimento | **Não existe.** É o maior limitador desta fase. |
| Funções de borda, convite de usuário, 2FA, políticas de Storage | **Não existem** (ver lacunas L-1 a L-4 em `achados-preliminares.md`). |
| Hospedagem e cabeçalhos de segurança | Não definidos. |

**Consequência honesta:** o prompt da fase 9 pede testes “contra o ambiente de desenvolvimento, com contas de cada perfil, via API”. Sem projeto real, **só consigo** (a) testar o banco como cada papel no Postgres local, (b) testar o app em jsdom com Supabase simulado e (c) testar o service worker num Chromium. **Não consigo** testar Auth real, Storage real, Realtime real, PostgREST (a camada de API do Supabase) nem o ensaio de restauração de cópia de segurança. Esses itens ficam marcados “não testado” no relatório, e o **veredito não pode ser “pode ir ao ar”** enquanto o projeto real não existir e a suíte não rodar nele.

## 2. O que já foi feito neste passo
- Inventário do banco gerado por script reproduzível (`docs/auditoria/inventario.md`).
- **Três achados reais corrigidos e provados em Postgres local** (A-01 a A-03, `achados-preliminares.md`): privilégios de tabela e função agora são revogados e concedidos explicitamente, sem depender do padrão do Supabase.
- Suíte nova `supabase/tests/teste_permissoes.sql` (tentativas de TRUNCATE/DELETE em todas as tabelas, `anon` sem acesso, lista fechada de funções) rodando em `npm run test:rls` contra o **pior caso** de privilégios padrão.

## 3. Escopo proposto, na ordem
| Passo | O que | Como (dentro do que é possível) |
|---|---|---|
| 2 | RLS, funções, valores em R$ | Gerar casos da matriz de permissões (tabela `permissoes`) e rodar como cada papel (dono, gestor, financeiro, campo, cliente, leitura, visitante) em todas as tabelas e operações; chamadas hostis às funções; caça a valores em R$ em tabelas, funções, notificações, calendário e cache offline |
| 3 | Autenticação, Storage, navegador, offline | **Escrever** as políticas de Storage (lacuna L-1) e provar; XSS em todos os formulários no jsdom; cache offline sem valores e limpo no logout (já testado, ampliar) |
| 4 | Borda, integrações, abuso, dependências | Só o que existe: `npm audit`, varredura de segredos no histórico do git, análise estática, limites de upload. Funções de borda/webhooks: **não existem**, registrados como lacuna |
| 5 | Correção de críticos e altos | Cada correção com teste que falha antes e passa depois |
| 6 | Privacidade e LGPD | Documentos e perguntas ao advogado e ao encarregado (recomendação técnica, sem parecer jurídico) |
| 7 | Qualidade, carga, usabilidade | Dados sintéticos e medição no banco local; roteiros manuais para iPhone e Android (**você executa**) |
| 8 | Operação e continuidade | Documentos, alertas, custos com fonte e data; **ensaio de restauração fica pendente do projeto real** |
| 9 | Piloto + CI | Lista de entrada, critérios, **GitHub Actions** com a suíte, varredura de segredos, tabelas sem RLS e migrações do zero |
| 10 | Pacote da segunda leitura humana | Matriz **traduzida das políticas reais**, perguntas do Anexo B |
| 11 | Relatório final e veredito | Com franqueza sobre o que não foi testado |

## 4. O que preciso de você (seção 0 do prompt)
1. **Criar o projeto `cariati-obras-dev`** no Supabase e passar a URL e a chave `anon` (nunca a `service_role`). **Sem isso a auditoria fica pela metade.**
2. **Quem faz a segunda leitura das permissões** (pessoa técnica que não escreveu o sistema).
3. **Contador e advogado** (DRE/repasse; LGPD, assinatura, contratos com fornecedores). Preparo as perguntas.
4. **Encarregado de dados** e contato para titulares.
5. **Pessoas e perfis do piloto.**
6. **Hospedagem escolhida** (define cabeçalhos de segurança) e **plano do Supabase** (define cópias de segurança).

## 5. Perguntas para decidir agora
- **Concluo antes a 7D** (guias e ajuda) ou **vou direto para a auditoria** com o que existe? Recomendo **auditoria primeiro**, porque a 7D só documenta o que está pronto e a auditoria pode mudar telas e permissões.
- Posso **escrever as políticas de Storage por obra e perfil** agora (lacuna L-1, provável achado alto), tratando-as como correção desta fase?
