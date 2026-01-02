# 일일 재고 추적 시스템 가이드
# Daily Inventory Tracking System Guide

## 개요 (Overview)

이 시스템은 매일의 재고 변동을 추적하고 기록하여 재고 오류를 쉽게 발견하고 관리할 수 있도록 설계되었습니다.

This system is designed to track and record daily inventory movements, making it easy to detect and manage inventory errors.

## 시스템 구성 (System Components)

### 1. 데이터베이스 테이블 (Database Tables)

#### `daily_inventory_snapshots`
- **목적**: 매일 자정에 각 파트의 재고 스냅샷을 저장
- **주요 필드**:
  - `snapshot_date`: 스냅샷 날짜
  - `part_number`: 파트 번호
  - `opening_stock`: 시작 재고 (전일 종료 재고)
  - `closing_stock`: 종료 재고 (당일 종료 재고)
  - `daily_inbound`: 일일 입고 수량
  - `daily_outbound`: 일일 출고 수량

#### `daily_inventory_summary`
- **목적**: 일별 전체 재고 요약 정보 저장
- **주요 필드**:
  - `summary_date`: 요약 날짜
  - `total_parts`: 총 파트 수
  - `total_opening_stock`: 총 시작 재고
  - `total_closing_stock`: 총 종료 재고
  - `total_daily_inbound`: 총 일일 입고
  - `total_daily_outbound`: 총 일일 출고
  - `parts_with_movement`: 재고 변동이 있는 파트 수

### 2. 데이터베이스 함수 (Database Functions)

#### `create_daily_inventory_snapshot(target_date)`
- **기능**: 지정된 날짜의 일일 재고 스냅샷 생성
- **사용법**: `SELECT create_daily_inventory_snapshot('2024-01-15');`

#### `track_inventory_movement(part_number, quantity, type, reference_number)`
- **기능**: 입고/출고 시 일일 추적 시스템 업데이트
- **사용법**: `SELECT track_inventory_movement('49560-12345', 10, 'INBOUND', 'ARN-2024-001');`

#### `validate_inventory_consistency(target_date)`
- **기능**: 재고 계산 오류 검증
- **사용법**: `SELECT * FROM validate_inventory_consistency('2024-01-15');`

#### `get_inventory_history(part_number, start_date, end_date)`
- **기능**: 특정 파트의 재고 이력 조회
- **사용법**: `SELECT * FROM get_inventory_history('49560-12345', '2024-01-01', '2024-01-31');`

### 3. 뷰 (Views)

#### `daily_inventory_status`
- 일일 재고 현황을 보기 쉽게 정리한 뷰
- 계산된 재고와 실제 재고 비교
- 검증 상태 표시

#### `monthly_inventory_summary`
- 월별 재고 요약 정보
- 일별 평균, 최대값 등 통계 정보

## 사용 방법 (Usage Instructions)

### 1. 데이터베이스 설정 (Database Setup)

```sql
-- daily_inventory_tracking.sql 파일 실행
-- 이 파일에는 모든 테이블, 함수, 뷰가 포함되어 있습니다
```

### 2. 일일 스냅샷 생성 (Daily Snapshot Creation)

#### 자동 생성 (권장)
- 매일 자정에 자동으로 스냅샷 생성
- Supabase의 Scheduled Functions 사용

#### 수동 생성
```sql
-- 오늘 날짜 스냅샷 생성
SELECT create_daily_inventory_snapshot(CURRENT_DATE);

-- 특정 날짜 스냅샷 생성
SELECT create_daily_inventory_snapshot('2024-01-15');
```

### 3. 재고 변동 추적 (Inventory Movement Tracking)

#### 입고 시
```sql
SELECT track_inventory_movement('49560-12345', 10, 'INBOUND', 'ARN-2024-001');
```

#### 출고 시
```sql
SELECT track_inventory_movement('49560-12345', 5, 'OUTBOUND', 'OUT-2024-001');
```

### 4. 오류 검증 (Error Validation)

```sql
-- 특정 날짜의 재고 오류 검증
SELECT * FROM validate_inventory_consistency('2024-01-15');

-- 오늘 날짜의 재고 오류 검증
SELECT * FROM validate_inventory_consistency(CURRENT_DATE);
```

### 5. 이력 조회 (History Query)

