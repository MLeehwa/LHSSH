-- outbound_sequences 테이블의 실제 컬럼 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'outbound_sequences' 
ORDER BY ordinal_position;
