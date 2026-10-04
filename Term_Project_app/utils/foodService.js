// utils/foodService.js
import fetch from 'node-fetch';
import './loadEnv.js';
import { callPublicApi } from './publicApi.js';

const FOOD_SERVICE_KEY = process.env.BUSAN_FOOD_SERVICE_KEY;

// 기본 엔드포인트 (HTTP; 필요 시 HTTPS로 변경)
const FOOD_SERVICE_URL = 'http://apis.data.go.kr/6260000/FoodService/getFoodKr';

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
let foodCache = { at: 0, items: null };
const FOOD_CACHE_MS = 60 * 60 * 1000; // 1시간 (지도 이동마다 공공API를 호출하지 않도록)

async function getAllFoodItems() {
  if (foodCache.items && Date.now() - foodCache.at < FOOD_CACHE_MS) return foodCache.items;
  if (!FOOD_SERVICE_KEY) {
    throw new Error('BUSAN_FOOD_SERVICE_KEY 미설정');
  }
  const url = new URL(FOOD_SERVICE_URL);
  url.searchParams.append('ServiceKey', FOOD_SERVICE_KEY);
  url.searchParams.append('pageNo', '1');
  url.searchParams.append('numOfRows', '1000');
  url.searchParams.append('resultType', 'json');

  const data = await callPublicApi(url, 'getFoodKr');
  const responseObj = data.getFoodKr;
  if (!responseObj) throw new Error('getFoodKr 응답 구조가 예상과 다릅니다');
  const header = responseObj.header;
  if (!header || header.code !== '00') {
    throw new Error(`API 응답 에러 코드: ${header?.code}, 메시지: ${header?.message}`);
  }
  const raw = responseObj.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const normalized = items.map(normalizeFoodItem).filter(it => it.lat != null && it.lng != null);
  console.log(`[getFoodKr] 전체 ${items.length}곳 로드 (좌표 유효 ${normalized.length}곳) - 1시간 캐시`);
  foodCache = { at: Date.now(), items: normalized };
  return normalized;
}

/** 출발지 기준 반경(m) 내 맛집 */
export async function fetchNearbyFoodService(x, y, radius) {
  const all = await getAllFoodItems();
  if (radius != null && !isNaN(radius)) {
    const r = all.filter(it => haversineDistance(y, x, it.lat, it.lng) <= radius);
    console.log(`[fetchNearbyFoodService] 반경 ${radius}m: ${all.length} -> ${r.length}`);
    return r;
  }
  return all;
}

/** 지도 화면(남서~북동 좌표) 안의 맛집 */
export async function fetchFoodInBounds({ swLat, swLng, neLat, neLng }) {
  const all = await getAllFoodItems();
  const r = all.filter(it => it.lat >= swLat && it.lat <= neLat && it.lng >= swLng && it.lng <= neLng);
  console.log(`[fetchFoodInBounds] 화면 영역: ${all.length} -> ${r.length}`);
  return r;
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


/**
 * API마다 다른 필드명을 통일한다.
 *  - 부산맛집(getFoodKr): LAT, LNG, MAIN_TITLE, RPRSNTV_MENU ...
 *  - 구버전 필드: RSTR_LA, RSTR_LO, RSTR_NM ...
 */
export function normalizeFoodItem(item) {
  const lat = parseFloat(item.LAT ?? item.RSTR_LA);
  const lng = parseFloat(item.LNG ?? item.RSTR_LO);
  const name = item.MAIN_TITLE || item.RSTR_NM || item.TITLE || item.PLACE || '맛집';
  const searchText = [
    item.MAIN_TITLE, item.TITLE, item.SUBTITLE, item.PLACE, item.RPRSNTV_MENU,
    item.ITEMCNTNTS, item.BSNS_STATM_BZCND_NM, item.RSTR_INTRCN_CONT, item.FOOD_CATEGORY,
  ].filter(Boolean).join(' ');
  return {
    ...item,
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    name,
    searchText,
  };
}

// ---------- 음식 종류 분류 ----------
// API에 분류 필드가 없어서 "가게명 + 대표메뉴"로 추정한다. (설명문은 오분류가 많아 제외)
const CATEGORY_KEYWORDS = {
  '카페': ['카페', '커피', '디저트', '베이커리', '케이크', '찻집', '라떼', '빙수', '제과', '마카롱'],
  '일식': ['일식', '초밥', '스시', '라멘', '우동', '돈까스', '돈가스', '사시미', '오마카세', '덮밥', '소바', '이자카야', '가라아게'],
  '중식': ['중식', '중국', '짜장', '짬뽕', '탕수육', '마라', '딤섬', '양꼬치', '훠궈'],
  '양식': ['양식', '파스타', '피자', '스테이크', '햄버거', '버거', '브런치', '리조또', '샐러드', '샌드위치'],
};

export function classifyItem(item) {
  const core = [item.MAIN_TITLE, item.TITLE, item.RPRSNTV_MENU].filter(Boolean).join(' ');
  for (const cat of ['카페', '일식', '중식', '양식']) {
    if (CATEGORY_KEYWORDS[cat].some(k => core.includes(k))) return cat;
  }
  return '한식'; // 부산 로컬 맛집 데이터 특성상 나머지는 한식으로 분류
}

export function matchesCategory(item, category) {
  if (!category) return true;
  return classifyItem(item) === category;
}

// ---------- 가격대 ----------
// RPRSNTV_MENU 의 "￦9,000", "9,000원" 같은 표기에서 최저가를 추출
export function extractMinPrice(item) {
  const text = item.RPRSNTV_MENU || '';
  const prices = [];
  for (const m of text.matchAll(/[￦₩]\s*([\d,]{3,})(?:\s*[-~]\s*([\d,]{3,}))?|([\d,]{4,})\s*원/g)) {
    const v = parseInt((m[1] || m[3]).replace(/,/g, ''), 10);
    if (!isNaN(v)) prices.push(v);
  }
  return prices.length ? Math.min(...prices) : null;
}

// 저렴: 1만원 이하 / 중간: 1~2만원 / 고급: 2만원 초과 (가격 정보 없는 가게는 제외)
export function matchesPrice(item, price) {
  if (!price) return true;
  const p = extractMinPrice(item);
  if (p == null) return false;
  if (price === '저렴') return p <= 10000;
  if (price === '중간') return p > 10000 && p <= 20000;
  if (price === '고급') return p > 20000;
  return true;
}
