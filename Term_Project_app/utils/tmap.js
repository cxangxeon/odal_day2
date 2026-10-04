// utils/tmap.js - TMAP 대중교통 길찾기 (https://transit.tmapmobility.com / SK openapi)
// 도보 + 지하철 + 버스 조합 경로를 반환한다. 키는 서버에서만 사용(브라우저 노출 없음).
import fetch from 'node-fetch';
import './loadEnv.js';

const URL_TRANSIT = 'https://apis.openapi.sk.com/transit/routes';

const routeCache = new Map();
const cacheKey = (o, d) => [o.x, o.y, d.x, d.y].map(v => Number(v).toFixed(4)).join(',');

const MODE = { WALK: 'walk', BUS: 'bus', SUBWAY: 'subway', EXPRESSBUS: 'bus', TRAIN: 'subway', RAIL: 'subway' };

// "lon,lat lon,lat ..." → [{x,y}]
function parseLine(str) {
  if (!str) return [];
  return str.trim().split(/\s+/).map(p => {
    const [x, y] = p.split(',').map(Number);
    return { x, y };
  }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
}

export async function searchTransitRoute(origin, destination) {
  const appKey = process.env.TMAP_APP_KEY;
  if (!appKey) throw new Error('TMAP_APP_KEY 미설정 (.env 확인)');

  const key = cacheKey(origin, destination);
  if (routeCache.has(key)) return routeCache.get(key);

  let res;
  try {
    res = await fetch(URL_TRANSIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', appKey },
      body: JSON.stringify({
        startX: String(origin.x), startY: String(origin.y),
        endX: String(destination.x), endY: String(destination.y),
        count: 5, lang: 0, format: 'json',
      }),
    });
  } catch (e) {
    throw new Error(`[tmap] 네트워크 오류: ${e.message}`);
  }

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`[tmap] 응답 파싱 실패 (HTTP ${res.status}): ${text.slice(0, 120)}`); }

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || text.slice(0, 160);
    const hint = res.status === 401 || res.status === 403
      ? ' (앱키 확인 또는 TMAP 대중교통 상품 사용 신청 필요)' : '';
    console.error(`[tmap] HTTP ${res.status}: ${msg}`);
    throw new Error(`TMAP 오류(HTTP ${res.status}): ${msg}${hint}`);
  }

  const itineraries = data?.metaData?.plan?.itineraries;
  if (!Array.isArray(itineraries) || itineraries.length === 0) {
    const status = data?.result?.message || data?.result?.status;
    throw new Error(`TMAP: 경로 결과가 없습니다${status ? ` (${status})` : ''}`);
  }

  // 소요시간이 가장 짧은 경로 선택
  const best = itineraries.reduce((a, b) => (b.totalTime < a.totalTime ? b : a));

  const steps = [];
  const polyline = [];
  const segments = []; // 구간별 선 (도보/버스/지하철 색 구분용)
  for (const leg of best.legs || []) {
    const type = MODE[leg.mode] || 'walk';
    steps.push({
      type,
      minutes: Math.max(1, Math.round((leg.sectionTime || 0) / 60)),
      distanceM: leg.distance,
      line: type === 'walk' ? undefined : (leg.route || '').replace(/^(간선|지선|광역|마을|급행|좌석)?:/, ''),
      from: leg.start?.name,
      to: leg.end?.name,
      stationCount: leg.passStopList?.stations ? Math.max(0, leg.passStopList.stations.length - 1) : undefined,
    });
    // 지도에 그릴 선: 대중교통은 passShape, 도보는 steps의 linestring
    const path = [];
    if (leg.passShape?.linestring) {
      path.push(...parseLine(leg.passShape.linestring));
    } else if (Array.isArray(leg.steps)) {
      for (const s of leg.steps) path.push(...parseLine(s.linestring));
    }
    if (path.length < 2) {
      path.length = 0;
      if (leg.start) path.push({ x: leg.start.lon, y: leg.start.lat });
      if (leg.end) path.push({ x: leg.end.lon, y: leg.end.lat });
    }
    polyline.push(...path);
    segments.push({ type, line: steps[steps.length - 1].line, path });
  }

  const result = {
    mode: 'transit',
    totalTime: Math.round((best.totalTime || 0) / 60), // 초 → 분
    details: {
      payment: best.fare?.regular?.totalFare,
      totalDistanceM: best.totalDistance,
      transferCount: best.transferCount,
      busTransitCount: steps.filter(s => s.type === 'bus').length,
      subwayTransitCount: steps.filter(s => s.type === 'subway').length,
      firstStartStation: steps.find(s => s.type !== 'walk')?.from,
      lastEndStation: [...steps].reverse().find(s => s.type !== 'walk')?.to,
      steps,
    },
    polyline,
    segments,
  };
  routeCache.set(key, result);
  return result;
}
