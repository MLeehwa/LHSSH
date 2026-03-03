// Supabase 환경 설정 (중복 선언 방지)
(function() {
    'use strict';
    
    // 이미 로드된 경우 중복 실행 방지
    if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG._initialized) {
        return;
    }
    
    const SUPABASE_CONFIG = {
        // 개발 환경
        development: {
            url: 'https://vzemucykhxlxgjuldibf.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW11Y3lraHhseGdqdWxkaWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzA4MjcsImV4cCI6MjA2ODk0NjgyN30.L9DN-V33rQj6atDnDhVeIOyzGP5I_3uVWSVfMObqrbQ'
        },
        // 프로덕션 환경
        production: {
            url: 'https://vzemucykhxlxgjuldibf.supabase.co',
            anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW11Y3lraHhseGdqdWxkaWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzA4MjcsImV4cCI6MjA2ODk0NjgyN30.L9DN-V33rQj6atDnDhVeIOyzGP5I_3uVWSVfMObqrbQ'
        },
        _initialized: true
    };

    // 현재 환경 설정 (환경변수 또는 기본값)
    const getCurrentConfig = () => {
        const env = window.NODE_ENV || 'development';
        return SUPABASE_CONFIG[env];
    };

    // 환경변수에서 직접 가져오기 (권장)
    const getSupabaseConfig = () => {
        return {
            url: window.SUPABASE_URL || 'https://your-project.supabase.co',
            anonKey: window.SUPABASE_ANON_KEY || 'your-anon-key'
        };
    };

    // 실제 Supabase 설정 (개발용)
    const SUPABASE_URL = 'https://vzemucykhxlxgjuldibf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6ZW11Y3lraHhseGdqdWxkaWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzA4MjcsImV4cCI6MjA2ODk0NjgyN30.L9DN-V33rQj6atDnDhVeIOyzGP5I_3uVWSVfMObqrbQ';

    // 환경 설정
    const ENV = {
        NODE_ENV: window.NODE_ENV || 'development',
        IS_DEVELOPMENT: window.NODE_ENV !== 'production',
        IS_PRODUCTION: window.NODE_ENV === 'production'
    };

    // ★ 로컬 날짜 유틸리티 함수 (UTC 대신 로컬 시간대 사용)
    // new Date().toISOString().split('T')[0] 대신 이 함수를 사용하세요!
    const getLocalDateString = (date = new Date()) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 로컬 ISO 타임스탬프 반환 (시간 포함)
    const getLocalISOString = (date = new Date()) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };

    // 전역 객체로 내보내기 (이미 존재하면 덮어쓰지 않음)
    if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG._initialized) {
        window.SUPABASE_CONFIG = SUPABASE_CONFIG;
        window.getCurrentConfig = getCurrentConfig;
        window.getSupabaseConfig = getSupabaseConfig;
        window.SUPABASE_URL = SUPABASE_URL;
        window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
        window.ENV = ENV;
        window.getLocalDateString = getLocalDateString;
        window.getLocalISOString = getLocalISOString;
    }
})();
