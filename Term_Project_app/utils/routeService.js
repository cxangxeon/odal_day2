// utils/routeService.js
import { searchTransitRoute } from './tmap.js';
import { walkingRoute } from './walkRoute.js';

/**
 * origin, destination: { x: 경도, y: 위도 }
 * preferences: { modePreference?: 'bus'|'subway'|'auto', ... }
 *
 * modePreference:
 *   - 'bus': 버스 우선
 *   - 'subway': 지하철 우선
 *   - 'auto' 또는 미지정: 실제 소요시간이 더 적은 쪽 선택
 */
export async function planOptimalRoute(origin, destination, preferences = {}) {
  const options = [];
  let transitError = null;

  // 1) 도보: 실제 보행 경로
  let walk = null;
  try {
    walk = await walkingRoute(origin, destination);
    options.push(walk);
  } catch (e) {
    console.warn('[route] 도보 경로 실패:', e.message);
  }

  // 2) 대중교통(버스/지하철): 아주 가까우면(500m 이하) 호출 생략 (API 호출 한도 절약)
  if (walk && walk.details.distanceM <= 500) {
    transitError = '거리가 가까워 도보 경로만 안내합니다';
  } else {
    try {
      options.push(await searchTransitRoute(origin, destination));
    } catch (e) {
      transitError = e.message;
      console.warn('[route] 대중교통 경로 실패 :', e.message);
    }
  }

  if (options.length === 0) options.push(estimateByDistance(origin, destination));

  // 3) 소요시간이 가장 짧은 경로를 추천
  const best = options.reduce((a, b) => (b.totalTime < a.totalTime ? b : a));
  return { ...best, options, transitError };
}

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 직선거리 x 1.3(도로 보정) 기준: 1.5km 이하 도보(4km/h), 초과 시 대중교통 평균 18km/h + 대기 7분
function estimateByDistance(origin, destination) {
  const straight = haversine(origin.y, origin.x, destination.y, destination.x);
  const dist = straight * 1.3;
  const walking = dist <= 1500;
  const totalTime = walking ? dist / (4000 / 60) : 7 + dist / (18000 / 60);
  return {
    mode: 'estimate',
    totalTime,
    details: {
      note: '대중교통 API를 사용할 수 없어 직선거리 기반으로 추정한 값입니다.',
      straightDistanceM: Math.round(straight),
      assumedMovement: walking ? '도보' : '대중교통(평균속도 가정)',
    },
  };
}
