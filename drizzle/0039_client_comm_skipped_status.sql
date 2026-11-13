-- Client Comm: allow skipped status for mutually exclusive thank-you variants

ALTER TYPE "public"."client_comm_stage_status" ADD VALUE IF NOT EXISTS 'skipped';
