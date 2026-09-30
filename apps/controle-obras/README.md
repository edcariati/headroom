# Controle de Obras Cariati

Aplicativo de gestão de obras em uma página só (HTML + CSS + JavaScript, sem build):
protocolo de 22 etapas em 6 fases com fichas de verificação, cronograma (Gantt),
quadro de etapas, semana e PPC, diário com fotos, ocorrências, compras, estoque,
locações, agenda, prestadores e fornecedores.

Migrado do Artifact original: https://claude.ai/artifact/HqsvWKt2KdZHuHJAcPJkwx

## Onde os dados ficam

| Modo | Quando | Dados | Histórico | Fotos |
|---|---|---|---|---|
| **Nuvem (Supabase)** | URL e chave configuradas | compartilhados com a equipe, em tempo real | sim, com quem/quando e botão de restaurar | bucket `obras-arquivos` |
| Local | sem configuração | só neste navegador | não | não |
| Claude (Artifact) | aberto dentro do Claude | banco do Artifact | não | assets do Artifact |

## Ligar a nuvem (Supabase), passo a passo

1. Crie um projeto grátis em https://supabase.com (região São Paulo).
2. Abra **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique **Run**.
   Isso cria as tabelas, o histórico automático, a segurança (só quem tem login acessa),
   o tempo real e o armazenamento de fotos. Pode rodar de novo sem perder dados.
3. Em **Authentication → Sign In / Providers**, desligue *Allow new users to sign up*
   (assim só entra quem você cadastrar).
4. Em **Authentication → Users → Add user**, cadastre e-mail e senha de cada pessoa da equipe.
5. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / publishable**.
6. No aplicativo, abra **Nuvem**, cole os dois valores e clique **Salvar e conectar**.
   Para todo mundo já abrir conectado, preencha `config.js` com esses mesmos valores.

Nunca use a chave `service_role` / `secret` no aplicativo — o app recusa essa chave.

## Levar dados antigos para a nuvem

Na tela **Nuvem**, depois de entrar:
- **Enviar para a nuvem** — manda o que estava salvo em modo local neste navegador.
- **Importar arquivo** — manda um `.json` gerado pelo botão **Exportar** (daqui ou do Artifact).

## Rodar no computador

```sh
cd apps/controle-obras
python3 -m http.server 8000
# abra http://localhost:8000
```

## Estrutura

- `index.html` — o aplicativo inteiro.
- `config.js` — conexão padrão com o Supabase (opcional).
- `supabase/schema.sql` — banco, histórico, segurança e armazenamento.

Observação: as fotos ficam num bucket público com nomes aleatórios (quem não tem o link
não encontra o arquivo). Se precisar de fotos 100% privadas, dá para trocar por links assinados.
