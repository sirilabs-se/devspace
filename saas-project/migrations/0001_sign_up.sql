CREATE TYPE "public"."consent_document" AS ENUM('terms', 'privacy', 'age_confirmation');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" varchar NOT NULL,
	"account_id" varchar NOT NULL,
	"password" varchar,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_user_id" text,
	"subject_user_id" text,
	"action" varchar NOT NULL,
	"details" jsonb,
	"ip_address" varchar,
	"user_agent" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"document" "consent_document" NOT NULL,
	"version" varchar NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar,
	"user_agent" varchar,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" varchar NOT NULL,
	"username" varchar,
	"display_username" varchar,
	"image" varchar,
	"role" varchar DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" varchar,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"locale" varchar DEFAULT 'en' NOT NULL,
	"time_zone" varchar DEFAULT 'UTC' NOT NULL,
	"username_changed_at" timestamp with time zone,
	"deletion_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" varchar NOT NULL,
	"value" varchar NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_users_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_idx" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "audit_events_subject_created_idx" ON "audit_events" USING btree ("subject_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "consents_user_id_idx" ON "consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_deletion_requested_at_idx" ON "users" USING btree ("deletion_requested_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
-- The audit log is append-only (ADR 0006). Only two changes are allowed:
-- emptying the user links, IP address and device details when an account is
-- permanently deleted, and deleting rows older than 12 months.
CREATE FUNCTION audit_events_guard() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.created_at > now() - interval '12 months' THEN
			RAISE EXCEPTION 'audit_events rows can only be deleted after 12 months';
		END IF;
		RETURN OLD;
	END IF;

	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.action IS DISTINCT FROM OLD.action
		OR NEW.details IS DISTINCT FROM OLD.details
		OR NEW.created_at IS DISTINCT FROM OLD.created_at
		OR (NEW.actor_user_id IS NOT NULL AND NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id)
		OR (NEW.subject_user_id IS NOT NULL AND NEW.subject_user_id IS DISTINCT FROM OLD.subject_user_id)
		OR (NEW.ip_address IS NOT NULL AND NEW.ip_address IS DISTINCT FROM OLD.ip_address)
		OR (NEW.user_agent IS NOT NULL AND NEW.user_agent IS DISTINCT FROM OLD.user_agent)
	THEN
		RAISE EXCEPTION 'audit_events rows cannot be edited';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_events_guard
	BEFORE UPDATE OR DELETE ON audit_events
	FOR EACH ROW EXECUTE FUNCTION audit_events_guard();
