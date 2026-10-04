// 사용법: npm run check:odsay
// ODsay 키/등록 URI 문제를 단계별로 진단한다.
import fetch from 'node-fetch';
import '../utils/loadEnv.js';

const key = process.env.ODSAY_API_KEY;
console.log('--- ODsay 진단 ---');
if (!key) {
  console.log('X ODSAY_API_KEY 가 .env 에 없습니다.');
  process.exit(1);
}
console.log(`키 길이: ${key.length}자, 앞 3자: ${key.slice(0, 3)}***, 뒤 2자: ***${key.slice(-2)}`);
const odd = key.match(/[^A-Za-z0-9+/=_\-]/g);
if (odd) console.log(`! 키에 이상한 문자가 섞여 있습니다: ${JSON.stringify([...new Set(odd)])} (따옴표/공백/한글?)`);
if (key !== key.trim()) console.log('! 키 앞뒤에 공백이 있습니다.');
console.log('키 확인 팁: ODsay LAB 화면의 API Key를 "복사(Cmd+C)"해서 .env 에 붙여넣으세요. 눈으로 보고 타이핑하면 O/0, l/I 오타가 납니다.\n');

const variants = [
  ['헤더 없음 (서버 직접 호출)', {}],
  ['Origin/Referer = http://localhost:3000', { Origin: 'http://localhost:3000', Referer: 'http://localhost:3000/' }],
  ['Origin/Referer = localhost:3000', { Origin: 'localhost:3000', Referer: 'localhost:3000' }],
];

let anyOk = false;
for (const [name, headers] of variants) {
  const u = new URL('https://api.odsay.com/v1/api/searchPubTransPathT');
  u.searchParams.append('SX', '129.0721'); u.searchParams.append('SY', '35.2347');
  u.searchParams.append('EX', '129.0614'); u.searchParams.append('EY', '35.1578');
  u.searchParams.append('apiKey', key);
  try {
    const r = await fetch(u.toString(), { headers });
    const j = await r.json();
    if (j.error) {
      const e = Array.isArray(j.error) ? j.error[0] : j.error;
      console.log(`X [${name}] 실패 code=${e.code ?? e.errorCode} msg=${e.msg ?? e.message}`);
    } else {
      anyOk = true;
      const best = j.result?.path?.[0]?.info;
      console.log(`O [${name}] 성공! 소요시간 ${best?.totalTime}분, 요금 ${best?.payment}원`);
    }
  } catch (e) {
    console.log(`X [${name}] 네트워크 오류: ${e.message.replace(/apiKey=[^&\s]+/gi, 'apiKey=***')}`);
  }
}
console.log(anyOk
  ? '\n=> 키는 정상입니다. 서버를 재시작하세요.'
  : '\n=> 모든 방식이 실패: (1) 키 복사 오류 (2) ODsay LAB 서비스 상태가 "비활성화" (3) 등록 URI/플랫폼 불일치 순으로 확인하세요.');
