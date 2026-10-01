# Índice-mestre — Aplicativo de Gestão de Obras da Cariati

*Atualizado em 01/10/2026, com o que foi realmente construído e testado. Onde o plano original e a realidade diferem, vale a realidade descrita aqui; o código e o `DECISOES.md` são a fonte final.*

Este arquivo é o mapa do projeto: o que foi feito, o que falta, o que depende de quê, o que só você (Edson) decide e como acompanhar. Guarde-o junto com os prompts.

---

## 1. Onde estamos e o que existe

| Item | O que é | Onde |
| --- | --- | --- |
| Protocolo de Execução de Obra | Fonte das regras: 22 etapas, fichas, indicadores, ritos | https://claude.ai/artifact/EQwMhh1otEqd5fhSP7Yd48 |
| Documento de desenho do sistema | Especificação, com 14 decisões em aberto | https://claude.ai/code/artifact/2a73cd06-93e3-44c8-bf6c-88a1d6574b7d |
| Aplicativo original (fases 1 a 3) | Primeira versão, dentro do claude.ai | https://claude.ai/artifact/HqsvWKt2KdZHuHJAcPJkwx |
| **Código-fonte atual** | App completo (fases 1 a 7C), testes, migrações do banco e documentos | GitHub `edcariati/headroom`, pasta `apps/controle-obras`, branch `claude/relaxed-edison-ruxl3n` |
| **Demonstração com dados fictícios** | 3 obras de exemplo para clicar e testar; o que você muda não fica salvo | https://claude.ai/artifact/KX38ayue8P6jPpScxjMkXH |
| **App com banco próprio (uso real, nesta conta)** | Começa vazio; guarda dados, histórico e fotos; compartilhável pelo menu Compartilhar | https://claude.ai/artifact/1Wi6UAdNQrD36Hv6ZXoPap |
| Projeto Supabase de desenvolvimento | `cariati-obras-dev` (criado por você); o app já aponta para ele em `config.js` | https://uqhdugageaxeghbuapud.supabase.co |
| Prompts das fases | Instruções do Claude Code (fases 4 a 10) | `prompt-faseN-claude-code.md` |
| Documentos do projeto | Decisões, mudanças, modelo de dados, regras, desenho do Supabase, do offline, da fase 7, auditoria | `DECISOES.md`, `CHANGELOG.md`, `docs/` |

**Números hoje:** 256 testes automáticos do app, mais a suíte do banco (RLS, permissões, Storage, regras, notificações, pós-obra, perfil campo) rodando num Postgres local. Nada disso foi executado ainda contra o Supabase real (veja a seção 2.1).

### Dois caminhos para usar o app hoje

| | A. App com banco próprio (já no ar) | B. Supabase + hospedagem (caminho final) |
| --- | --- | --- |
| Pronto para uso | **Sim**, agora | Não: faltam tabelas aplicadas, teste real e hospedagem |
| Quem acessa | Quem você convidar pelo menu Compartilhar | Pessoas com login e perfil |
| Perfis e valores em R$ | **Todo mundo que grava vê tudo, inclusive valores.** Sem perfis | Valores protegidos no banco, por perfil |
| Avisos por e-mail, modo offline, portal do cliente com login | Não | Sim (e-mail depende do provedor) |
| Serve para | Testar, treinar e mostrar | Piloto e uso real (depois da fase 9) |

**Regra de bom senso:** o caminho A serve para você testar sozinho ou com pouca gente de confiança, sem dados sensíveis de clientes. **Não use o caminho A como sistema oficial da Cariati.** Os dados do caminho A precisam ser levados ao caminho B no futuro (uma tarefa de migração que ainda não existe).

---

## 2. Estado de cada fase

