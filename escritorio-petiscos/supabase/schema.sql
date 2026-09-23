-- =====================================================================
-- Escritório Petiscos & Cia — Degustação
-- Cole este arquivo inteiro no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo sem perder dados (é idempotente).
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- Tabelas ----------
create table if not exists public.lanches (
  id    int primary key check (id between 1 and 20),
  nome  text not null
);

insert into public.lanches (id, nome)
select n, 'Lanche ' || n from generate_series(1, 20) n
on conflict (id) do nothing;

create table if not exists public.avaliadores (
  id         uuid primary key default gen_random_uuid(),
  token      uuid not null unique default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) between 1 and 80),
  idade      int check (idade between 1 and 120),
  criado_em  timestamptz not null default now()
);

create table if not exists public.avaliacoes (
  avaliador_id       uuid not null references public.avaliadores(id) on delete cascade,
  lanche_id          int  not null references public.lanches(id),
  espera             text not null check (espera in ('ate10','10a20','mais20')),
  chegou             text not null check (chegou in ('quente','morno','frio')),
  tamanho_percepcao  text not null check (tamanho_percepcao in ('pequeno','na_medida','grande')),
  nota_espera        smallint not null check (nota_espera between 0 and 10),
  nota_temperatura   smallint not null check (nota_temperatura between 0 and 10),
  nota_aparencia     smallint not null check (nota_aparencia between 0 and 10),
  nota_montagem      smallint not null check (nota_montagem between 0 and 10),
  nota_sabor         smallint not null check (nota_sabor between 0 and 10),
  nota_carne         smallint not null check (nota_carne between 0 and 10),
  nota_pao           smallint not null check (nota_pao between 0 and 10),
  nota_molho         smallint not null check (nota_molho between 0 and 10),
  nota_ingredientes  smallint not null check (nota_ingredientes between 0 and 10),
  nota_tamanho       smallint not null check (nota_tamanho between 0 and 10),
  nota_facilidade    smallint not null check (nota_facilidade between 0 and 10),
  nota_pediria       smallint not null check (nota_pediria between 0 and 10),
  nota_indicaria     smallint not null check (nota_indicaria between 0 and 10),
  preco              numeric(8,2) not null check (preco >= 0 and preco <= 9999),
  gostou             text check (length(gostou) <= 1000),
  mudaria            text check (length(mudaria) <= 1000),
  nota_final         numeric(4,2) not null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  primary key (avaliador_id, lanche_id)
);

create table if not exists public.config (
  chave  text primary key,
  valor  text not null
);

-- Ninguém acessa as tabelas diretamente pela internet: tudo passa pelas funções abaixo.
alter table public.lanches     enable row level security;
alter table public.avaliadores enable row level security;
alter table public.avaliacoes  enable row level security;
alter table public.config      enable row level security;
revoke all on public.lanches, public.avaliadores, public.avaliacoes, public.config from anon, authenticated;

-- ---------- Funções públicas (avaliador) ----------

create or replace function public.listar_lanches()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', id, 'nome', nome) order by id), '[]'::json)
  from lanches;
$$;

create or replace function public.registrar_avaliador(p_nome text, p_idade int)
returns json language plpgsql security definer set search_path = public as $$
declare r avaliadores;
begin
  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'Informe o nome';
  end if;
  insert into avaliadores (nome, idade) values (left(trim(p_nome), 80), p_idade) returning * into r;
  return json_build_object('token', r.token, 'nome', r.nome, 'idade', r.idade);
end $$;

create or replace function public.minhas_avaliacoes(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'nome', a.nome,
    'idade', a.idade,
    'avaliacoes', coalesce((
      select json_agg(to_jsonb(v) - 'avaliador_id' order by v.lanche_id)
      from avaliacoes v where v.avaliador_id = a.id), '[]'::json)
  )
  from avaliadores a where a.token = p_token;
$$;

