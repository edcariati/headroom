# Financeiro interno

Sistema financeiro interno de um escritório de arquitetura e gestão de obras: receitas, despesas, parcelas, contas, transferências, fluxo de caixa, DRE e resultados. Não inclui controle de obra nem projetos de clientes.

## Como funciona

Interface em estilo "Vidro & Luz" (escuro por padrão, com modo claro, PWA e busca global Ctrl+K). Veja `docs/DESIGN-SYSTEM.md`.

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

## Clientes, códigos e serviços contratados

- **Clientes** (menu Financeiro): cadastro com código (`CLI-0001`, automático e editável), CPF/CNPJ, contato, cidade, endereço e observações.
- **Projetos**: código no padrão `CA` + ano + mês + número (ex.: `CA261001`), nome, área em m² (opcional) e os **serviços contratados** com valor; o valor do projeto é a soma dos serviços.
- **Serviços** (Cadastros → Serviços): catálogo de serviços do escritório, cada um ligado a uma categoria de receita.
- "Novo cliente" faz tudo em 3 etapas (dados → projeto e serviços → cobrança opcional, que já gera as parcelas a receber).

## Documentos, recibos e notas fiscais

- **Categorias com subcategorias** (Cadastros → Categorias): "Automóvel" com Combustível, Estacionamento, Pedágios, Mecânico e Higienização já vem pronta. A subcategoria herda o tipo e o grupo da DRE da categoria principal e aparece como "Automóvel › Combustível" nos relatórios.
- **Anexos**: comprovantes, notas fiscais e outros arquivos (PDF, imagem ou XML, até 3 MB) ficam no armazenamento privado do aplicativo (`arquivos/`). XML de nota fiscal tem número, valor e data lidos automaticamente.
- **Recibo**: ao registrar um recebimento, marque "Emitir recibo". Número sequencial `REC-0001`, valor por extenso e impressão/PDF.
- **Notas fiscais**: o cliente pediu NF? O lançamento entra na fila "A emitir", com os dados prontos para copiar. Depois registre o número e anexe o arquivo. A emissão automática depende de ligar um emissor (prefeitura ou provedor).
- **Busca em tudo** (Ctrl+K): clientes, projetos, lançamentos, arquivos anexados, recibos e notas.
- **Rascunho automático**: o que foi digitado em qualquer formulário fica guardado no navegador. Clicar fora não fecha a janela, e ao reabrir o formulário continua de onde parou.

## Parcelas com data e valor editáveis

- No lançamento (receita ou despesa) e nos serviços do projeto há a opção **Personalizar a data e o valor de cada parcela**. Cada parcela fica com a sua data e o seu valor (entrada em outra data, última parcela com variação).
- **Aplicar entrada** define o valor e a data da entrada e divide o restante nas demais parcelas.
- A soma das parcelas precisa fechar com o total: o aplicativo mostra a diferença e oferece "Jogar a diferença na última parcela".
- Alterar o valor, o número de parcelas ou o primeiro vencimento refaz o cronograma igualmente; ajuste por parcela depois disso.
- O servidor confere datas, valores positivos e a soma antes de criar as parcelas. O cronograma de cada serviço (até 24 parcelas) fica guardado no projeto e entra no rascunho automático.
