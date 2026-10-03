// utils/routeService.js
import { estimateBusRouteTime } from './busService.js';
import { estimateSubwayRouteTime } from './subwayService.js';

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
  // 1) 버스 예상 시간
  let busResult, subwayResult;
  try {
    busResult = await estimateBusRouteTime(origin, destination);
  } catch (e) {
    busResult = null;
    console.warn('버스 경로 계산 실패:', e.message);
  }
  // 2) 지하철 예상 시간
  try {
    subwayResult = await estimateSubwayRouteTime(origin, destination);
  } catch (e) {
    subwayResult = null;
    console.warn('지하철 경로 계산 실패:', e.message);
  }

  // 3) 비교 및 선택
  let chosen = null;
  if (preferences.modePreference === 'bus' && busResult) {
    chosen = { mode: 'bus', ...busResult };
  } else if (preferences.modePreference === 'subway' && subwayResult) {
    chosen = { mode: 'subway', ...subwayResult };
  } else {
    // 자동: 둘 다 유효하면 소요시간 비교
    if (busResult && subwayResult) {
      if (busResult.totalTime <= subwayResult.totalTime) {
        chosen = { mode: 'bus', ...busResult };
      } else {
        chosen = { mode: 'subway', ...subwayResult };
      }
    } else if (busResult) {
      chosen = { mode: 'bus', ...busResult };
    } else if (subwayResult) {
      chosen = { mode: 'subway', ...subwayResult };
    } else {
      throw new Error('버스/지하철 경로 모두 계산 불가');
    }
  }
  return chosen;
}
