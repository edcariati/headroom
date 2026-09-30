# Migração de dados — PARA CONFIRMAÇÃO

1. Todo o trabalho no projeto **`cariati-obras-dev`**. Produção só no passo 8, com confirmação do Edson.
2. A tabela ponte `registros` (jsonb) atual é lida e cada documento é gravado na tabela nova por script de migração **idempotente** (upsert por `id`), com relatório de contagens por coleção antes × depois.
3. Validação: totais financeiros (orçamento, contas, DRE) iguais antes e depois; relatório de divergências.
4. Sem apagar a tabela `registros` até o Edson aprovar; backup antes de qualquer passo em produção.
5. Fotos/PDFs: copiar do armazenamento atual para o bucket `anexos`, atualizando os caminhos.
6. Ensaio geral no dev com cópia dos dados reais anonimizados, se o Edson preferir.
