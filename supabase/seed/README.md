# Seed revisado das imagens

O arquivo `20260927000000_seed_produtos_imagens.sql` contém somente os 40 itens
confirmados. Ele não inclui os dois cards ilegíveis, as duas bacias sanitárias
nem o painel WPC.

## Aplicação pelo SQL Editor

1. Aplique primeiro as migrations em `supabase/migrations/`.
2. No Dashboard do Supabase, abra **SQL Editor → New query**.
3. Copie todo o conteúdo do arquivo de seed, cole na consulta e clique em **Run**.
4. Confirme que o resultado terminou sem erro e valide os totais com:

```sql
select l.nome as loja, count(*) as precos
from public.precos p
join public.lojas l on l.id = p.loja_id
where l.nome in ('Telhanorte', 'Obramax', 'Casa São Pedro', 'Sodimac', 'Joli')
group by l.nome
order by l.nome;
```

O seed é transacional e idempotente: lojas e materiais são inseridos somente
quando não existem; preços existentes são atualizados e só combinações novas de
material/loja são inseridas. A correspondência de nomes ignora maiúsculas,
minúsculas e espaços nas extremidades.
