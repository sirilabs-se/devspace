CREATE TABLE "username_holds" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "username_holds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" varchar NOT NULL,
	"user_id" text,
	"release_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "username_holds_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "username_holds" ADD CONSTRAINT "username_holds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;