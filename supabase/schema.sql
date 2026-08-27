-- Execute este script no SQL Editor do projeto Supabase (https://supabase.com/dashboard/project/_/sql/new).

-- Estado atual (um único registro, id fixo 'default').
create table if not exists rateio_settings (
  id text primary key,
  columns jsonb not null,
  valor_conta text not null,
  taxa_condominio_global text not null,
  taxa_fixa text not null,
  mes_referencia text not null,
  updated_at timestamptz not null default now()
);

-- Linhas (unidades) do mês corrente.
create table if not exists rateio_rows (
  id text primary key,
  unidade text not null default '',
  leitura_anterior text not null default '',
  leitura_atual text not null default '',
  taxa_condominio text not null default '',
  na boolean not null default false,
  position integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Histórico: um snapshot por mês, criado ao clicar em "Avançar mês".
create table if not exists rateio_historico (
  mes_referencia text primary key,
  saved_at timestamptz not null default now(),
  rows jsonb not null,
  totals jsonb
);

alter table rateio_settings enable row level security;
alter table rateio_rows enable row level security;
alter table rateio_historico enable row level security;

-- Este app não tem login: qualquer pessoa com a chave publishable (anon)
-- pode ler e escrever. Isso é aceitável para uma ferramenta interna/privada
-- cujo link não é divulgado publicamente. Se isso mudar, restrinja estas
-- policies (ex.: exigir autenticação) antes de tornar o link público.
create policy "anon full access" on rateio_settings
  for all to anon using (true) with check (true);

create policy "anon full access" on rateio_rows
  for all to anon using (true) with check (true);

create policy "anon full access" on rateio_historico
  for all to anon using (true) with check (true);
