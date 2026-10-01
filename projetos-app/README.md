# Projetos Cariati

Aplicativo do Setor de Projetos: acompanha cada cliente pelo fluxo oficial (24 etapas + pausa/retomada)
e controla os protocolos (Prefeitura, condomínio e outros órgãos). Funciona no computador e no celular
(instalável na tela inicial) e guarda tudo no Supabase.

## Como colocar para rodar

1. Crie um projeto em <https://supabase.com>.
2. No **SQL Editor**, rode na ordem os 4 arquivos de `supabase/migrations/` (`0001` a `0004`)
   (ou use `supabase db push` com a CLI).
3. Em **Authentication → Providers → Email**, desative "Allow new users to sign up" e crie os usuários da
   equipe em **Authentication → Users**. Para tornar alguém admin:
   `update profiles set papel = 'admin' where id = '<uuid>';`
4. `cp .env.example .env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Settings → API).
5. `npm install && npm run dev`. Para publicar: `npm run build` (pasta `dist`, ex.: Vercel).

## O que já existe

- **Painel**: projetos por fase, protocolos com exigência ou prazo em até 3 dias, pausas perto dos 180 dias.
- **Projetos**: cadastro com escopo (legal, interiores, complementares). As etapas são criadas conforme o
  escopo; as não contratadas ficam ocultas.
- **Fluxo por etapa**: entra/sai/regra, concluir (avança para a próxima aplicável), reabrir, rodadas de ajuste
  (limite de 3, alerta de custo adicional), aceites formais, pausa, retomada e rescisão (180 dias).
- **Protocolos**: tipo, órgão, número, status, data, próximo prazo, cliente notificado e andamentos.
- **Documentos por etapa**: modelos exigidos em cada etapa, com código de arquivo padronizado (`CAXXXXXX` vira o código do cliente) e anexo no Supabase Storage (bucket privado `documentos`).
- **Histórico** rastreável por projeto.

## Estrutura de dados (Supabase)

`profiles`, `clientes`, `etapa_modelos` (o fluxo, editável sem mexer no código), `projetos`, `projeto_etapas`,
`historico`, `protocolos`, `protocolo_andamentos`, `documento_modelos`, `projeto_documentos`. Todas com RLS: só usuários logados acessam; excluir é só
para admin. Novos módulos entram como novas migrations em `supabase/migrations/`.

## Próximos passos sugeridos

Notificações de prazo, permissões por setor e integração com o WhatsApp.
permissões por setor e integração com o WhatsApp.
