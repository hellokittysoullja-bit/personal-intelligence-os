CREATE TABLE "memory_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"memory_type" text NOT NULL,
	"scope" text NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"structured_data" jsonb NOT NULL,
	"provenance" jsonb NOT NULL,
	"confidence_basis_points" integer NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"status" text NOT NULL,
	"supersedes_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "memory_records_owner_status_updated_at_idx" ON "memory_records" USING btree ("owner_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "memory_records_owner_scope_subject_idx" ON "memory_records" USING btree ("owner_id","scope","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_records_one_active_subject_idx" ON "memory_records" USING btree ("owner_id","scope","subject") WHERE "memory_records"."status" = 'active';