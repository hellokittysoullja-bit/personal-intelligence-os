CREATE TABLE "browser_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"label" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "browser_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" text NOT NULL,
	"control_owner" text NOT NULL,
	"reobservation_required" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_observed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_profile_id_browser_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."browser_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "browser_profiles_owner_created_at_idx" ON "browser_profiles" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "browser_sessions_profile_status_idx" ON "browser_sessions" USING btree ("profile_id","status");