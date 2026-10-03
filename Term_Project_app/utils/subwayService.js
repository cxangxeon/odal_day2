// utils/subwayService.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const SUBWAY_SERVICE_KEY = process.env.BUSAN_SUBWAY_SERVICE_KEY;
const SUBWAY_BASE_URL = 'http://apis.data.go.kr/6260000/BusanMetroTimeTable'; // 예시: 실제 문서 확인 필요

/**
 * 예시: 역명 혹은 역ID → 시간표 조회
 * GET http://apis.data.go.kr/6260000/BusanMetroTimeTable/getTimeTable?ServiceKey=...&stationId=...
 */
export async function fetchSubwayTimeTable(stationId) {
  const url = new URL(`${SUBWAY_BASE_URL}/getTimeTable`);
  url.searchParams.append('ServiceKey', SUBWAY_SERVICE_KEY);
  url.searchParams.append('stationId', stationId);
  // 기타 파라미터(요일 구분, 출발/도착 구분 등) 필요 시 추가

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`지하철 시간표 API 오류: ${res.status}`);
  }
  const data = await res.json();
  // data.response.body.items.item 등 구조에 따라 반환
  return data.response?.body?.items?.item || [];
}

/**
 * 지하철 경로 시간 예측
 * - origin 좌표 주변 역 조회 → 역 ID 얻기
 * - destination 좌표 주변 역 조회 → 역 ID 얻기
 * - 시간표 조회 → 다음 열차 도착시간 파악
 * - 역 간 이동시간: 고정 값 혹은 공공데이터 문서에 따른 소요시간 정보 필요
 * - 도보 시간 포함
 *
 * 여기서는 매우 단순화된 예시 로직:
 */
export async function estimateSubwayRouteTime(origin, destination) {
  // 1) 주변 역 조회: 별도 API 필요 (공공데이터 API에 주변 역 조회 기능이 없을 수 있음)
  //    Kakao Local API로 “지하철 {역명}” 검색 후 좌표 비교 → 역 ID 매핑 로직 필요
  //    또는 미리 역별 좌표 데이터를 확보하여 KD-tree 등으로 최근접 역 탐색.

  // 예시: originStationId, destStationId를 이미 알고 있다고 가정
  const originStationId = '100'; // 예시값
  const destStationId = '200'; // 예시값

  const originWalkDist = haversineDistance(origin.y, origin.x,
                                           /*역 좌표*/ 35.0, 128.9);
  const destWalkDist = haversineDistance(destination.y, destination.x,
                                         /*역 좌표*/ 35.1, 128.95);
  const walkSpeedMperMin = 4000 / 60;
  const walkTimeOrigin = originWalkDist / walkSpeedMperMin;
  const walkTimeDest = destWalkDist / walkSpeedMperMin;

  // 시간표 조회 → 다음 열차 대기시간 계산
  const timetableOrigin = await fetchSubwayTimeTable(originStationId);
  let waitTime = 5; // 예시: timetableOrigin에서 현재 시각 이후 첫 차 시간 계산 필요
  // 지하철 이동시간: 예시 8분
  const rideTime = 8;

  const totalTime = walkTimeOrigin + waitTime + rideTime + walkTimeDest;
  return {
    totalTime,
    details: {
      originStationId,
      destStationId,
      walkTimeOrigin,
      waitTime,
      rideTime,
      walkTimeDest
    }
  };
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 6371000;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