```sql
-- 특정 파트의 30일 이력 조회
SELECT * FROM get_inventory_history('49560-12345', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE);

-- 특정 기간 이력 조회
SELECT * FROM get_inventory_history('49560-12345', '2024-01-01', '2024-01-31');
```

## 웹 인터페이스 (Web Interface)

### 관리자 페이지: `/admin/daily-inventory.html`

#### 주요 기능:
1. **날짜 선택**: 특정 날짜의 재고 현황 조회
2. **스냅샷 생성**: 수동으로 일일 스냅샷 생성
3. **오류 검증**: 재고 계산 오류 검증 및 표시
4. **데이터 내보내기**: JSON 형태로 데이터 내보내기
5. **요약 카드**: 총 파트 수, 입고, 출고, 오류 수 표시

#### 사용법:
1. 날짜 선택기에서 원하는 날짜 선택
2. "스냅샷 생성" 버튼으로 해당 날짜의 스냅샷 생성
3. "오류 검증" 버튼으로 재고 오류 확인
4. "새로고침" 버튼으로 최신 데이터 로드
5. "데이터 내보내기" 버튼으로 JSON 파일 다운로드

## 오류 유형 (Error Types)

### 1. NEGATIVE_STOCK (음수 재고)
- **원인**: 출고량이 현재 재고보다 많을 때
- **해결**: 재고 확인 및 수정

### 2. CALCULATION_MISMATCH (계산 불일치)
- **원인**: 시작재고 + 입고 - 출고 ≠ 종료재고
- **해결**: 거래 내역 확인 및 재고 수정

## 모니터링 및 알림 (Monitoring & Alerts)

### 1. 일일 모니터링
- 매일 자정 스냅샷 생성 확인
- 재고 오류 자동 검증
- 오류 발견 시 알림

### 2. 주간 리뷰
- 일주일간의 재고 변동 추이 분석
- 이상 패턴 발견
- 정기적인 재고 정리

### 3. 월간 보고서
- 월별 재고 요약 보고서 생성
- 파트별 재고 변동 분석
- 재고 관리 개선점 도출

## 트러블슈팅 (Troubleshooting)

### 1. 스냅샷 생성 실패
```sql
-- 스냅샷 존재 여부 확인
SELECT * FROM daily_inventory_snapshots WHERE snapshot_date = '2024-01-15';

-- 수동으로 스냅샷 생성
SELECT create_daily_inventory_snapshot('2024-01-15');
```

### 2. 재고 불일치 해결
```sql
-- 특정 파트의 재고 이력 확인
SELECT * FROM get_inventory_history('49560-12345', '2024-01-01', '2024-01-15');

-- 재고 오류 상세 확인
SELECT * FROM validate_inventory_consistency('2024-01-15');
```

### 3. 데이터 복구
```sql
-- 특정 날짜의 스냅샷 삭제 후 재생성
DELETE FROM daily_inventory_snapshots WHERE snapshot_date = '2024-01-15';
SELECT create_daily_inventory_snapshot('2024-01-15');
```

## 성능 최적화 (Performance Optimization)

### 1. 인덱스 활용
- `snapshot_date`, `part_number` 인덱스 활용
- 복합 인덱스로 쿼리 성능 향상

### 2. 파티셔닝 (대용량 데이터)
- 월별 파티셔닝 고려
- 오래된 데이터 아카이빙

### 3. 캐싱
- 자주 조회되는 요약 데이터 캐싱
- Redis 등 외부 캐시 활용

## 보안 고려사항 (Security Considerations)

### 1. Row Level Security (RLS)
- 모든 테이블에 RLS 적용
- 인증된 사용자만 쓰기 권한

### 2. 데이터 백업
- 정기적인 데이터베이스 백업
- 스냅샷 데이터 별도 백업

### 3. 감사 로그
- 재고 변동 감사 로그
- 사용자 활동 추적

## 향후 개선 계획 (Future Improvements)

### 1. 자동화
- 매일 자정 자동 스냅샷 생성
- 오류 발견 시 자동 알림

### 2. 분석 기능
- 재고 변동 패턴 분석
- 예측 모델링

### 3. 모바일 지원
- 모바일 친화적 인터페이스
- 푸시 알림

## 문의 및 지원 (Support)

시스템 사용 중 문제가 발생하거나 개선 사항이 있으시면 개발팀에 문의해 주세요.

For technical support or improvement suggestions, please contact the development team. 