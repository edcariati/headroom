# Degustação — Escritório Petiscos & Cia

Site público para avaliar os 20 lanches pelo celular (sem login) + painel de resultados com senha.

- **Avaliadores:** `https://SEU-SITE.vercel.app/`
- **Painel do dono:** `https://SEU-SITE.vercel.app/painel`

Tecnologia: site estático (HTML/CSS/JS) hospedado grátis na **Vercel** + banco de dados Postgres grátis no **Supabase**.

```
escritorio-petiscos/
├── supabase/schema.sql   ← banco de dados (tabelas + regras de segurança)
├── public/               ← o site
│   ├── index.html        ← tela do avaliador
│   ├── painel.html       ← painel do dono
│   ├── config.js         ← ⚠️ preencher com os dados do Supabase
│   ├── poster.jpg        ← ⚠️ adicionar: pôster do hambúrguer (fundo do site)
│   └── poster-escuro.jpg ← ⚠️ adicionar: pôster escuro (fundo do painel)
└── vercel.json
```

## Passo a passo (uns 15 minutos)

### 1. Banco de dados (Supabase)
1. Crie uma conta grátis em <https://supabase.com> e clique em **New project** (região: *South America (São Paulo)*).
2. Abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Na mesma tela, rode (trocando pela sua senha) para definir a senha do painel:
   ```sql
   select definir_senha_admin('uma-senha-forte-aqui');
   ```
   Para trocar a senha depois, é só rodar o comando de novo.
4. Vá em **Project Settings → API** e copie:
   - **Project URL** (ex.: `https://abcd1234.supabase.co`)
   - a chave **anon public** (ou **publishable**).

### 2. Configurar o site
1. Em `public/config.js`, cole a URL e a chave nos lugares indicados.
2. Salve as imagens da marca em `public/`:
   - `poster.jpg` → pôster "Feito pra matar a fome" (fundo da tela dos avaliadores)
   - `poster-escuro.jpg` → pôster escuro com o logo (fundo do painel)
   Se faltar alguma imagem, o site continua funcionando com o fundo marrom.

### 3. Publicar (Vercel)
1. Crie uma conta grátis em <https://vercel.com> entrando com o GitHub.
2. **Add New → Project →** escolha este repositório.
3. Em **Root Directory**, selecione `escritorio-petiscos`. Framework: **Other**. Clique em **Deploy**.
4. Pronto: a Vercel mostra o link (ex.: `https://escritorio-petiscos.vercel.app`). Em **Settings → Domains** dá para trocar o nome.

### 4. Enviar o link
Abra `/painel`, entre com a senha e vá na aba **Link para enviar**: tem botão de copiar e de enviar direto no WhatsApp.

## Como funciona

**Avaliador:** digita nome (obrigatório) e idade → vê os 20 lanches numerados com barra de progresso → toca no lanche, preenche a ficha e salva → o lanche fica marcado com ✓ e a nota. Pode tocar de novo para corrigir. Se fechar o navegador e voltar no mesmo celular, continua de onde parou.

**Ficha:** 13 notas de 0 a 10 (todas obrigatórias), tempo de espera, como chegou (quente/morno/frio), percepção de tamanho, quanto pagaria (obrigatório) e comentários (opcionais). **Nota final = média das 13 notas**, calculada no banco.

**Painel (senha):**
- **Resumo:** total de avaliações, avaliadores, média geral e preço médio; ranking dos 20 lanches (clique numa barra para ver o detalhe); pizzas de temperatura, tempo de espera e tamanho.
- **Por lanche:** média de cada critério, preço médio e faixa de preço, pizzas do lanche e comentários.
- **Avaliadores:** lista com idade, quantos avaliou e média dada; excluir (para apagar testes); exportar **Excel (.xlsx)** com 3 abas (Resumo por lanche, Avaliações, Avaliadores) ou **CSV** (abre direto no Excel em português).
- **Renomear lanches:** troca os nomes que aparecem abaixo de cada número.

## Segurança
- Ninguém lê ou altera as tabelas diretamente: o site só chama funções do banco (`supabase/schema.sql`).
- Cada avaliador recebe um código secreto guardado no próprio celular; só ele consegue corrigir as próprias notas.
- Os dados do painel só saem do banco com a senha correta (guardada criptografada; cada tentativa errada demora 1 segundo).
- A chave "anon/publishable" do `config.js` é pública por natureza — não coloque ali a chave `service_role`/`secret`.

## Testes antes de divulgar
Faça uma avaliação de teste pelo celular, confira no painel e depois apague o avaliador de teste na aba **Avaliadores**.
