# Controle de Obras Cariati

Aplicativo de página única (HTML + CSS + JavaScript, sem build) para acompanhar obras:
protocolo de 22 etapas com fichas de verificação, cronograma (Gantt), quadro de tarefas,
diário de obra com fotos, agenda, prestadores, fornecedores e exportação.

Migrado do Artifact original em https://claude.ai/artifact/HqsvWKt2KdZHuHJAcPJkwx.

## Como rodar

Abra `index.html` no navegador, ou sirva a pasta:

```sh
cd apps/controle-obras
python3 -m http.server 8000
# http://localhost:8000
```

## Armazenamento de dados

- **Dentro do Claude (Artifact):** usa o banco compartilhado (`window.claude.use('db')`),
  arquivos (`assets`), usuário e downloads.
- **Fora do Claude (este repositório):** entra em *modo local* automaticamente e salva
  os dados no `localStorage` do navegador (chaves `cob.*`). Os dados ficam só naquele
  navegador e não são compartilhados com a equipe.

Para uso em equipe fora do Claude, o próximo passo é trocar o objeto `Store` por um
backend (ex.: Supabase/Firebase) mantendo a mesma interface (`set`, `patch`, `add`, `del`).
