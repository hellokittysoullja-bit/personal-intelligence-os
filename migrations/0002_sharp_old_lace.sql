CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"raw_request" text NOT NULL,
	"inferred_intent" text,
	"desired_outcome" text,
	"parent_goal_id" uuid,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"owner_id" text NOT NULL,
	"mission_id" uuid,
	"task_id" uuid,
	"agent_job_id" uuid,
	"trace_id" text NOT NULL,
	"causation_id" uuid,
	"correlation_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"schema_version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"goal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"objective" text NOT NULL,
	"status" text NOT NULL,
	"current_phase" text NOT NULL,
	"autonomy_level" text NOT NULL,
	"risk_level" text NOT NULL,
	"budget" jsonb NOT NULL,
	"success_criteria" jsonb NOT NULL,
	"constraints" jsonb NOT NULL,
	"unknowns" jsonb NOT NULL,
	"assumptions" jsonb NOT NULL,
	"stop_conditions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mission_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"task_type" text NOT NULL,
	"status" text NOT NULL,
	"dependencies" jsonb NOT NULL,
	"assigned_agent_job_id" uuid,
	"input_artifact_ids" jsonb NOT NULL,
	"output_artifact_ids" jsonb NOT NULL,
	"success_criteria" jsonb NOT NULL,
	"evidence_requirements" jsonb NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"timeout_ms" integer NOT NULL,
	"budget" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_events_mission_id_timestamp_idx" ON "mission_events" USING btree ("mission_id","timestamp");