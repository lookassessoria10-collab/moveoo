ALTER TABLE "users" ADD COLUMN "tutorial_seen_at" timestamp with time zone;--> statement-breakpoint
-- Contas que já existiam conhecem o painel: o tutorial abre sozinho só para contas novas (continua no menu "Como funciona").
UPDATE "users" SET "tutorial_seen_at" = now();