CREATE TABLE "bootstrap_check" (
	"id" serial PRIMARY KEY NOT NULL,
	"note" text DEFAULT 'personal-intelligence-os bootstrap' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
