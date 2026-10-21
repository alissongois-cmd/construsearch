-- Produtos confirmados a partir das 10 imagens revisadas em 27/09/2026.
-- Pode ser executado novamente: lojas/materiais ausentes são criados e preços
-- existentes para a mesma combinação material/loja são atualizados, não duplicados.
begin;

-- Corrige nomes caso uma versão anterior tenha sido cadastrada manualmente.
update public.materiais target
set nome = 'Argamassa ACIII Grandes Formatos Interna e Externa Cinza 20kg Super'
where lower(trim(target.nome)) = lower('Argamassa ACII Grandes Formatos Interna e Externa Cinza 20kg Super')
  and not exists (
    select 1 from public.materiais corrected
    where lower(trim(corrected.nome)) = lower('Argamassa ACIII Grandes Formatos Interna e Externa Cinza 20kg Super')
  );

update public.materiais target
set nome = target.nome || ' (unidade)'
where lower(trim(target.nome)) in (
    lower('Telha Romana Premium 40x23 Vermelha Resinada Barrobello'),
    lower('Telha Portuguesa Premium 40x24 Vermelha Resinada Barrobello')
  )
  and not exists (
    select 1 from public.materiais corrected
    where lower(trim(corrected.nome)) = lower(trim(target.nome || ' (unidade)'))
  );

insert into public.lojas (nome, cidade, contato)
select seed.nome, seed.cidade, seed.contato
from (
  values
    ('Telhanorte', 'Online', 'https://telhanorte.com.br'),
    ('Obramax', 'São Paulo', 'https://obramax.com.br'),
    ('Casa São Pedro', 'Online', 'https://casasaopedro.com.br'),
    ('Sodimac', 'Online', 'https://sodimac.com.br'),
    ('Joli', 'Online', 'https://joli.com.br')
) as seed(nome, cidade, contato)
where not exists (
  select 1 from public.lojas existing
  where lower(trim(existing.nome)) = lower(trim(seed.nome))
);

