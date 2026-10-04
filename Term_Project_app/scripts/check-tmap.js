import '../utils/loadEnv.js';
import { searchTransitRoute } from '../utils/tmap.js';
const k = process.env.TMAP_APP_KEY;
console.log('TMAP_APP_KEY:', k ? `${k.length}자 (${k.slice(0, 4)}***)` : '없음');
try {
  // 부산역 → 해운대해수욕장
  const r = await searchTransitRoute({ x: 129.0403, y: 35.1151 }, { x: 129.1604, y: 35.1587 });
  console.log(`OK: ${r.totalTime}분, 요금 ${r.details.payment}원, 환승 ${r.details.transferCount}회`);
  r.details.steps.forEach(s => console.log(` - ${s.type} ${s.line || ''} ${s.minutes}분 ${s.from || ''}→${s.to || ''}`));
} catch (e) { console.log('FAIL:', e.message); }
