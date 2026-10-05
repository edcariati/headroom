# Financeiro interno

Sistema financeiro interno de um escritório de arquitetura e gestão de obras: receitas, despesas, parcelas, contas, transferências, fluxo de caixa, DRE e resultados. Não inclui controle de obra nem projetos de clientes.

## Como funciona

- `public/` — telas (HTML, CSS e JavaScript simples, sem build).
- `api/app.js` — única função da Vercel; recebe tudo em `/api/app?rota=...`.
- `api/_lib/` — regras financeiras, acesso aos dados, senha e rotas.
- Dados: **Vercel Blob privado**, um arquivo JSON por registro (`dados/<coleção>/<id>.json`). Nada de dados vai para o Git.
- Acesso: senha única do dono, guardada na variável `ADMIN_SENHA` (tipo sensível) e conferida sempre no servidor. Sem a variável, a produção fica bloqueada.

## Rodar no computador

Precisa do Node 22.

```bash
npm install
npm run demo     # dados fictícios em http://localhost:3000 (pasta .dados-demo)
npm run dev      # dados reais de teste, pasta .dados-dev (cria só o plano de contas)
npm test         # testes das regras, da API e do armazenamento
```

Para testar o login localmente: `ADMIN_SENHA=qualquer-coisa npm run demo`.

## Variáveis de ambiente (Vercel)

| Variável | Para quê |
|---|---|
| `ADMIN_SENHA` | senha de acesso (sensível) |
| `BLOB_READ_WRITE_TOKEN` | criada pela Vercel ao conectar o Blob privado ao projeto |

## Regras de cálculo

- Valores em centavos (inteiros). Parcelas dividem o total sem perder centavos.
- **Status da parcela:** pago, vencido, vence hoje ou a vencer. Pagamento parcial mantém a parcela em aberto só pelo que falta; cada pagamento guarda data e conta.
- **Em aberto** = a vencer + vence hoje (os vencidos aparecem à parte).
- **Resultado / balanço** = recebido − pago.
- **Saldo da conta** = saldo inicial + recebimentos − pagamentos ± transferências.
- **Fluxo de caixa:** previsto por vencimento, realizado por data de pagamento. O saldo final de um mês é o inicial do seguinte.
- **DRE:** cada categoria pertence a um grupo (receita bruta, deduções, custos, despesas operacionais, financeiras, não operacionais). Margens = resultado ÷ receita operacional bruta. Lançamento parcelado fica na competência informada; recorrente acompanha o mês de cada parcela.

## Ainda não existe

- Login por usuário e permissões (hoje, uma senha única).
- Boleto/Pix integrado, notas fiscais, importação de XML.
- Leitura de comprovantes por IA e conciliação bancária por Open Finance.
- Importação de planilha do Vobi.
