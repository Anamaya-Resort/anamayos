-- Add payout and wire_transfer to transaction enums for WeTravel settlement records

ALTER TYPE transaction_class ADD VALUE IF NOT EXISTS 'payout';
ALTER TYPE transaction_class ADD VALUE IF NOT EXISTS 'wire_transfer';
ALTER TYPE transaction_category ADD VALUE IF NOT EXISTS 'payout';