create or replace function public.salvar_avaliacao(p_token uuid, p_lanche int, p_dados jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_av uuid;
  campos text[] := array['nota_espera','nota_temperatura','nota_aparencia','nota_montagem',
    'nota_sabor','nota_carne','nota_pao','nota_molho','nota_ingredientes','nota_tamanho',
    'nota_facilidade','nota_pediria','nota_indicaria'];
  c text; soma numeric := 0; v_final numeric;
begin
  select id into v_av from avaliadores where token = p_token;
  if v_av is null then raise exception 'Avaliador não encontrado'; end if;

  foreach c in array campos loop
    if p_dados->>c is null then raise exception 'Nota obrigatória: %', c; end if;
    soma := soma + (p_dados->>c)::numeric;
  end loop;
  v_final := round(soma / array_length(campos, 1), 2);

  insert into avaliacoes as t (avaliador_id, lanche_id, espera, chegou, tamanho_percepcao,
    nota_espera, nota_temperatura, nota_aparencia, nota_montagem, nota_sabor, nota_carne,
    nota_pao, nota_molho, nota_ingredientes, nota_tamanho, nota_facilidade, nota_pediria,
    nota_indicaria, preco, gostou, mudaria, nota_final)
  values (v_av, p_lanche, p_dados->>'espera', p_dados->>'chegou', p_dados->>'tamanho_percepcao',
    (p_dados->>'nota_espera')::smallint, (p_dados->>'nota_temperatura')::smallint,
    (p_dados->>'nota_aparencia')::smallint, (p_dados->>'nota_montagem')::smallint,
    (p_dados->>'nota_sabor')::smallint, (p_dados->>'nota_carne')::smallint,
    (p_dados->>'nota_pao')::smallint, (p_dados->>'nota_molho')::smallint,
    (p_dados->>'nota_ingredientes')::smallint, (p_dados->>'nota_tamanho')::smallint,
    (p_dados->>'nota_facilidade')::smallint, (p_dados->>'nota_pediria')::smallint,
    (p_dados->>'nota_indicaria')::smallint, (p_dados->>'preco')::numeric,
    nullif(trim(p_dados->>'gostou'), ''), nullif(trim(p_dados->>'mudaria'), ''), v_final)
  on conflict (avaliador_id, lanche_id) do update set
    espera = excluded.espera, chegou = excluded.chegou, tamanho_percepcao = excluded.tamanho_percepcao,
    nota_espera = excluded.nota_espera, nota_temperatura = excluded.nota_temperatura,
    nota_aparencia = excluded.nota_aparencia, nota_montagem = excluded.nota_montagem,
    nota_sabor = excluded.nota_sabor, nota_carne = excluded.nota_carne, nota_pao = excluded.nota_pao,
    nota_molho = excluded.nota_molho, nota_ingredientes = excluded.nota_ingredientes,
    nota_tamanho = excluded.nota_tamanho, nota_facilidade = excluded.nota_facilidade,
    nota_pediria = excluded.nota_pediria, nota_indicaria = excluded.nota_indicaria,
    preco = excluded.preco, gostou = excluded.gostou, mudaria = excluded.mudaria,
    nota_final = excluded.nota_final, atualizado_em = now();

  return json_build_object('lanche_id', p_lanche, 'nota_final', v_final);
end $$;

-- ---------- Funções do painel (exigem senha) ----------

create or replace function public._checar_senha(p_senha text)
returns void language plpgsql stable security definer set search_path = public, extensions as $$
declare h text;
begin
  select valor into h from config where chave = 'senha_admin';
  if h is null then raise exception 'Senha do painel ainda não foi definida'; end if;
  if p_senha is null or extensions.crypt(p_senha, h) <> h then
    perform pg_sleep(1);  -- atrasa tentativas de adivinhar a senha
    raise exception 'Senha incorreta';
  end if;
end $$;

create or replace function public.admin_dados(p_senha text)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform _checar_senha(p_senha);
  return json_build_object(
    'lanches', (select coalesce(json_agg(json_build_object('id', id, 'nome', nome) order by id), '[]') from lanches),
    'avaliadores', (select coalesce(json_agg(json_build_object(
        'id', id, 'nome', nome, 'idade', idade, 'criado_em', criado_em) order by criado_em), '[]') from avaliadores),
    'avaliacoes', (select coalesce(json_agg(to_jsonb(v) order by v.criado_em), '[]') from avaliacoes v)
  );
end $$;

create or replace function public.admin_renomear(p_senha text, p_nomes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare k text; v text;
begin
  perform _checar_senha(p_senha);
  for k, v in select * from jsonb_each_text(p_nomes) loop
    if length(trim(v)) > 0 then
      update lanches set nome = left(trim(v), 60) where id = k::int;
    end if;
  end loop;
end $$;

create or replace function public.admin_excluir_avaliador(p_senha text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _checar_senha(p_senha);
  delete from avaliadores where id = p_id;
end $$;

-- Só o dono (no SQL Editor) pode definir a senha do painel.
create or replace function public.definir_senha_admin(p_nova text)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(p_nova) < 6 then raise exception 'Use pelo menos 6 caracteres'; end if;
  insert into config (chave, valor) values ('senha_admin', extensions.crypt(p_nova, extensions.gen_salt('bf')))
  on conflict (chave) do update set valor = excluded.valor;
  return 'Senha definida';
end $$;

-- ---------- Permissões ----------
revoke all on function public.listar_lanches(), public.registrar_avaliador(text,int),
  public.minhas_avaliacoes(uuid), public.salvar_avaliacao(uuid,int,jsonb),
  public._checar_senha(text), public.admin_dados(text), public.admin_renomear(text,jsonb),
  public.admin_excluir_avaliador(text,uuid), public.definir_senha_admin(text)
  from public, anon, authenticated;

grant execute on function public.listar_lanches(), public.registrar_avaliador(text,int),
  public.minhas_avaliacoes(uuid), public.salvar_avaliacao(uuid,int,jsonb),
  public.admin_dados(text), public.admin_renomear(text,jsonb),
  public.admin_excluir_avaliador(text,uuid)
  to anon, authenticated;

-- =====================================================================
-- PRÓXIMO PASSO: defina a senha do painel rodando (troque a senha!):
--   select definir_senha_admin('minha-senha-secreta');
-- =====================================================================