| Fase | Tema | Estado real |
| --- | --- | --- |
| 1 | Base e campo | **Feita** (claude.ai, depois levada ao repositório) |
| 2 | Agenda, conformidade, balanço | **Feita** |
| 3 | Suprimentos e prestadores | **Feita** |
| 4 | Custo, medição e financeiro | **Feita** (passos 0 a 8, testes verdes) |
| 5 | DRE, relatório e avaliação | **Feita** (passos 0 a 8). Falta só você conferir a impressão A4 do relatório |
| 6 | Supabase, login e perfis | **Parcial.** Desenho, esquema, regras no servidor, RLS, Storage privado e o app falando com o banco novo estão prontos e testados **só em simulação**. Faltam: aplicar no projeto real, tela “Usuários e acessos”, convites, migração dos dados, hospedagem e produção |
| 7 | Notificações, pós-obra, offline, guias | **7A parcial** (motor, central de avisos, 18 tipos de aviso no banco; **falta e-mail e agendador**). **7B feita** (garantias, chamados, visitas, satisfação, portal do cliente). **7C feita** (offline de campo, perfil campo sem valores no banco). **7D não feita** (guias, treinamento, ajuda, obra de demonstração, painel de adoção) |
| 8 | Integrações | **Não iniciada** |
| 9 | Auditoria final | **Parcial.** Passos 0 e 1 feitos; 4 achados de segurança corrigidos e provados em teste local; pipeline do GitHub criado (ainda não rodou); falta a auditoria contra o Supabase real |
| 10 | Piloto | **Não iniciada.** Só começa com a fase 9 em “pode ir ao ar” |

### 2.1 O que está bloqueando agora (em ordem)

1. **Aplicar o banco no Supabase real.** Cole `apps/controle-obras/supabase/aplicar-todas.sql` no editor SQL e depois `primeiro-dono.sql` (troque o e-mail). Passo a passo em `docs/auditoria/criar-projeto-supabase.md`.
2. **Liberar a rede do ambiente do Claude Code** para o endereço do seu projeto (`uqhdugageaxeghbuapud.supabase.co`), nas configurações do ambiente. Sem isso, eu não consigo testar contra o projeto real. Os testes de segurança de verdade (login real, Storage real, Realtime real) dependem disso.
3. **Criar usuários de teste** (um por perfil) em Authentication → Users.
4. Sua resposta sobre os **índices do 7D** (guias e ajuda dentro do app).
5. A **lista de ajustes que você quer fazer** no app (você disse que tem outros pontos).

---

## 3. A ordem e as dependências (revisadas)

Ordem original: 4 → 5 → 6 → 7 → 8 → 9 → 10. **Na prática, o caminho mínimo que sobra é:**

**fechar a 6 (Supabase real) → 9 (auditoria) → 7D (treinamento) → 10 (piloto)**, deixando 8 (integrações) e o restante de 7A (e-mail) para depois do piloto, se preferir.

- **6 → 9:** a auditoria precisa do Supabase real; hoje ela só tem prova em teste local.
- **7D → 10:** o prompt do piloto exige o treinamento dado antes da semana 1.
- **9 é obrigatória** antes de qualquer uso real. O veredito hoje é **“não pode ir ao ar”**, por falta de teste no ambiente real, segunda leitura humana e restauração de backup testada.
- **8** pode ficar para depois do piloto, como previsto. O caminho manual (CSV, aceite por escrito, `wa.me`) já funciona.

---

## 4. Como trabalhar com cada prompt no Claude Code

1. Abra o Claude Code na pasta do projeto e cole o prompt da fase.
2. **Respeite as paradas** (desenho do Supabase, desenho do offline, pesquisas da fase 8, plano da auditoria, linha de base do piloto).
3. Peça o resumo de 5 linhas ao fim de cada passo e confira se os testes passaram.
4. O código manda: se o prompt citar um nome que não existe, o Claude Code registra a diferença.
5. **Nunca peça para pular testes.**
6. Guarde `DECISOES.md` e `CHANGELOG.md`: são a memória do projeto.
7. Para rodar tudo na sua máquina: `cd apps/controle-obras && npm install && npm test` (o teste do banco usa Postgres local: `npm run test:rls`).
8. **Se o Claude Code sair do combinado**, peça para reler a seção “Seu papel e regras de trabalho” do prompt.

**Ao colar um prompt novo**, avise se alguma fase anterior não estiver completa: o Claude Code deve dizer o que falta antes de começar (foi o que aconteceu com as fases 8, 9 e 10).

