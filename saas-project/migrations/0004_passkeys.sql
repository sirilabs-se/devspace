CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar,
	"public_key" text NOT NULL,
	"credential_id" varchar NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" varchar NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" varchar,
	"aaguid" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passkeys_user_id_idx" ON "passkeys" USING btree ("user_id");