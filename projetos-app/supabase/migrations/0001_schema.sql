-- Setor de Projetos · Cariati — esquema inicial
create extension if not exists "pgcrypto";

create type setor as enum ('comercial','administrativo','projetos','terceiros');
create type papel as enum ('admin','membro');
create type projeto_status as enum ('ativo','pausado','finalizado','rescindido');
create type etapa_status as enum ('pendente','em_andamento','concluida','nao_aplicavel');
create type protocolo_tipo as enum ('prefeitura','condominio','outro_orgao');
create type protocolo_status as enum ('a_protocolar','protocolado','em_analise','exigencia','aprovado','entregue_ao_cliente');

-- Perfis (um por usuário do Supabase Auth)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  setor setor not null default 'projetos',
  papel papel not null default 'membro',
  created_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and papel = 'admin')
$$;

-- Clientes
create table clientes (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,                       -- ex.: CA000123
  nome text not null,
  categoria text,                           -- A, B, C, D (C e D = "cliente + projetos")
  premium boolean not null default false,   -- premium recebe pendrive na entrega
  telefone text,
  email text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- Modelos de etapa (o fluxo oficial; editável sem mexer no código)
create table etapa_modelos (
  codigo text primary key,                  -- '01'..'24', 'P1'..'P4'
  ordem int not null,
  fase int not null,                        -- 1..4, 5 = pausa e retomada
  titulo text not null,
  rotulo text not null,
  setores setor[] not null default '{}',
  cliente_participa boolean not null default false,
  entrada text,
  saida text,
  regra text,
  opcional boolean not null default false,
  aceite_formal boolean not null default false,
  escopo text                               -- legal | interiores | complementares (quando opcional)
);

-- Projetos
create table projetos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete restrict,
  nome text not null,
  codigo text,
  responsavel_id uuid references profiles(id),
  tem_legal boolean not null default false,
  tem_interiores boolean not null default false,
  tem_complementares boolean not null default false,
  tipo_aprovacao text,                      -- residencial|comercial|habite-se|unificacao|averbacao
  status projeto_status not null default 'ativo',
  pausado_em date,
  motivo_pausa text,
  observacoes text,
  created_at timestamptz not null default now()
);
create index on projetos(status);
create index on projetos(cliente_id);

-- Etapas de cada projeto (instanciadas a partir dos modelos)
create table projeto_etapas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  etapa_codigo text not null references etapa_modelos(codigo),
  status etapa_status not null default 'pendente',
  responsavel_id uuid references profiles(id),
  iniciada_em timestamptz,
  concluida_em timestamptz,
  rodadas_ajuste int not null default 0 check (rodadas_ajuste >= 0),
  observacao text,
  unique (projeto_id, etapa_codigo)
);
create index on projeto_etapas(projeto_id);

-- Histórico (registro rastreável de tudo que acontece)
create table historico (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  etapa_codigo text references etapa_modelos(codigo),
  tipo text not null,                       -- etapa_iniciada | etapa_concluida | ajuste | pausa | retomada | nota | protocolo
  texto text,
  autor_id uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on historico(projeto_id, created_at desc);

-- Protocolos (prefeitura, condomínio e outros órgãos)
create table protocolos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references projetos(id) on delete cascade,
  tipo protocolo_tipo not null default 'prefeitura',
  orgao text,
  numero text,
  status protocolo_status not null default 'a_protocolar',
  data_protocolo date,
  prazo date,                               -- próximo prazo a acompanhar (retorno, exigência…)
  cliente_notificado boolean not null default false,
  observacao text,
  responsavel_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on protocolos(status);
create index on protocolos(prazo);

create table protocolo_andamentos (
  id uuid primary key default gen_random_uuid(),
  protocolo_id uuid not null references protocolos(id) on delete cascade,
  status protocolo_status,
  texto text,
  autor_id uuid references profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger protocolos_touch before update on protocolos
  for each row execute function touch_updated_at();

-- Ao criar um projeto, cria suas etapas conforme o escopo contratado
create or replace function instanciar_etapas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into projeto_etapas (projeto_id, etapa_codigo, status)
  select new.id, m.codigo,
    case
      when m.fase = 5 then 'nao_aplicavel'::etapa_status
      when m.escopo = 'legal' and not new.tem_legal then 'nao_aplicavel'
      when m.escopo = 'interiores' and not new.tem_interiores then 'nao_aplicavel'
      when m.escopo = 'complementares' and not new.tem_complementares then 'nao_aplicavel'
      else 'pendente'
    end
  from etapa_modelos m;

  update projeto_etapas set status = 'em_andamento', iniciada_em = now()
   where projeto_id = new.id and etapa_codigo = '01';
  insert into historico (projeto_id, etapa_codigo, tipo, texto)
  values (new.id, '01', 'etapa_iniciada', 'Projeto criado');
  return new;
end $$;
create trigger projetos_instanciar after insert on projetos
  for each row execute function instanciar_etapas();

-- Segurança: só usuários logados; exclusão apenas por admin
alter table profiles enable row level security;
alter table clientes enable row level security;
alter table etapa_modelos enable row level security;
alter table projetos enable row level security;
alter table projeto_etapas enable row level security;
alter table historico enable row level security;
alter table protocolos enable row level security;
alter table protocolo_andamentos enable row level security;

create policy profiles_ler on profiles for select to authenticated using (true);
create policy profiles_editar_proprio on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (is_admin() or (id = auth.uid() and papel = 'membro'));
create policy modelos_ler on etapa_modelos for select to authenticated using (true);
create policy modelos_admin on etapa_modelos for all to authenticated using (is_admin()) with check (is_admin());

do $$
declare t text;
begin
  foreach t in array array['clientes','projetos','projeto_etapas','historico','protocolos','protocolo_andamentos'] loop
    execute format('create policy %I_ler on %I for select to authenticated using (true)', t, t);
    execute format('create policy %I_criar on %I for insert to authenticated with check (true)', t, t);
    execute format('create policy %I_editar on %I for update to authenticated using (true) with check (true)', t, t);
    execute format('create policy %I_excluir on %I for delete to authenticated using (is_admin())', t, t);
  end loop;
end $$;