---

## 5. Decisões que só você toma

| Decisão | Quando | Estado |
| --- | --- | --- |
| Origem do orçamento de controle (Vobi, app do Base44, planilha) | Fase 8 (hoje: importação por CSV) | **Pendente** |
| Valor da alçada de compra e locação | Quanto antes | **Pendente** (o campo existe por obra, vazio) |
| O contrato de Administração inclui a frente técnica (Gestão)? | Quanto antes | **Pendente** |
| Mapeamento etapa → disciplina do P0 | Fase 5/10 | **Proposto**, aguardando sua confirmação (`DECISOES.md`, D-5.6.1) |
| Tratamento contábil do DRE e do repasse (**com o contador**) | Antes do piloto | **Pendente** (hoje: o repasse da Administração fica fora do resultado, provisório) |
| Quais despesas gerais entram no app | Antes do piloto | **Pendente** (hoje, categorias livres) |
| Matriz de permissões (perfis) | Fase 6 | **Aprovada por você de forma geral**; falta a **segunda leitura** por pessoa técnica (fase 9) |
| Hospedagem do app (Vercel, Cloudflare Pages…) e plano do Supabase | Antes do piloto | **Pendente** (o projeto de desenvolvimento já existe) |
| Quem confere os documentos mensais dos prestadores | Piloto | **Pendente** |
| Provedor de e-mail e domínio de envio | 7A | **Pendente** |
| Prazos de garantia por sistema (os da Cariati) | 7B | **Pendente** (a tabela nasce vazia; o app não inventa prazos) |
| Quais obras terão cliente no portal | 7B | **Pendente** (o portal já existe) |
| Provedor de assinatura e tipo por documento (**com advogado**) | Fase 8 | **Pendente** |
| WhatsApp: provedor, número, custo, consentimentos (**com advogado**) | Fase 8 | **Pendente** (hoje: mensagem pronta por link, sem custo) |
| Segunda leitura das permissões por pessoa técnica | Fase 9 | **Pendente** |
| Encarregado de dados (LGPD) | Fase 9 | **Pendente** |
| Obra piloto, participantes e critérios de sucesso | Fase 10 | **Pendente** |

**Já decidido por você:** sem IA; sem gravação de reunião; sem câmeras 360, sensores e BIM; linha de balanço e DRE mantidos; Supabase como base (não Base44); portal do cliente e pós-obra entram; o app é interno (sem versão multiempresa por enquanto).

### 5.1 Parâmetros provisórios (valores iniciais, editáveis; calibrar na fase 10)

| Parâmetro | Valor | Origem |
| --- | --- | --- |
| Meta de PPC | 80% | prompts |
| Dias para escalar à diretoria | 7 | prompts |
| Margem aceita sobre o orçado | 5% | prompts |
| Tolerância entre avanço e medição | 5 pontos | prompts |
| Faixas da curva ABC | 80% e 95% | prompts |
| Alerta de documentos do prestador | a partir do dia 10 | prompts |
| Alçada de compra | sem valor | **a definir por você** |
| **SLA dos chamados de garantia** (resposta/resolução, em dias): crítica 1/3, alta 3/10, média 7/30, baixa 15/60 | provisório | **criado por mim** (`DECISOES.md`, D-7.4.4) |
| **Cache offline sem sincronizar** | 14 dias | **criado por mim** |
| **Escala das notas de satisfação** (0 a 10 em todas) | provisório | **criado por mim** |
| **Pontos perdidos na reincidência por chamado de garantia coberto** | 2 | **criado por mim** |
| **Benchmark de R$/m²**: só obras encerradas da mesma tipologia | provisório | **criado por mim** |
| Horário silencioso dos avisos e resumos | 20h–7h; resumo 7h | prompts |

Os marcados **“criado por mim”** não vieram de você: revise e corrija.

---

## 6. Serviços e custos recorrentes

Os valores mudam: **confira nos sites oficiais** antes de decidir. As fases 8 e 9 mandam o Claude Code verificar e citar fonte e data.

