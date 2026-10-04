import fetch from 'node-fetch';
import './loadEnv.js';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
console.log('[geocode] loaded KAKAO_REST_API_KEY:', KAKAO_REST_API_KEY ? 'OK' : 'MISSING');

export async function geocodeAddress(address) {
  if (!KAKAO_REST_API_KEY) {
    throw new Error('Kakao REST API 키가 설정되지 않았습니다.');
  }
  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json');
  url.searchParams.append('query', address);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Kakao Geocoding API 오류: ${res.status}`);
  }
  const data = await res.json();
  if (data.documents && data.documents.length > 0) {
    // 첫 번째 결과 사용
    const doc = data.documents[0];
    // x: 문자열 경도, y: 문자열 위도
    return { x: parseFloat(doc.x), y: parseFloat(doc.y) };
  }

  // 주소 검색 결과가 없으면 장소명(예: '부산대학교', '서면역')으로 키워드 검색
  const kurl = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  kurl.searchParams.append('query', address);
  const kres = await fetch(kurl.toString(), {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  });
  if (kres.ok) {
    const kdata = await kres.json();
    if (kdata.documents && kdata.documents.length > 0) {
      const d = kdata.documents[0];
      return { x: parseFloat(d.x), y: parseFloat(d.y) };
    }
  }
  throw new Error('주소/장소를 찾을 수 없음');
}

// ---------- 러프한 입력용 장소 후보 검색 ----------
// "부산대 앞", "서면역 근처", "사상구 학장동" 처럼 대충 입력해도 후보를 돌려준다.
const NOISE = /(근처|부근|주변|앞|쪽|인근|에서|에\s*있어|있어요|있음|입니다|이에요|여기)\s*$/;

function relaxQueries(raw) {
  const base = raw.replace(/\s+/g, ' ').trim();
  const queries = [base];
  let q = base;
  while (NOISE.test(q)) { q = q.replace(NOISE, '').trim(); if (q) queries.push(q); }
  const words = q.split(' ').filter(Boolean);
  // 뒤 단어부터 하나씩 줄여가며 재시도 (예: "부산대 정문 앞 카페" → "부산대 정문 앞" → ...)
  for (let i = words.length - 1; i >= 1; i--) queries.push(words.slice(0, i).join(' '));
  if (words.length > 1) queries.push(words.join('')); // 띄어쓰기 오타 보정
  return [...new Set(queries)].filter(Boolean);
}

async function kakaoGet(path, params) {
  const url = new URL(`https://dapi.kakao.com/v2/local/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);
  const res = await fetch(url.toString(), { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } });
  if (!res.ok) throw new Error(`Kakao API 오류: ${res.status}`);
  return (await res.json()).documents || [];
}

export async function searchPlaces(raw, { x, y, limit = 5 } = {}) {
  if (!KAKAO_REST_API_KEY) throw new Error('Kakao REST API 키가 설정되지 않았습니다.');
  const results = [];
  const seen = new Set();
  const push = (r) => {
    const key = `${r.x.toFixed(5)},${r.y.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(r);
  };
  for (const q of relaxQueries(raw)) {
    // 장소명(키워드) 우선, 그다음 주소. 부산 기준으로 가까운 순 정렬
    const kw = await kakaoGet('search/keyword.json', {
      query: q, size: 5, x: x ?? 129.0756, y: y ?? 35.1796, sort: 'accuracy',
    });
    kw.forEach(d => push({
      name: d.place_name, address: d.road_address_name || d.address_name,
      x: parseFloat(d.x), y: parseFloat(d.y),
    }));
    if (results.length < limit) {
      const ad = await kakaoGet('search/address.json', { query: q, size: 3 });
      ad.forEach(d => push({
        name: d.address_name, address: d.road_address?.address_name || d.address_name,
        x: parseFloat(d.x), y: parseFloat(d.y),
      }));
    }
    if (results.length > 0) break; // 가장 구체적인 질의에서 결과가 나오면 거기서 멈춘다
  }
  return results.slice(0, limit);
}
