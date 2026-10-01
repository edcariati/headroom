# Criar o projeto `cariati-obras-dev` no Supabase (passo a passo, ~15 minutos)

Eu **não consigo** criar o projeto: não tenho acesso à sua conta do Supabase e não devo receber a sua senha. Quem cria é você; o resto está pronto.

## 1. Criar o projeto
1. Entre em https://supabase.com/dashboard e clique **New project**.
2. **Name:** `cariati-obras-dev` · **Region:** `South America (São Paulo)` · **Database password:** gere uma forte e **guarde no seu gerenciador de senhas** (não me envie e não escreva em arquivo do repositório).
3. Aguarde terminar de criar.

## 2. Configurar a segurança de acesso (Authentication)
Em **Authentication → Sign In / Providers**: **desligue** “Allow new users to sign up” (o cadastro é só por convite da diretoria) e deixe **Confirm email** ligado. Em **Authentication → Users → Add user**, crie o seu usuário (e-mail e senha).

## 3. Criar as tabelas e regras (uma vez)
1. Abra **SQL Editor → New query**.
2. Cole **todo** o conteúdo de `apps/controle-obras/supabase/aplicar-todas.sql` e clique **Run**. Deve terminar sem erro.
3. Cole `apps/controle-obras/supabase/primeiro-dono.sql`, **troque o e-mail** pelo seu e clique **Run**. Você vira a diretoria (`dono`).
4. (Opcional agora) Para o motor de avisos: em **Database → Extensions**, ative `pg_cron` e rode os comandos comentados no fim das migrações 0003 e 0004.

## 4. O que me passar (pode colar aqui no chat)
Em **Project Settings → API**:
- **Project URL** (algo como `https://xxxx.supabase.co`)
- **Project API keys → `anon` `public`** (é a chave pública, feita para ir no aplicativo)

⚠️ **NUNCA** me envie a `service_role` nem a senha do banco. Se enviar sem querer, troque a chave em **Project Settings → API**.

## 5. O que eu faço quando você me passar a URL e a chave `anon`
Ligo o aplicativo ao projeto (`config.js`), rodo a suíte de segurança **contra o projeto real**, com um usuário de teste de cada perfil, via API (Auth, Storage e RLS reais) e atualizo o relatório de auditoria.
