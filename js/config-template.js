// 환경 변수 템플릿 파일
// 실제 배포 시에는 이 값들을 환경 변수로 설정하세요

const SUPABASE_CONFIG = {
    url: process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY_HERE'
};

// GitHub Pages에서는 환경 변수 대신 직접 설정
const SUPABASE_CONFIG_PRODUCTION = {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key-here'
};

export default SUPABASE_CONFIG_PRODUCTION;
