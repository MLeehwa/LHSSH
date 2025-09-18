-- inventory_transactions 테이블에 실사 관련 컬럼 추가
-- physical_inventory_items의 status 제약 조건도 수정

-- 1. inventory_transactions 테이블에 컬럼 추가
ALTER TABLE inventory_transactions 
ADD COLUMN IF NOT EXISTS db_stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS physical_stock INTEGER DEFAULT 0;

-- 2. transaction_type에 PHYSICAL_INVENTORY 추가
ALTER TABLE inventory_transactions 
DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE inventory_transactions 
ADD CONSTRAINT inventory_transactions_transaction_type_check 
CHECK (transaction_type IN ('INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'PHYSICAL_INVENTORY'));

-- 3. physical_inventory_items의 status 제약 조건 수정
ALTER TABLE physical_inventory_items 
DROP CONSTRAINT IF EXISTS physical_inventory_items_status_check;

ALTER TABLE physical_inventory_items 
ADD CONSTRAINT physical_inventory_items_status_check 
CHECK (status IN ('PENDING', 'COMPLETED', 'ADJUSTED', 'REVIEW'));

-- 4. 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN inventory_transactions.db_stock IS '실사 당시 DB 재고 수량';
COMMENT ON COLUMN inventory_transactions.physical_stock IS '실사로 확인된 실제 재고 수량';
COMMENT ON COLUMN inventory_transactions.transaction_type IS '거래 유형: INBOUND, OUTBOUND, ADJUSTMENT, PHYSICAL_INVENTORY';

-- 5. 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_db_stock ON inventory_transactions(db_stock);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_physical_stock ON inventory_transactions(physical_stock);