| Serviço | Estado | Para quê |
| --- | --- | --- |
| Supabase | **Conta e projeto de desenvolvimento criados** | Banco, login, arquivos |
| GitHub | **Conta e repositório existem** | Código e pipeline de testes (`.github/workflows/controle-obras.yml`, ainda não rodou) |
| Hospedagem do aplicativo | Pendente | Publicar o site |
| Provedor de e-mail | Pendente (7A) | Avisos |
| Assinatura eletrônica | Pendente (fase 8, opcional) | Aditivos e contratos |
| WhatsApp Business | Pendente (fase 8, opcional) | Envio automático e consulta |
| Pessoas externas pontuais | Pendente (fase 9) | Segunda leitura de segurança, contador, advogado |

---

## 7. Regras que valem em todas as fases

1. **Valores em R$ nunca chegam a apoio técnico e encarregado**, por nenhum caminho. *(No banco, isso passou a valer na migração 0006 para o perfil campo; no caminho A da seção 1 isso NÃO vale.)*
2. **Quem lança uma medição não a aprova.** Compra só é paga depois do recebimento conferido.
3. **Segurança mora no banco**, não na tela.
4. **Nada é apagado de verdade**: guarda de 5 anos (exclusão lógica, só pela função do servidor; arquivos nunca são substituídos nem apagados pelo app).
5. **Nenhuma integração é obrigatória**: o caminho manual continua funcionando.
6. **Nada de segredos no repositório nem no navegador** (a chave que está em `config.js` é a pública; um teste reprova se aparecer a secreta).
7. **Toda trava explica o motivo** em português claro.
8. **Cada fase termina com testes verdes e commit.**
9. **Testes leem a tela (`#app` e `#dlg`)**, nunca `document.body`.
10. **Confirmar com você antes de gerar planilhas ou documentos de exemplo.**
11. **Nada que o app faça offline envolve valores, aprovação, liberação, pagamento, emissão ou encerramento.** Essas ações só valem com internet, e o botão explica o motivo.

---

## 8. Checklist de progresso

**Fase 4 — Custo, medição e financeiro**
- [x] Código separado em módulos e testes das fases 1–3 recriados
- [x] Orçamento por importação (CSV), versões e aditivos
- [x] Medição com as cinco travas
- [x] Contas a pagar, aportes e fluxo de caixa
- [x] Comprometido, apropriado e pago; físico-financeiro e curvas S
- [x] CPI, SPI e custo final previsto; alertas e agenda
- [x] Testes verdes e `DECISOES.md` atualizado

**Fase 5 — DRE, relatório e avaliação**
- [x] Navegação da obra reorganizada em grupos
- [x] Empresas e contrato do cliente
- [x] DRE por obra, por empresa e consolidado
- [x] Relatório mensal (congelado ao emitir, impressão, validação do cliente)
- [x] Avaliação de prestadores
- [x] Encerramento, lições aprendidas e ajuste do P0 (+ benchmark entre obras encerradas)
- [x] Documentação do modelo de dados e das regras atualizada
- [ ] **Você:** conferir a impressão A4 do relatório e os gráficos no celular

**Fase 6 — Supabase, login e perfis**
- [x] Desenho e matriz de permissões (aprovados por você de forma geral)
- [x] Esquema, regras no servidor e RLS com testes por perfil (migrações 0001 a 0008, em Postgres local)
- [x] App na nova camada de dados (versão por linha, conflito, exclusão pela função, Realtime), com Supabase simulado
- [x] Storage privado por obra e por zona; fotos por URL assinada
- [x] PWA
- [ ] **Aplicar o banco no projeto real e testar com login real**
- [ ] Tela “Usuários e acessos” e convites
- [ ] Migração dos dados antigos (ponte `registros` e banco da página) e publicação

