// 실행 위치(cwd)와 상관없이 Term_Project_app/.env 를 읽도록 고정
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// data.go.kr 키: Encoding 키(%2B, %3D 포함)를 넣었어도 Decoding 키로 자동 변환
// (URLSearchParams가 한 번 더 인코딩하므로 이중 인코딩 방지)
for (const name of Object.keys(process.env)) {
  if (/SERVICE_KEY$/.test(name) && /%[0-9A-Fa-f]{2}/.test(process.env[name])) {
    try {
      process.env[name] = decodeURIComponent(process.env[name]);
    } catch { /* 변환 실패 시 원본 유지 */ }
  }
}

// 키 앞뒤 공백/따옴표 제거 (복사 붙여넣기 실수 방지)
for (const name of ['TMAP_APP_KEY', 'KAKAO_REST_API_KEY']) {
  if (process.env[name]) process.env[name] = process.env[name].trim().replace(/^['"]|['"]$/g, '');
}
