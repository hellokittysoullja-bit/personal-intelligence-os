CREATE TABLE "durable_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"mission_id" uuid,
	"job_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "durable_jobs" ADD CONSTRAINT "durable_jobs_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "durable_jobs_status_created_at_idx" ON "durable_jobs" USING btree ("status","created_at");