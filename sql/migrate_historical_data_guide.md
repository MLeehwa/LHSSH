# 과거 기록 및 재고 마이그레이션 가이드

## 개요
과거 거래 내역과 오늘 재고를 서버에 올려서 실제 운영 가능하게 하는 방법입니다.

## 시스템 구조 이해

### 테이블 관계
- **`inventory`**: 현재 재고 상태 (current_stock)
- **`inventory_transactions`**: 모든 거래 내역 (INBOUND, OUTBOUND, ADJUSTMENT)
- **트리거**: `inventory_transactions`에 INSERT 시 자동으로 `inventory` 업데이트

### 트리거 동작 방식
```sql
-- INBOUND: current_stock += quantity
-- OUTBOUND: current_stock -= quantity  
-- ADJUSTMENT: current_stock += quantity (양수면 증가, 음수면 감소)
```

## 시나리오별 마이그레이션 방법

### 시나리오 1: 시작일 재고를 알고 있는 경우

**상황:**
- 11/1 시작 재고를 알고 있음
- 11/1~11/13 거래 내역을 알고 있음
- 11/13 마감 재고를 알고 있음

**방법:**
1. 11/1 시작 재고를 `inventory`에 설정
2. 11/1~11/13 거래 내역을 날짜 순서대로 삽입
3. 트리거가 자동으로 11/13 재고 계산
4. 11/13 마감 재고와 비교하여 차이만 ADJUSTMENT로 조정

### 시나리오 2: 시작일 재고를 모르는 경우 (역산 필요)

**상황:**
- 11/1 시작 재고를 모름
- 11/1~11/13 거래 내역을 알고 있음
- 11/13 마감 재고를 알고 있음

**방법: 역산 계산**

1. **11/1 시작 재고 역산 계산**
   ```sql
   -- 11/13 마감 재고 - (11/1~11/13 거래 내역 합계) = 11/1 시작 재고
   WITH transaction_summary AS (
       SELECT 
           part_number,
           SUM(
               CASE 
                   WHEN transaction_type = 'INBOUND' THEN quantity
                   WHEN transaction_type = 'OUTBOUND' THEN -quantity
                   WHEN transaction_type = 'ADJUSTMENT' THEN quantity
               END
           ) AS net_change
       FROM inventory_transactions
       WHERE transaction_date >= '2024-11-01' 
         AND transaction_date <= '2024-11-13'
       GROUP BY part_number
   ),
   final_stock AS (
       -- 실제 11/13 마감 재고 데이터
       SELECT '49560-L3010' AS part_number, 125 AS final_stock
       UNION ALL
       SELECT '49560-S9000' AS part_number, 60 AS final_stock
   )
   SELECT 
       fs.part_number,
       fs.final_stock - COALESCE(ts.net_change, 0) AS initial_stock
   FROM final_stock fs
   LEFT JOIN transaction_summary ts ON fs.part_number = ts.part_number;
   ```

2. **계산된 11/1 시작 재고를 `inventory`에 설정**
   ```sql
   INSERT INTO inventory (part_number, current_stock, last_updated)
   SELECT 
       fs.part_number,
       fs.final_stock - COALESCE(ts.net_change, 0) AS initial_stock,
       '2024-11-01'
   FROM final_stock fs
   LEFT JOIN transaction_summary ts ON fs.part_number = ts.part_number
   ON CONFLICT (part_number) 
   DO UPDATE SET 
       current_stock = EXCLUDED.current_stock,
       last_updated = EXCLUDED.last_updated;
   ```

3. **11/1~11/13 거래 내역을 날짜 순서대로 삽입**
   - 트리거가 자동으로 11/13 재고 계산

4. **검증: 11/13 재고 확인**
   ```sql
   SELECT 
       i.part_number,
       i.current_stock AS calculated,
       fs.final_stock AS actual,
       i.current_stock - fs.final_stock AS difference
   FROM inventory i
   JOIN final_stock fs ON i.part_number = fs.part_number
   WHERE i.current_stock != fs.final_stock;
   ```

### 시나리오 3: 트리거 비활성화 방법 (간단하지만 제한적)

**상황:**
- 11/13 마감 재고만 알고 있음
- 11/1~11/13 거래 내역을 기록만 하고 싶음
- 재고 계산은 필요 없음

**방법:**
1. 트리거 비활성화
2. 11/1~11/13 거래 내역 삽입
3. 11/13 마감 재고를 `inventory`에 직접 설정
4. 트리거 재활성화

**⚠️ 주의:** 이 방법은 거래 내역이 기록만 되고 재고 계산에는 반영되지 않습니다.

## 권장 방법

**시나리오 2 (역산 계산)**를 권장합니다:
- 11/13 마감 재고와 11/1~11/13 거래 내역만 있으면 됨
- 11/1 시작 재고를 자동으로 역산 계산
- 트리거가 정상 작동하여 이후 거래도 자동 계산
- 가장 정확하고 일관성 있음

## 검증

### 1. 거래 내역 건수 확인
```sql
SELECT 
    transaction_type,
    COUNT(*) AS count,
    MIN(transaction_date) AS earliest_date,
    MAX(transaction_date) AS latest_date
FROM inventory_transactions
GROUP BY transaction_type;
```

### 2. 재고 일관성 확인
```sql
SELECT 
    i.part_number,
    i.current_stock AS inventory_stock,
    COALESCE(SUM(
        CASE 
            WHEN it.transaction_type = 'INBOUND' THEN it.quantity
            WHEN it.transaction_type = 'OUTBOUND' THEN -it.quantity
            WHEN it.transaction_type = 'ADJUSTMENT' THEN it.quantity
        END
    ), 0) AS calculated_stock,
    ABS(i.current_stock - COALESCE(SUM(
        CASE 
            WHEN it.transaction_type = 'INBOUND' THEN it.quantity
            WHEN it.transaction_type = 'OUTBOUND' THEN -it.quantity
            WHEN it.transaction_type = 'ADJUSTMENT' THEN it.quantity
        END
    ), 0)) AS difference
FROM inventory i
LEFT JOIN inventory_transactions it ON i.part_number = it.part_number
GROUP BY i.part_number, i.current_stock
HAVING ABS(i.current_stock - COALESCE(SUM(
    CASE 
        WHEN it.transaction_type = 'INBOUND' THEN it.quantity
        WHEN it.transaction_type = 'OUTBOUND' THEN -it.quantity
        WHEN it.transaction_type = 'ADJUSTMENT' THEN it.quantity
    END
), 0)) > 0;
```

## 주의사항

1. **날짜 순서**: 거래 내역은 반드시 날짜 순서대로 삽입해야 합니다
2. **중복 방지**: 같은 거래 내역을 중복 삽입하지 않도록 주의
3. **트랜잭션**: 대량 삽입 시 트랜잭션으로 묶어서 일관성 보장
4. **백업**: 마이그레이션 전 반드시 데이터베이스 백업
