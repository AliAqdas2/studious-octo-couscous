-- Mangia food-tour product names as event_type enum values

ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'Group Food Tour';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'Italian Food Tour';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'Georgetown Foodie Tour';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'Private Food Tour';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE IF NOT EXISTS 'Indoor Food Tour';
