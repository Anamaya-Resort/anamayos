-- Add 'deleted' to retreat_status enum for soft-delete / trash bin
ALTER TYPE retreat_status ADD VALUE IF NOT EXISTS 'deleted';
