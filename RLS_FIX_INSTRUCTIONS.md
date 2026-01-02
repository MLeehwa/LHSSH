# RLS 정책 수정 가이드

## 문제 설명
출고 확정 후 `inventory`와 `inventory_transactions` 테이블이 업데이트되지 않는 문제는 Row Level Security (RLS) 정책이 누락되어 있기 때문입니다.

## 해결 방법

### 1. Supabase SQL 편집기에서 실행
1. Supabase 대시보드에 로그인
2. SQL 편집기로 이동
3. `fix_rls_policies.sql` 파일의 내용을 복사하여 실행

### 2. 실행할 SQL 코드
```sql
-- inventory 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON inventory FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON inventory FOR UPDATE USING (auth.role() = 'authenticated');

-- inventory_transactions 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON inventory_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON inventory_transactions FOR UPDATE USING (auth.role() = 'authenticated');

-- outbound_sequences 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON outbound_sequences FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON outbound_sequences FOR UPDATE USING (auth.role() = 'authenticated');

-- outbound_parts 테이블 쓰기 정책 추가
CREATE POLICY "Allow insert for authenticated users" ON outbound_parts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow update for authenticated users" ON outbound_parts FOR UPDATE USING (auth.role() = 'authenticated');
```

### 3. 테스트 방법
1. 출고 현황 페이지로 이동
2. 브라우저 개발자 도구 열기 (F12)
3. 콘솔에서 다음 명령어 실행:
   ```javascript
   outboundStatus.testInventoryUpdate('49560-12345', 5)
   ```

### 4. 예상 결과
- 성공 시: "재고 업데이트 테스트가 성공했습니다." 메시지 표시
- 실패 시: 구체적인 오류 메시지와 함께 실패 원인 표시

## 추가 디버깅
만약 여전히 문제가 있다면:
1. 브라우저 콘솔에서 상세한 오류 로그 확인
2. Supabase 로그에서 RLS 정책 관련 오류 확인
3. 사용자 인증 상태 확인 