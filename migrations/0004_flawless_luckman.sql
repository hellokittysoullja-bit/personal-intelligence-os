CREATE TABLE "research_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"mission_id" uuid NOT NULL,
	"status" text NOT NULL,
	"content" jsonb NOT NULL,
	"cited_evidence_ids" jsonb NOT NULL,
	"model" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_reports_mission_id_created_at_idx" ON "research_reports" USING btree ("mission_id","created_at");