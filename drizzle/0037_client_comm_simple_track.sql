-- Cooking Class simple Client Communication track flag

ALTER TABLE "client_communication_stage_defs"
  ADD COLUMN IF NOT EXISTS "show_in_simple_track" boolean DEFAULT false NOT NULL;
