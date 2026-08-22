CREATE TABLE "research_report_verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"mission_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"verdict" text NOT NULL,
	"content" jsonb NOT NULL,
	"model" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_report_verifications" ADD CONSTRAINT "research_report_verifications_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_report_verifications" ADD CONSTRAINT "research_report_verifications_report_id_research_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."research_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_report_verifications_report_id_created_at_idx" ON "research_report_verifications" USING btree ("report_id","created_at");