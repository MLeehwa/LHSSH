# 바코드 시스템 - 간소화 버전

## 개요
이화 서한 샤프트 관리 시스템의 간소화된 버전입니다. 기존의 복잡한 ARN 컨테이너 관리 시스템을 제거하고, **inventory 테이블 중심**의 단순하고 효율적인 재고 관리 시스템으로 재구성되었습니다.

## 주요 변경사항

### 🎯 시스템 간소화
- **입고 현황 페이지 제거**: 복잡한 ARN 컨테이너 관리 시스템 삭제
- **재고 현황 페이지 통합**: 입고 기능을 재고 현황 페이지에 통합
- **데이터베이스 구조 단순화**: ARN 관련 테이블들 제거, inventory 테이블 중심 구조

### 📊 핵심 기능
1. **파트 등록**: 새로운 파트 등록 및 관리
2. **재고 현황**: 실시간 재고 현황 및 입고 관리
3. **출고 현황**: 출고 처리 및 관리
4. **출하 현황**: 출하 요약 및 통계
5. **실사재고**: 물리적 재고 실사 관리

### 🔧 기술적 개선사항
- **데이터 일관성 향상**: 하나의 테이블에서 모든 재고 정보 관리
- **실사재고 후 조정 용이**: inventory 테이블만 수정하면 됨
- **시스템 복잡성 감소**: 뷰나 복잡한 조인 불필요
- **성능 최적화**: 단순한 구조로 인한 쿼리 성능 향상

## 시스템 구조

### 데이터베이스 테이블
```
parts                    - 파트 마스터 정보
├── part_number         - 파트 번호 (PK)
├── category           - 카테고리 (INNER/REAR)
└── status             - 상태 (ACTIVE/INACTIVE/DISCONTINUED)

inventory               - 재고 현황 (핵심 테이블)
├── part_number         - 파트 번호 (FK)
├── current_stock       - 현재 재고
├── today_inbound      - 오늘 입고량
├── today_outbound     - 오늘 출고량
└── status             - 재고 상태

inventory_transactions  - 재고 거래 내역
├── date               - 거래일
├── part_number        - 파트 번호
├── type               - 거래 유형 (INBOUND/OUTBOUND)
├── quantity           - 수량
└── balance_after      - 거래 후 잔고

outbound_sequences     - 출고 차수
outbound_parts         - 출고 파트 상세
users                  - 사용자 정보
```

### 페이지 구조
```
admin/
├── index.html              - 대시보드
├── part-registration.html  - 파트 등록
├── inventory-status.html   - 재고 현황 (입고 기능 통합)
├── outbound-status.html    - 출고 현황
├── outbound-summary.html   - 출하 현황
└── physical-inventory.html - 실사재고

pda/
├── index.html              - PDA 메인
├── inbound.html            - PDA 입고
├── outbound.html           - PDA 출고
└── inventory.html          - PDA 재고 확인
```

## 주요 기능

### 1. 재고 현황 (통합 입고 기능)
- **실시간 재고 현황**: 현재 재고, 최소 재고, 오늘 입출고량 표시
- **CSV/Excel 업로드**: 대량 입고 데이터 파일 업로드
- **수동 입고 등록**: 개별 파트 입고 등록
- **재고 상태 관리**: 재고 부족 알림 및 상태 표시
- **일간 내역**: 일별 입출고 거래 내역 조회

### 2. 입고 처리 (간소화)
- **직접 재고 업데이트**: ARN 컨테이너 없이 직접 inventory 테이블 업데이트
- **거래 내역 자동 기록**: 모든 입고는 inventory_transactions에 자동 기록
- **파트 자동 생성**: 존재하지 않는 파트는 자동으로 생성

### 3. 실사재고 관리
- **물리적 재고 실사**: 실제 재고와 시스템 재고 비교
- **차이 조정**: 실사 결과에 따른 재고 조정
- **이력 관리**: 실사 및 조정 이력 관리

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 데이터베이스 설정
- Supabase 프로젝트 생성
- `sample.sql` 파일 실행하여 테이블 생성
- 환경 변수 설정

### 3. 실행
```bash
# 개발 서버 실행
npm run dev

# 또는 정적 파일 서버 사용
npx http-server
```

## 환경 설정

### Supabase 설정
```javascript
// js/config.js
const SUPABASE_URL = 'your-supabase-url';
const SUPABASE_ANON_KEY = 'your-supabase-anon-key';
```

### 환경 변수
```bash
# .env
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
NODE_ENV=development
```

## 사용법

### 1. 파트 등록
1. 관리자 패널 → 파트 등록
2. 파트 번호, 카테고리 입력
3. 등록 완료 시 자동으로 inventory 레코드 생성

### 2. 입고 처리
1. 재고 현황 → CSV 업로드 또는 입고 등록
2. 파일 업로드 시 자동으로 재고 업데이트
3. 수동 등록 시 파트별 수량 입력

### 3. 출고 처리
1. 출고 현황에서 출고 차수 생성
2. PDA를 통한 바코드 스캔
3. 출고 완료 시 재고 자동 차감

### 4. 실사재고
1. 실사재고 페이지에서 실사 시작
2. 실제 재고 수량 입력
3. 시스템 재고와 비교하여 차이 조정

## 장점

### 🎯 단순성
- 복잡한 ARN 컨테이너 관리 제거
- 직관적인 재고 관리 시스템
- 학습 곡선 단축

### 🔧 유지보수성
- 단순한 데이터베이스 구조
- 명확한 데이터 흐름
- 쉬운 디버깅

### 📈 확장성
- 모듈화된 구조
- 새로운 기능 추가 용이
- 성능 최적화 가능

### 💡 실용성
- 실사재고 후 조정 용이
- 즉시 재고 반영
- 실시간 데이터 동기화

## 기술 스택

- **Frontend**: HTML5, CSS3 (Tailwind CSS), JavaScript (ES6+)
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Processing**: SheetJS (Excel/CSV)
- **UI Framework**: Tailwind CSS
- **Icons**: Font Awesome

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해 주세요. 