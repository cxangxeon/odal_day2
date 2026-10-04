// utils/busService.js
import fetch from 'node-fetch';
import './loadEnv.js';
import { callPublicApi } from './publicApi.js';

const BUS_SERVICE_KEY = process.env.BUSAN_BUS_SERVICE_KEY;
const BUS_BASE_URL = 'http://apis.data.go.kr/6260000/BusanBIMS'; // 실제 endpoint base URL

/**
 * 1) 주변 정류소 조회 (주변정류소목록조회)
 *    API 문서에 명시된 endpoint와 파라미터 사용.
 *    예시: GET http://apis.data.go.kr/6260000/BusanBIMS/getNearStationList?ServiceKey=...&x=...&y=...&radius=...
 *
 * 2) 정류소 ID → 도착정보 조회
 *    GET http://apis.data.go.kr/6260000/BusanBIMS/getBusArrival?ServiceKey=...&stationId=...
 *
 * 실제 API 경로와 파라미터명은 공공데이터포털 문서에서 확인 후 조정.
 */
export async function fetchNearbyBusStops(x, y, radius = 500) {
  const url = new URL(`${BUS_BASE_URL}/getNearStationList`);
  url.searchParams.append('ServiceKey', BUS_SERVICE_KEY);
  url.searchParams.append('x', x.toString());
  url.searchParams.append('y', y.toString());
  url.searchParams.append('radius', radius.toString());
  // 기타 파라미터(페이지 등)가 필요하면 추가

  const data = await callPublicApi(url, 'busService');
  // 응답 구조: data.response.body.items.item 등 (문서 확인 필요)
  return data.response?.body?.items?.item || [];
}

/**
 * 특정 정류소의 버스 도착예정 정보 조회
 * stationId: 공공데이터 포털에서 제공하는 정류소 ID
 */
export async function fetchBusArrival(stationId) {
  const url = new URL(`${BUS_BASE_URL}/getBusArrival`);
  url.searchParams.append('ServiceKey', BUS_SERVICE_KEY);
  url.searchParams.append('stationId', stationId);
  const data = await callPublicApi(url, 'busService');
  return data.response?.body?.items?.item || [];
}

/**
 * origin 좌표와 destination 좌표 사이의 버스 경로 및 예상 소요시간 계산
 * 복잡한 로직:  
 * 1) origin 주변 정류소 목록 조회 → 후보 정류소군  
 * 2) destination 주변 정류소 목록 조회 → 후보 정류소군  
 * 3) origin-정류소까지의 도보 시간 계산 (대략 거리→도보 속도 4km/h 가정)  
 * 4) 정류소 간 버스 노선 정보 파악:  
 *    - 정류소 A → 정류소 B를 잇는 노선이 있는지 확인 (노선 정보 API 필요)  
 *    - 환승이 필요하면 환승 정류소 탐색  
 * 5) 버스 예측 도착 시간: fetchBusArrival 호출 → origin 정류소에서 버스가 언제 출발하는지 파악  
 * 6) 버스 탑승 시간(정류소 간 이동 소요시간) 계산  
 * 7) 하차 → 목적지까지 도보 시간  
 * 8) 총합: 도보(출발) + 대기 + 버스 이동 + 도보(도착)  
 * 
 * 여기서는 로직 예시만 제시. 실 구현 시 공공데이터 API의 “노선조회”, “경유정류소목록조회” 등의 API를 단계별로 호출하여 경로를 계산해야 함.
 */
export async function estimateBusRouteTime(origin, destination) {
  // 1) 주변 정류소 조회
  const originStops = await fetchNearbyBusStops(origin.x, origin.y, 500);
  const destStops = await fetchNearbyBusStops(destination.x, destination.y, 500);

  // 2) 예시: 가장 가까운 정류소 하나씩만 사용 (간단화)
  if (originStops.length === 0 || destStops.length === 0) {
    throw new Error('주변 정류소를 찾을 수 없음');
  }
  const originStop = originStops[0];
  const destStop = destStops[0];

  // 3) 도보 시간 계산 (m 단위 거리 → 분 단위): haversineDistance 재사용
  const walkSpeedMperMin = 4000 / 60; // 4km/h = 약 66.67 m/min
  const walkDistOrigin = haversineDistance(origin.y, origin.x,
                                           parseFloat(originStop.y), parseFloat(originStop.x));
  const walkTimeOrigin = walkDistOrigin / walkSpeedMperMin;

  const walkDistDest = haversineDistance(destination.y, destination.x,
                                         parseFloat(destStop.y), parseFloat(destStop.x));
  const walkTimeDest = walkDistDest / walkSpeedMperMin;

  // 4) 버스 이동 시간 대략 예측: 
  //    - 실제로는 노선 조회 API → 정류소 간 index 파악 → 예상 소요시간 API 필요.
  // 여기서는 간단히 “버스 이동 시간”을 상수로 가정하거나, 
  // fetchBusArrival를 호출하여 대기시간만 고려하는 샘플 로직.
  const arrivalInfo = await fetchBusArrival(originStop.stationId);
  // 예: arrivalInfo에서 routeId와 predictTime1을 찾아 사용
  // 단일 노선 가정, 복잡 환승 로직 생략
  let busWaitTime = null;
  if (Array.isArray(arrivalInfo) && arrivalInfo.length > 0) {
    // 첫 번째 도착예정 버스 대기시간(분)으로 가정
    const first = arrivalInfo[0];
    if (first.predictTime1 != null) {
      busWaitTime = Number(first.predictTime1);
    }
  }
  if (busWaitTime == null) {
    // 예측 불가 시 기본값 설정
    busWaitTime = 5; // 분 단위 예시
  }
  // 버스 이동 시간: 예시로 fixed 10분 (실제로는 노선별 정류소 간 소요시간 합 계산 필요)
  const busRideTime = 10;

  const totalTime = walkTimeOrigin + busWaitTime + busRideTime + walkTimeDest;
  return {
    totalTime, // 분 단위 예시
    details: {
      originStop,
      destStop,
      walkTimeOrigin,
      busWaitTime,
      busRideTime,
      walkTimeDest
    }
  };
}

/**
 * Haversine 공식: utils/foodService.js 와 동일
 */
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
