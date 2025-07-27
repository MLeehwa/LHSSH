-- =====================================================
-- Add missing notes column to inventory_transactions table
-- =====================================================

-- Add the notes column to inventory_transactions table
ALTER TABLE inventory_transactions 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'inventory_transactions' 
AND column_name = 'notes'; 