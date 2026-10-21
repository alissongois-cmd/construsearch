-- Run SEPARATELY before 20261017000000_tolerant_submission_ean.sql.
-- Save and review the result. Do not delete/merge products automatically.
select ean, count(*) from public.materiais
where ean is not null group by ean having count(*) > 1;
