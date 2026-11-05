-- Migração 2: o fechamento da ficha guarda de onde ela foi assinada (o plano pede data, hora e IP).
-- A data já é fichas.enviado_em.
ALTER TABLE fichas ADD COLUMN assinatura_ip TEXT;
ALTER TABLE fichas ADD COLUMN assinatura_agente TEXT;
