CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"mission_id" uuid,
	"channel" text NOT NULL,
	"action_kind" text NOT NULL,
	"risk_level" text NOT NULL,
	"preview" text NOT NULL,
	"payload_hash" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approval_requests_owner_status_expires_at_idx" ON "approval_requests" USING btree ("owner_id","status","expires_at");