insert into public.materiais (nome, categoria, unidade_medida)
select seed.nome, seed.categoria, seed.unidade_medida
from (
  values
    ('Telha Romana Premium 40x23 Vermelha Resinada Barrobello (unidade)', 'telhas', 'unidade'),
    ('Argamassa ACIII Grandes Formatos Interna e Externa Cinza 20kg Super', 'argamassa', 'saco 20kg'),
    ('Argamassa ACIII Porcelanato Interno e Externo Cinza 20kg', 'argamassa', 'saco 20kg'),
    ('Argamassa ACIII Porcelanato Interno e Externo Branco 20kg', 'argamassa', 'saco 20kg'),
    ('Telha Portuguesa Premium 40x24 Vermelha Resinada Barrobello (unidade)', 'telhas', 'unidade'),
    ('Massa Corrida Branca 25kg Suvinil', 'pintura', 'balde 25kg'),
    ('Tinta Acrílica Standard Rende Muito Interior e Exterior Branco Fosco 20L Coral', 'tinta', 'lata 20L'),
    ('Tinta Acrílica Nova Eco Quartzolit Branco Neve Interna 18L', 'tinta', 'lata 18L'),
    ('Tinta Standard Acrílica Fosco Rende Muito Branco 20L Coral', 'tinta', 'lata 20L'),
    ('Telha PVC Plan Terracota 2,42x86cm Lux Telhas', 'telhas', 'unidade'),
    ('Piso Laminado Prime Click Nogueira Natural 7mm', 'pisos e revestimentos', 'm²'),
    ('Piso Laminado Click Urucum 6mm 120x21,5cm caixa 3,10m²', 'pisos e revestimentos', 'm²'),
    ('Argamassa Impermeabilizante Flexível Fibras Viaplus 7000', 'impermeabilização', 'unidade'),
    ('Argamassa Impermeabilizante Semiflexível Viaplus 1000 18kg', 'impermeabilização', 'caixa 18kg'),
    ('Primer Asfáltico para Mantas Base Água Drykoprimer Dryko', 'impermeabilização', 'unidade'),
    ('Argamassa Impermeabilizante Flexível Viaplus 5000 18kg', 'impermeabilização', 'caixa 18kg'),
    ('Veneziana 3 Folhas 100x120 Light Branco Sem Grade Lux Esquadrias', 'esquadrias', 'unidade'),
    ('Gabinete de Cozinha Color 1,44m Branco/Branco Primatto', 'cozinha', 'unidade'),
    ('Basculante Vidro Boreal Alumínio Brilhante 60x60cm Proex', 'esquadrias', 'unidade'),
    ('Porta Basculante de Alumínio Brilhante VD 210x80 Esquerda Proex', 'esquadrias', 'unidade'),
    ('Box Banheiro Sanfonado Flexbox PVC Branco 130x185 Twb', 'banheiro', 'unidade'),
    ('Tinta Acrílica Coralar Desempenho 20L Branco Coral', 'tinta', 'lata 20L'),
    ('Telha Ondulada 5mm 244x92 Eternit', 'telhas', 'unidade'),
    ('Gabinete de Cozinha Asteca 1,14m Branco/Preto Inove', 'cozinha', 'unidade'),
    ('Janela 2 Folhas 100x120 Light Branca Sem Grade Lux Esquadrias', 'esquadrias', 'unidade'),
    ('Vedacit Bianco Aditivo 18kg Otto', 'impermeabilização', 'balde 18kg'),
    ('Gesso de Secagem Lenta 40kg Argos', 'gesso', 'saco 40kg'),
    ('Gesso Branco 20kg Argos', 'gesso', 'saco 20kg'),
    ('Gesso 1kg Branco Argos', 'gesso', 'saco 1kg'),
    ('Gesso 5kg Branco Argos', 'gesso', 'saco 5kg'),
    ('Telha de Fibrocimento Ondulada 244cm x 110cm x 5mm Confibra', 'telhas', 'unidade'),
    ('Cimento CP II F32 Uso Geral 50kg Cauê', 'cimento', 'saco 50kg'),
    ('Telha Plan PVC 2,42x88cm 6 Ondas Afort', 'telhas', 'unidade'),
    ('Cimento Cinza Todas as Obras CP II 50kg Votoran', 'cimento', 'saco 50kg'),
    ('Telha PVC Colonial Plan 2,42m x 0,88m', 'telhas', 'unidade'),
    ('Impermeabilizante Tecplus Top Cinza 18kg', 'impermeabilização', 'saco 18kg'),
    ('Tijolo Maciço Comum 4x19x9cm com 10 Unidades Pedrasil', 'tijolos e blocos', 'pacote 10 unidades'),
    ('Bloco Cerâmico Aldebaran', 'tijolos e blocos', 'unidade'),
    ('Rejunte para Porcelanatos e Cerâmicas 1kg Tijolo Quartzolit', 'rejunte', 'pacote 1kg'),
    ('Revestimento Adesivo 45cm x 5m Tijolo Branco Con-Tact', 'pisos e revestimentos', 'rolo 45cm x 5m')
) as seed(nome, categoria, unidade_medida)
where not exists (
  select 1 from public.materiais existing
  where lower(trim(existing.nome)) = lower(trim(seed.nome))
);

-- Fonte confirmada visualmente: a imagem mostra "45CMX5M", não 45cm x 6m.
create temporary table seed_precos (
  material_nome text not null,
  loja_nome text not null,
  valor numeric(12, 2) not null
) on commit drop;

