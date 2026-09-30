# Carregamento e tempo real — PARA CONFIRMAÇÃO

- Hoje o app carrega **todas** as coleções na abertura. Proposta: carregar por obra aberta (`obra_id`) + coleções globais (obras, prestadores, fornecedores, empresas).
- `orcItens` (lotes de 150 itens) só ao abrir a aba Orçamento; `relatorios` e `lancamentos` por período.
- Realtime do Supabase por tabela e por `obra_id`; conflito resolvido por `versao` (otimista: se a versão mudou, avisa e recarrega).
- Modo offline: manter o modo local atual como reserva somente-leitura; fila de escrita offline fica **fora** do escopo inicial (registrar como limitação).
- Paginação em listas grandes (diário, movimentos de estoque, lançamentos).