**Fase 7 — Notificações, pós-obra, offline e guias**
- [x] Desenho dos quatro blocos confirmado
- [x] Notificações no banco e central de avisos no app; mensagem pronta ao prestador por WhatsApp (link)
- [ ] Envio por e-mail e agendador (dependem do provedor e do projeto real)
- [x] Garantias, chamados, visitas de 30/90/180 dias, satisfação, portal do cliente
- [ ] Prazos de garantia da Cariati (você fornece)
- [x] Desenho do offline confirmado e modo offline de campo
- [x] Perfil campo sem valores em R$ no banco
- [ ] **Guias por perfil, roteiros, ajuda no app, obra de demonstração, painel de adoção (7D)** — aguardando seus índices
- [ ] **Você:** testar o offline em celular real (avião; iPhone instalado × Safari)

**Fase 8 — Integrações (pode ficar para depois do piloto)**
- [ ] Pesquisas e decisões (orçamento, assinatura, calendário, WhatsApp)
- [ ] Orçamento automático
- [ ] Assinatura digital
- [ ] Calendário por link
- [ ] WhatsApp (envio e consulta)

**Fase 9 — Auditoria final (obrigatória)**
- [x] Inventário do banco e plano de auditoria
- [x] Achados A-01 a A-04 corrigidos e provados em teste local (privilégios, funções abertas, Storage)
- [x] Testes de segredos e pipeline do GitHub criados
- [ ] Auditoria de segurança com teste de cada perfil **contra o Supabase real**
- [ ] Privacidade e LGPD (documentos e perguntas ao advogado)
- [ ] Carga, usabilidade e roteiro em celulares reais
- [ ] Ensaio de restauração de backup
- [ ] Segunda leitura humana das permissões
- [ ] Relatório final com veredito

**Fase 10 — Piloto**
- [ ] Linha de base “antes” e critérios de sucesso aprovados
- [ ] Painel do piloto, triagem e conciliação prontos
- [ ] Semanas 1 a 8 cumpridas, com reunião semanal
- [ ] Calibrações das semanas 4 e 8
- [ ] Fechamento em paralelo conciliado
- [ ] Relatório final do piloto e decisão de ampliar

---

## 9. Riscos e achados que você deve conhecer

| Risco | Situação |
| --- | --- |
| **Tudo do Supabase só foi testado em simulação** | O comportamento real (login, Storage, API) pode diferir. É o primeiro item da fase 9 |
| **Privilégios padrão do Supabase podem permitir `TRUNCATE`** (a RLS não protege contra isso) | Corrigido na migração 0007 e provado em teste local; repetir no projeto real |
| **Fotos e documentos estavam em endereço público** | Corrigido na migração 0008 (bucket privado, pastas por obra, zona restrita para documentos com valores); repetir no projeto real |
| **Perfil campo via banco enxergava valores** | Corrigido na 0006 (lê por funções, sem valores). **Mudou o comportamento:** encarregado não cria nem edita compras e locações |
| **No caminho A (banco da página), não há perfis** | Quem grava vê tudo, inclusive valores |
| **Sem criptografia do banco do aparelho (offline)** | Risco aceito: exige bloqueio de tela e permite revogar a sessão |
| **iPhone:** o Safari pode apagar dados guardados de sites sem uso por 7 dias | Instalar o app na tela inicial reduz o risco; a fonte é de 2020, **não confirmado nas versões atuais**, precisa de teste real |
| **Pipeline do GitHub nunca rodou** | Pode precisar de ajuste na primeira execução |
| **Dependência de biblioteca externa por CDN, sem verificação de integridade** | Recomendação: hospedar junto com o app ou usar integridade; registrado na auditoria |
| **Sem funções de borda, convite de usuário e autenticação em dois fatores** | Previstos, ainda não construídos (fases 6, 7 e 9) |

---

## 10. Depois do piloto

Decida só com os números na mão. Ordem de bom senso: ampliar para mais obras em ondas; fazer a fase 8 (começando pelo orçamento); atacar o backlog do piloto; e só então avaliar oferecer o sistema a outros escritórios (decisão de negócio, que pede análise de lacunas própria).

---

## 11. Quando voltar a esta conversa

Traga a qualquer momento: o **resumo final de cada fase** (para ajustar o prompt seguinte ao que foi realmente construído), **dúvidas de decisão** (alçada, mapeamento etapa → disciplina, perfis, parâmetros), **textos para clientes, prestadores e equipe**, **material de treinamento** e **os números do piloto**.