insert into seed_precos (material_nome, loja_nome, valor)
values
  ('Telha Romana Premium 40x23 Vermelha Resinada Barrobello (unidade)', 'Telhanorte', 2.09),
  ('Argamassa ACIII Grandes Formatos Interna e Externa Cinza 20kg Super', 'Telhanorte', 41.90),
  ('Argamassa ACIII Porcelanato Interno e Externo Cinza 20kg', 'Telhanorte', 44.90),
  ('Argamassa ACIII Porcelanato Interno e Externo Branco 20kg', 'Telhanorte', 63.90),
  ('Telha Portuguesa Premium 40x24 Vermelha Resinada Barrobello (unidade)', 'Telhanorte', 2.09),
  ('Massa Corrida Branca 25kg Suvinil', 'Telhanorte', 84.90),
  ('Tinta Acrílica Standard Rende Muito Interior e Exterior Branco Fosco 20L Coral', 'Telhanorte', 374.90),
  ('Tinta Acrílica Nova Eco Quartzolit Branco Neve Interna 18L', 'Telhanorte', 154.90),
  ('Tinta Standard Acrílica Fosco Rende Muito Branco 20L Coral', 'Obramax', 374.90),
  ('Telha PVC Plan Terracota 2,42x86cm Lux Telhas', 'Obramax', 89.90),
  ('Piso Laminado Prime Click Nogueira Natural 7mm', 'Obramax', 57.90),
  ('Piso Laminado Click Urucum 6mm 120x21,5cm caixa 3,10m²', 'Obramax', 59.90),
  ('Argamassa Impermeabilizante Flexível Fibras Viaplus 7000', 'Obramax', 239.90),
  ('Argamassa Impermeabilizante Semiflexível Viaplus 1000 18kg', 'Obramax', 59.90),
  ('Primer Asfáltico para Mantas Base Água Drykoprimer Dryko', 'Obramax', 33.16),
  ('Argamassa Impermeabilizante Flexível Viaplus 5000 18kg', 'Obramax', 197.00),
  ('Veneziana 3 Folhas 100x120 Light Branco Sem Grade Lux Esquadrias', 'Casa São Pedro', 679.90),
  ('Gabinete de Cozinha Color 1,44m Branco/Branco Primatto', 'Casa São Pedro', 399.90),
  ('Basculante Vidro Boreal Alumínio Brilhante 60x60cm Proex', 'Casa São Pedro', 114.90),
  ('Porta Basculante de Alumínio Brilhante VD 210x80 Esquerda Proex', 'Casa São Pedro', 849.90),
  ('Box Banheiro Sanfonado Flexbox PVC Branco 130x185 Twb', 'Casa São Pedro', 499.90),
  ('Tinta Acrílica Coralar Desempenho 20L Branco Coral', 'Casa São Pedro', 209.90),
  ('Telha Ondulada 5mm 244x92 Eternit', 'Casa São Pedro', 44.90),
  ('Gabinete de Cozinha Asteca 1,14m Branco/Preto Inove', 'Casa São Pedro', 299.90),
  ('Janela 2 Folhas 100x120 Light Branca Sem Grade Lux Esquadrias', 'Casa São Pedro', 399.90),
  ('Vedacit Bianco Aditivo 18kg Otto', 'Casa São Pedro', 312.90),
  ('Gesso de Secagem Lenta 40kg Argos', 'Sodimac', 43.90),
  ('Gesso Branco 20kg Argos', 'Sodimac', 25.90),
  ('Gesso 1kg Branco Argos', 'Sodimac', 4.38),
  ('Gesso 5kg Branco Argos', 'Sodimac', 20.90),
  ('Telha de Fibrocimento Ondulada 244cm x 110cm x 5mm Confibra', 'Sodimac', 47.90),
  ('Cimento CP II F32 Uso Geral 50kg Cauê', 'Sodimac', 34.90),
  ('Telha Plan PVC 2,42x88cm 6 Ondas Afort', 'Sodimac', 78.90),
  ('Cimento Cinza Todas as Obras CP II 50kg Votoran', 'Sodimac', 37.90),
  ('Telha PVC Colonial Plan 2,42m x 0,88m', 'Joli', 112.99),
  ('Impermeabilizante Tecplus Top Cinza 18kg', 'Joli', 48.99),
  ('Tijolo Maciço Comum 4x19x9cm com 10 Unidades Pedrasil', 'Joli', 10.99),
  ('Bloco Cerâmico Aldebaran', 'Joli', 0.99),
  ('Rejunte para Porcelanatos e Cerâmicas 1kg Tijolo Quartzolit', 'Joli', 19.90),
  ('Revestimento Adesivo 45cm x 5m Tijolo Branco Con-Tact', 'Joli', 85.90);

-- Atualiza preços já existentes para que uma nova execução reflita os valores
-- confirmados, sem criar outra linha para a mesma combinação material/loja.
update public.precos existing_price
set valor = seed.valor,
    data_atualizacao = now(),
    atualizado_por = null
from seed_precos seed
join lateral (
  select id from public.materiais
  where lower(trim(nome)) = lower(trim(seed.material_nome))
  order by created_at, id
  limit 1
) material on true
join lateral (
  select id from public.lojas
  where lower(trim(nome)) = lower(trim(seed.loja_nome))
  order by created_at, id
  limit 1
) loja on true
where existing_price.material_id = material.id
  and existing_price.loja_id = loja.id;

-- Insere somente combinações material/loja que ainda não possuem preço.
insert into public.precos (material_id, loja_id, valor, data_atualizacao, atualizado_por)
select material.id, loja.id, seed.valor, now(), null
from seed_precos seed
join lateral (
  select id from public.materiais
  where lower(trim(nome)) = lower(trim(seed.material_nome))
  order by created_at, id
  limit 1
) material on true
join lateral (
  select id from public.lojas
  where lower(trim(nome)) = lower(trim(seed.loja_nome))
  order by created_at, id
  limit 1
) loja on true
where not exists (
  select 1 from public.precos existing_price
  where existing_price.material_id = material.id
    and existing_price.loja_id = loja.id
);

commit;
