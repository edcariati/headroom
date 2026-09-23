# Degustação — Escritório Petiscos & Cia

Site público para avaliar os 20 lanches pelo celular (sem login) + painel de resultados com senha.

- **Avaliadores:** https://escritorio-petiscos.vercel.app
- **Painel do dono:** https://escritorio-petiscos.vercel.app/painel

Tudo roda grátis na **Vercel**: o site é estático (HTML/CSS/JS), a API é uma Vercel Function
(`api/rpc.js`) e os dados ficam num **Vercel Blob privado** (região São Paulo).

```
escritorio-petiscos/
├── api/rpc.js        ← API (cadastro, avaliações, painel) — grava no Vercel Blob
├── public/           ← o site
│   ├── index.html    ← tela do avaliador
│   ├── painel.html   ← painel do dono
│   ├── poster.jpg / poster-escuro.jpg ← pôsteres da marca
├── package.json      ← dependência @vercel/blob
└── vercel.json
```

## Configuração na Vercel (já feita)
- Projeto `escritorio-petiscos`, com o Blob store `escritorio-petiscos-dados` conectado
  (variável `BLOB_READ_WRITE_TOKEN`, criada automaticamente).
- Variável `ADMIN_SENHA` = senha do painel. Para trocar: Vercel → projeto → Settings →
  Environment Variables → `ADMIN_SENHA` → editar, e depois fazer um Redeploy.

## Como funciona
**Avaliador:** digita nome (obrigatório) e idade → vê os 20 lanches numerados com barra de progresso →
toca no lanche, preenche a ficha e salva → o lanche fica marcado com ✓ e a nota. Pode tocar de novo para
corrigir. Se fechar e voltar no mesmo celular, continua de onde parou.

**Ficha:** 13 notas de 0 a 10 (obrigatórias), tempo de espera, como chegou, percepção de tamanho, quanto
pagaria (obrigatório) e comentários (opcionais). **Nota final = média das 13 notas**, calculada no servidor.

**Painel (senha):** resumo com totais e média geral, ranking dos 20 lanches, pizzas (temperatura, espera,
tamanho) no geral e por lanche, média por critério, preço médio, comentários, lista de avaliadores
(com exclusão de testes), exportação Excel (.xlsx, 3 abas) e CSV, renomear lanches e link para WhatsApp.

## Segurança
- Os dados ficam num Blob **privado**: só a API consegue ler e gravar.
- Cada avaliador recebe um código secreto guardado no próprio celular; só ele altera as próprias notas.
- O painel só entrega dados com a senha certa (cada tentativa errada demora 1 segundo).

## Testes antes de divulgar
Faça uma avaliação de teste pelo celular, confira no painel e depois exclua o avaliador de teste na aba
**Avaliadores**.
