CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"mission_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"content_hash" text NOT NULL,
	"provenance" jsonb NOT NULL,
	"confidence_basis_points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_mission_id_created_at_idx" ON "evidence" USING btree ("mission_id","created_at");