-- parts 테이블에 description과 location 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

-- description 컬럼 추가
ALTER TABLE parts 
ADD COLUMN description VARCHAR(255);

-- location 컬럼 추가  
ALTER TABLE parts 
ADD COLUMN location VARCHAR(100);

-- 기존 데이터에 대한 설명 추가 (선택사항)
UPDATE parts 
SET description = '샤프트 부품 ' || part_number
WHERE description IS NULL;

-- 기존 데이터에 대한 위치 추가 (선택사항)
UPDATE parts 
SET location = 'A-01-01'
WHERE location IS NULL;

-- 컬럼 설명 추가
COMMENT ON COLUMN parts.description IS '파트 설명';
COMMENT ON COLUMN parts.location IS '파트 위치';

-- 변경사항 확인
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'parts' 
ORDER BY ordinal_position; 