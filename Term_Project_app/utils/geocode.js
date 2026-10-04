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
