# Modo offline para obra sem sinal — desenho (PARADA para confirmação do Edson)

Nada disto está implementado. Depois da sua confirmação eu codo (passo 7 da Fase 7). Pesquisas consultadas em **01/10/2026**.

## 1. O que existe hoje (ponto de partida)
- O app é um arquivo único (`index.html`) sobre Supabase (esquema `v2`: uma tabela por coleção, `versao` por linha, exclusão lógica).
- **Não há manifest nem service worker** (o prompt supunha “PWA sem offline”; na prática não existe PWA ainda). O primeiro passo do offline é criá-lo.
- Fotos já são redimensionadas no aparelho (lado máximo reduzido, JPEG 0,8) antes de subir (`core.js`).
- O conflito de edição já é detectado (versão da linha) e **nunca sobrescreve em silêncio**.

## 2. O que a pesquisa mostrou (fontes e data: 01/10/2026)
| Tema | Achado | Consequência no desenho |
|---|---|---|
| **iPhone/Safari: limpeza de dados** | Safari apaga o armazenamento gravável por script (IndexedDB, localStorage, cache do service worker) de sites **sem interação por 7 dias**; **apps adicionados à tela inicial têm contagem própria e não sofrem essa regra do mesmo modo** ([Search Engine Land](https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519), [Didomi](https://docs.didomi.io/moIvfcA7NSpjmwGZ7dzv/releases-and-announcements/announcements/apple-implements-7-day-cap-on-script-writable-storage)) | **No iPhone o app tem de ser instalado na tela inicial.** O app avisa quando não estiver instalado. *Fonte de 2020: não confirmei o comportamento das versões mais recentes do iOS — marcado “não confirmado”; testar num iPhone real.* |
| **Sincronização em segundo plano** | A API *Background Sync* funciona em Chrome/Edge e **não existe** em Safari/iOS nem Firefox ([caniuse](https://caniuse.com/background-sync), [MDN espelho](https://www-igm.univ-mlv.fr/~forax/MDN/developer.mozilla.org/en-US/docs/Web/API/SyncManager.html)) | **Não dependemos dela.** Sincroniza com o app aberto (seção 5). |
| **Cota e despejo** | Por padrão o armazenamento é “melhor esforço” (pode ser apagado com pouco espaço); pode-se pedir armazenamento **persistente** com `navigator.storage.persist()`, que o navegador pode negar; `navigator.storage.estimate()` informa uso e cota ([MDN](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)) | O app **pede persistência**, mede o espaço antes de guardar fotos e avisa quando faltar. |

## 3. Escopo (para você confirmar)
**Leitura offline** (da obra aberta ou pré-carregada, sempre com “última sincronização: dd/mm hh:mm”): obra, etapas, cronograma da semana, pacotes, fichas, ocorrências abertas, diário recente, prestadores ativos, locações ativas, compras com entrega pendente e estoque (só quantidades).

**Escrita offline (fila), somente estas operações:**
| Operação | Tipo na fila | Conflito |
|---|---|---|
| Registrar diário e efetivo | criar | não conflita (novo registro) |
| Fotos | upload à parte, ligado ao registro | não conflita |
| Inspeção de ficha de verificação | editar (id fixo `obra_etapa_item`) | **pode conflitar** (duas pessoas na mesma ficha) |
| Abrir ocorrência | criar | não conflita |
| Registrar contato (ocorrência/ação) | **acrescentar** item em lista | não conflita |
| Marcar pacote da semana | editar | pode conflitar |
| Apontamento e checklist de locação | acrescentar / editar | acrescentar não conflita |
| Registrar entrega e conferência de recebimento | editar compra + criar movimento de estoque | pode conflitar |
| Saída de estoque | criar movimento | não conflita |

**Nunca offline** (o botão fica visível e explica: *“Esta ação precisa de internet porque …”*): liberar etapa, aprovar qualquer coisa, pagar, emitir relatório, encerrar obra, tudo com valor em R$, aceitar chamado, administrar usuários.

## 4. Arquitetura
1. **Service worker** guarda o app (HTML único) para abrir sem internet depois do primeiro acesso. Versão no nome do cache; quando há versão nova, o app **avisa** (“Há uma versão nova. Atualizar”) e só troca ao confirmar (nunca no meio de um registro).
2. **IndexedDB, um banco por usuário** (`cob-<hash do id do usuário>`), com: `cache` (cópia de leitura por coleção/obra, com carimbo de sincronização), `fila` (operações), `fotos` (arquivos pequenos), `meta`. Outro usuário no mesmo aparelho **não** enxerga nem envia a fila alheia.
3. **Operação da fila**: `{ opId (UUID), tipo, coleção, id (UUID gerado no aparelho), versaoBase, dados, criadoEm, estado, tentativas, erro }`. `estado`: `pendente → enviando → enviado | erro | conflito`.
4. **Idempotência (reenvio sem duplicar):** criação carrega `_opId` no registro; se o servidor responder “já existe” e o registro tem o mesmo `_opId`, conta como enviado. Para **acrescentar** (contatos, apontamentos) crio a função de servidor `anexar_item(tabela, id, campo, item)`: atômica, ignora item com `opId` repetido e não depende de versão.
5. **Ordem:** a fila é processada em ordem de criação; um registro que referencia foto só é enviado depois do upload da foto.

## 5. Quando sincroniza
Ao abrir o app; ao voltar a internet (evento do navegador, confirmado por um teste real de conexão); a cada 30 s com o app aberto e online; e pelo botão “Sincronizar agora”. **Sem sincronização em segundo plano.** O texto avisa: *“Abra o aplicativo ao chegar onde há sinal para enviar.”*

## 6. Conflitos (nada sobrescreve em silêncio)
- Só-acrescentar: sem conflito.
- Editar registro existente: a operação guarda a `versao` em que se baseou. Se o servidor já mudou: **as duas versões ficam guardadas**, o item vai para “Pendências de sincronização” com a diferença em português (“Você marcou *aprovado*; Ana marcou *reprovado* às 14:10”) e três botões: **Manter a minha**, **Manter a do servidor**, **Decidir depois**. Nada é descartado sem escolha.
- Registro excluído no servidor: a operação vira “conflito: registro removido”, com opção de recriar ou descartar.
- Erro de permissão do servidor: fica “erro” com a explicação e **não** tenta de novo sozinho (evita martelar).

## 7. Fotos
Redimensionadas no aparelho (como hoje) antes de entrar na fila; caminho no Storage definido na hora (`usuario/ano-mes/opId.jpg`) e envio com *upsert* (retomar sem duplicar); contador “N fotos pendentes”; antes de guardar, o app confere o espaço livre (`estimate`) e **recusa com explicação** se faltar. Foto pendente aparece com selo “aguardando envio”.

## 8. O que a tela mostra (sempre)
Faixa fixa: **Online/Offline**, “N alterações pendentes”, “última sincronização”. Cada item: *guardado no aparelho (pendente)* → *enviado* → *erro/conflito*. **Nunca “Salvo” antes da confirmação do servidor**; offline o texto é “Guardado no aparelho, aguardando envio”.

## 9. Segurança
- **O cache só tem o que o perfil pode ver e nunca valores em R$.** No campo, os campos monetários são removidos antes de guardar (lista de campos por coleção).
- **Descoberta importante (precisa de decisão sua, ver 11-A):** a regra atual do banco libera `compras`, `locações` e `contratos de prestador` ao perfil `campo` **com todos os campos do registro**, e isso inclui valores em R$. A promessa “encarregado e apoio técnico nunca veem valores” **não está garantida no banco hoje**: o app apenas não mostra. Isso vale com ou sem offline, mas o offline copia esses dados para o aparelho. Proposta: criar *views* sem valores para o perfil campo (como já fiz com o custo de reparo) e retirar o acesso direto dele às tabelas; é uma migração (0006) com testes.
- **Logout:** apaga o cache de leitura. Se houver alterações **não enviadas**, o app pergunta: *“Há N alterações que ainda não foram enviadas. Sair agora as apaga.”* (Sair e apagar / Voltar). Com internet, oferece enviar antes.
- **Sessão expirada offline:** a fila é **mantida**; ao voltar a internet pede novo login e envia. O cache de leitura continua legível por até **14 dias sem sincronizar** (valor provisório) e depois exige entrar de novo.
- **Sessão revogada pela diretoria:** no primeiro contato com o servidor, o cache é apagado; a fila **não** é enviada sob outra identidade (fica isolada no banco do usuário original).
- **Aparelho perdido:** a recomendação é bloqueio de tela; a diretoria revoga a sessão e o cache some assim que o aparelho tocar a rede. **Não há criptografia do banco no aparelho**: a chave teria de ficar guardada no próprio aparelho, sem ganho real; a proteção é o bloqueio do celular. Risco aceito e registrado.
- Texto vindo do servidor continua escapado na tela; a fila nunca executa conteúdo.

## 10. Plano de construção e de testes
Sub-passos (um commit cada): (a) manifest + service worker + aviso de versão nova; (b) cache de leitura e faixa de estado; (c) fila, idempotência e sincronização; (d) fotos; (e) tela de pendências e conflitos; (f) logout/sessão/limpeza; (g) bloqueio explicado das ações online.
**Testes automáticos** (Node + jsdom + `fake-indexeddb`, versão fixada): persistência da fila ao “fechar e reabrir”; ordem; reenvio sem duplicar (servidor falso que repete respostas); conflito de edição guarda as duas versões; logout limpa; sessão expirada mantém a fila; troca de usuário isola; fotos pendentes e retomada; ação proibida explica; cache sem campos de valor.
**Só dá para validar em celular real** (e vou listar no resumo): teste de avião de verdade, o comportamento do iPhone (instalado × não instalado), pedido de armazenamento persistente, atualização do service worker, câmera e fotos grandes.

## 11. Decisões que preciso de você
**A. Valores para o perfil campo (recomendo corrigir já, antes do offline):** posso fazer a migração 0006 com *views* sem valores para `campo`? (Sim/Não)
**B. Escopo da lista da seção 3** está certo? Falta ou sobra algo?
**C. Validade do cache sem sincronizar: 14 dias** — ok?
**D. Quem usa em campo e com qual aparelho?** (iPhone exige instalar na tela inicial; Android/Chrome é mais simples.)
**E. Aceita o risco de o banco no aparelho não ser criptografado**, com bloqueio de tela obrigatório e revogação pela diretoria?
**F. Pergunta antes de sair com fila pendente** (sair e apagar × voltar): ok?
