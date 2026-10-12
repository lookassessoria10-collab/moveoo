CREATE TYPE "public"."actor_type" AS ENUM('usuario', 'pessoa', 'sistema');--> statement-breakpoint
CREATE TYPE "public"."care_modality" AS ENUM('presencial', 'remoto', 'hibrido');--> statement-breakpoint
CREATE TYPE "public"."consent_decision" AS ENUM('aceito', 'recusado', 'revogado');--> statement-breakpoint
CREATE TYPE "public"."contact_channel" AS ENUM('email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."episode_status" AS ENUM('ativo', 'encerrado');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('publicada', 'substituida');--> statement-breakpoint
CREATE TYPE "public"."measurement_decision" AS ENUM('aceita', 'corrigida', 'descartada');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('gestor', 'profissional', 'assistente');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('ativo', 'removido');--> statement-breakpoint
CREATE TYPE "public"."measurement_origin" AS ENUM('camera', 'manual_profissional', 'demonstracao');--> statement-breakpoint
CREATE TYPE "public"."profession" AS ENUM('fisioterapia', 'educacao_fisica');--> statement-breakpoint
CREATE TYPE "public"."capture_quality" AS ENUM('apta', 'insuficiente');--> statement-breakpoint
CREATE TYPE "public"."release_state" AS ENUM('desenvolvimento', 'demonstracao', 'em_validacao', 'liberado', 'suspenso');--> statement-breakpoint
CREATE TYPE "public"."assessment_request_status" AS ENUM('pendente', 'em_andamento', 'aguardando_revisao', 'revisada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."assessment_session_review" AS ENUM('provisorio', 'revisado');--> statement-breakpoint
CREATE TYPE "public"."assessment_session_status" AS ENUM('iniciada', 'concluida', 'interrompida');--> statement-breakpoint
CREATE TYPE "public"."supervision" AS ENUM('sem_supervisao', 'sessao_ao_vivo');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('verificar_email', 'redefinir_senha');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pendente', 'verificado', 'recusado');--> statement-breakpoint
CREATE TYPE "public"."workspace_environment" AS ENUM('demonstracao', 'real');--> statement-breakpoint
CREATE TYPE "public"."workspace_kind" AS ENUM('autonomo', 'clinica', 'estudio', 'academia');--> statement-breakpoint
CREATE TABLE "assessment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"episode_id" uuid,
	"requested_by" uuid NOT NULL,
	"protocol_id" text NOT NULL,
	"protocol_version" text NOT NULL,
	"instructions" text,
	"supervision" "supervision" DEFAULT 'sem_supervisao' NOT NULL,
	"due_at" timestamp with time zone,
	"status" "assessment_request_status" DEFAULT 'pendente' NOT NULL,
	"previous_request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "requests_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "assessment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "assessment_session_status" DEFAULT 'iniciada' NOT NULL,
	"review_status" "assessment_session_review" DEFAULT 'provisorio' NOT NULL,
	"origin" "measurement_origin" NOT NULL,
	"protocol_id" text NOT NULL,
	"protocol_version" text NOT NULL,
	"app_version" text NOT NULL,
	"algorithm_version" text,
	"model_id" text,
	"runtime_version" text,
	"reported_context" jsonb,
	"module_summary" jsonb,
	"device" jsonb,
	"interruption_reason" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	CONSTRAINT "sessions_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"object_type" text,
	"object_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"title" text NOT NULL,
	"modality" "care_modality" NOT NULL,
	"remote_suitability_note" text,
	"status" "episode_status" DEFAULT 'ativo' NOT NULL,
	"opened_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "episodes_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "care_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"professional_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"required" boolean NOT NULL,
	"legal_review_status" text DEFAULT 'pendente_revisao_juridica' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_doc_key_version_uq" UNIQUE("key","version")
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"decision" "consent_decision" NOT NULL,
	"signer_name" text NOT NULL,
	"invitation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature_key" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"protocol_version" text NOT NULL,
	"state" "release_state" NOT NULL,
	"scope" text NOT NULL,
	"evidence" text NOT NULL,
	"decided_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"include_measurements" boolean DEFAULT false NOT NULL,
	"status" "feedback_status" DEFAULT 'publicada' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"assessment_request_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"channel" "contact_channel" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accessed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"code_hash" text,
	"code_expires_at" timestamp with time zone,
	"code_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "measurement_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"measurement_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"decision" "measurement_decision" NOT NULL,
	"corrected_value" real,
	"justification" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"metric_key" text NOT NULL,
	"movement" text NOT NULL,
	"side" text NOT NULL,
	"value" real,
	"unit" text NOT NULL,
	"method" text NOT NULL,
	"attempts_planned" integer,
	"attempts_analyzed" integer,
	"quality" "capture_quality" NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"status" "member_status" DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_ws_user_uq" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "contact_channel" NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"preferred_channel" "contact_channel" DEFAULT 'email' NOT NULL,
	"city" text,
	"uf" text,
	"is_fictitious" boolean NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "persons_ws_id_uq" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "professional_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"profession" "profession" NOT NULL,
	"council" text NOT NULL,
	"council_region" text NOT NULL,
	"registration_number" text NOT NULL,
	"jurisdiction_uf" text NOT NULL,
	"verification_status" "verification_status" DEFAULT 'pendente' NOT NULL,
	"verification_source" text,
	"verification_note" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "workspace_kind" NOT NULL,
	"environment" "workspace_environment" DEFAULT 'demonstracao' NOT NULL,
	"brand_color" text DEFAULT '#128C90' NOT NULL,
	"logo_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_requests" ADD CONSTRAINT "assessment_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_requests" ADD CONSTRAINT "assessment_requests_workspace_id_person_id_persons_workspace_id_id_fk" FOREIGN KEY ("workspace_id","person_id") REFERENCES "public"."persons"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_requests" ADD CONSTRAINT "assessment_requests_workspace_id_episode_id_care_episodes_workspace_id_id_fk" FOREIGN KEY ("workspace_id","episode_id") REFERENCES "public"."care_episodes"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_workspace_id_request_id_assessment_requests_workspace_id_id_fk" FOREIGN KEY ("workspace_id","request_id") REFERENCES "public"."assessment_requests"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_sessions" ADD CONSTRAINT "assessment_sessions_workspace_id_person_id_persons_workspace_id_id_fk" FOREIGN KEY ("workspace_id","person_id") REFERENCES "public"."persons"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_episodes" ADD CONSTRAINT "care_episodes_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_episodes" ADD CONSTRAINT "care_episodes_workspace_id_person_id_persons_workspace_id_id_fk" FOREIGN KEY ("workspace_id","person_id") REFERENCES "public"."persons"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_relationships" ADD CONSTRAINT "care_relationships_professional_user_id_users_id_fk" FOREIGN KEY ("professional_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_relationships" ADD CONSTRAINT "care_relationships_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_relationships" ADD CONSTRAINT "care_relationships_workspace_id_person_id_persons_workspace_id_id_fk" FOREIGN KEY ("workspace_id","person_id") REFERENCES "public"."persons"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_document_id_consent_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."consent_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_workspace_id_person_id_persons_workspace_id_id_fk" FOREIGN KEY ("workspace_id","person_id") REFERENCES "public"."persons"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_releases" ADD CONSTRAINT "feature_releases_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_workspace_id_request_id_assessment_requests_workspace_id_id_fk" FOREIGN KEY ("workspace_id","request_id") REFERENCES "public"."assessment_requests"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_person_id_persons_workspace_id_id_fk" FOREIGN KEY ("workspace_id","person_id") REFERENCES "public"."persons"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_assessment_request_id_assessment_requests_workspace_id_id_fk" FOREIGN KEY ("workspace_id","assessment_request_id") REFERENCES "public"."assessment_requests"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_reviews" ADD CONSTRAINT "measurement_reviews_measurement_id_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."measurements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_reviews" ADD CONSTRAINT "measurement_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_workspace_id_session_id_assessment_sessions_workspace_id_id_fk" FOREIGN KEY ("workspace_id","session_id") REFERENCES "public"."assessment_sessions"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_sessions" ADD CONSTRAINT "person_sessions_invitation_id_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "requests_person_idx" ON "assessment_requests" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_idem_uq" ON "assessment_sessions" USING btree ("request_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "audit_ws_idx" ON "audit_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "care_rel_person_idx" ON "care_relationships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "consent_person_idx" ON "consent_records" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_request_version_uq" ON "feedbacks" USING btree ("request_id","version");--> statement-breakpoint
CREATE INDEX "measurements_session_idx" ON "measurements" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "persons_ws_idx" ON "persons" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");