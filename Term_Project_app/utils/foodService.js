// utils/foodService.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const FOOD_SERVICE_KEY = process.env.BUSAN_FOOD_SERVICE_KEY;
const FOODIE_SERVICE_KEY = process.env.BUSAN_FOODIE_SERVICE_KEY;

// 기본 엔드포인트 (HTTP; 필요 시 HTTPS로 변경)
const FOOD_SERVICE_URL = 'http://apis.data.go.kr/6260000/FoodService/getFoodKr';
const FOODIE_SERVICE_URL = 'http://apis.data.go.kr/6260000/FoodieService/getFoodieKr';

/**
 * 주변 맛집 호출: fetchNearbyFoodService(x, y, radius)
 * 공공데이터 API에 직접 위도/경도를 전달하는 파라미터가 없는 경우가 많음.
 * 따라서 모든 맛집 리스트를 가져와서 클라이언트 단에서 필터링하거나,
 * API 문서에 좌표 검색 기능이 있으면 해당 파라미터 사용.
 *
 * 여기서는 예시로 전체 리스트 중 좌표 차이를 계산하여 반경 내 필터링.
 * - pageNo=1, numOfRows 크게 설정하여 충분한 결과를 받아온 후 클라이언트 필터링 권장.
 *
 * 주의: 전체 데이터를 매번 가져오는 것은 비효율. 실제론 서버 사이드에 인메모리 캐싱,
 * 혹은 주기적으로 전체 데이터를 가져와 로컬 DB에 저장 후 검색 시 DB 쿼리로 처리하는 방식을 추천.
 */
export async function fetchNearbyFoodService(x, y, radius) {
  console.log(`[fetchNearbyFoodService] 호출: x=${x}, y=${y}, radius=${radius}`);
  if (!FOOD_SERVICE_KEY) {
    console.error('[fetchNearbyFoodService] 환경변수 BUSAN_FOOD_SERVICE_KEY가 설정되지 않았습니다.');
    throw new Error('FOOD_SERVICE_KEY 미설정');
  }

  // 1) API 호출 URL 생성
  const url = new URL(FOOD_SERVICE_URL);
  // 공공데이터포털 문서에 명시된 파라미터명 대소문자 주의
  url.searchParams.append('ServiceKey', FOOD_SERVICE_KEY);
  url.searchParams.append('pageNo', '1');
  url.searchParams.append('numOfRows', '1000');
  url.searchParams.append('resultType', 'json');
  console.log('[fetchNearbyFoodService] 요청 URL:', url.toString());

  // 2) API 호출
  let res;
  try {
    res = await fetch(url.toString());
  } catch (networkErr) {
    console.error('[fetchNearbyFoodService] 네트워크 에러:', networkErr);
    throw new Error('공공데이터 API 호출 중 네트워크 오류');
  }
  console.log('[fetchNearbyFoodService] 응답 상태 코드:', res.status);
  if (!res.ok) {
    let text;
    try {
      text = await res.text();
    } catch (_) {
      text = '<본문 파싱 실패>';
    }
    console.error('[fetchNearbyFoodService] 오류 응답 본문:', text);
    throw new Error(`부산맛집정보 API 오류: ${res.status}`);
  }

  // 3) JSON 파싱
  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    console.error('[fetchNearbyFoodService] JSON 파싱 실패:', parseErr);
    throw new Error('공공데이터 API 응답 JSON 파싱 실패');
  }

  // 4) 최상위 getFoodKr 객체 접근 및 헤더 확인
  const responseObj = data.getFoodKr;
  if (!responseObj) {
    console.warn('[fetchNearbyFoodService] data.getFoodKr가 없습니다. 전체 응답:', data);
    return []; // 혹은 throw new Error(...)
  }
  const header = responseObj.header;
  if (!header || header.code !== '00') {
    console.error('[fetchNearbyFoodService] API 응답 헤더 에러:', header);
    throw new Error(`API 응답 에러 코드: ${header?.code}, 메시지: ${header?.message}`);
  }

  // 5) items 배열화
  const rawItems = responseObj.item;
  // responseObj.item이 배열인지 단일 객체인지 확인
  let items;
  if (Array.isArray(rawItems)) {
    items = rawItems;
  } else if (rawItems) {
    // 단일 객체로 올 경우
    items = [rawItems];
  } else {
    items = [];
  }
  console.log('[fetchNearbyFoodService] items.length =', items.length);
  if (items.length > 0) {
    console.log('[fetchNearbyFoodService] items[0] 샘플:', items[0]);
  }

  // // 6) 반경 필터링: 위도/경도 필드는 item.LAT, item.LNG
  // if (radius != null) {
  //   const beforeCount = items.length;
  //   const filtered = items.filter(item => {
  //     const latVal = item.LAT;
  //     const lngVal = item.LNG;
  //     if (latVal == null || lngVal == null) {
  //       console.warn('[fetchNearbyFoodService] LAT/LNG 필드 누락 아이템:', item);
  //       return false;
  //     }
  //     const lat = parseFloat(latVal);
  //     const lon = parseFloat(lngVal);
  //     if (isNaN(lat) || isNaN(lon)) {
  //       console.warn('[fetchNearbyFoodService] LAT/LNG 파싱 실패(item):', item);
  //       return false;
  //     }
  //     const d = haversineDistance(y, x, lat, lon);
  //     return d <= radius;
  //   });
  //   console.log(`[fetchNearbyFoodService] 반경 필터링 전 count=${beforeCount}, 후 count=${filtered.length}`);
  //   if (filtered.length > 0) {
  //     console.log('[fetchNearbyFoodService] 필터링된 첫 3개 샘플:', filtered.slice(0, 3));
  //   }
  //   return filtered;
  // }

  // radius 미지정 시 전체 반환
  return items;
}

/**
 * 주변 부산푸디투어정보 조회
 * 구조와 로직은 fetchNearbyFoodService와 유사
 */
export async function fetchNearbyFoodieService(x, y, radius) {
  const url = new URL(FOODIE_SERVICE_URL);
  url.searchParams.append('ServiceKey', FOODIE_SERVICE_KEY);
  url.searchParams.append('pageNo', '1');
  url.searchParams.append('numOfRows', '1000');
  url.searchParams.append('resultType', 'json');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`부산푸디투어정보 API 오류: ${res.status}`);
  }
  const data = await res.json();
  const items = data.response?.body?.items?.item || [];
  if (radius != null) {
    return items.filter(item => {
      if (!item.LAT || !item.LNG) return false;
      const lat = parseFloat(item.LAT);
      const lon = parseFloat(item.LNG);
      const d = haversineDistance(y, x, lat, lon);
      return d <= radius;
    });
  } else {
    return items;
  }
}

/**
 * 위도/경도 거리 계산 (미터 단위): Haversine 공식
 * lat1, lon1: 위도/경도 (십진수), lat2, lon2: 비교 대상
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371000; // 지구 반지름(m)
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}
