// utils/odsay.js - ODsay 대중교통 길찾기 (https://lab.odsay.com)
import fetch from 'node-fetch';
import './loadEnv.js';

const ODSAY_KEY = process.env.ODSAY_API_KEY;
const BASE = 'https://api.odsay.com/v1/api';
const ODSAY_ORIGIN = process.env.ODSAY_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;

async function odsayGet(endpoint, params) {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, String(v));
  url.searchParams.append('apiKey', ODSAY_KEY);
  let res;
  try {
    res = await fetch(url.toString(), {
      // ODsay 키가 'URI(localhost:3000)' 플랫폼으로 등록되어 있어 서버 호출에도 같은 출처를 알려준다
      headers: { Referer: ODSAY_ORIGIN + '/', Origin: ODSAY_ORIGIN },
    });
  } catch (e) {
    throw new Error(`[odsay] 네트워크 오류: ${e.message.replace(/apiKey=[^&\s]+/gi, 'apiKey=***')}`);
  }
  const data = await res.json().catch(() => null);
  if (!data) throw new Error(`[odsay] 응답 파싱 실패 (HTTP ${res.status})`);
  // 오류는 { error: { code, msg } } 또는 { error: [ {code,message} ] } 형태
  if (data.error) {
    const e = Array.isArray(data.error) ? data.error[0] : data.error;
    const code = e?.code ?? e?.errorCode;
    const msg = e?.msg ?? e?.message ?? JSON.stringify(e);
    console.error(`[odsay] 오류 code=${code} msg=${msg}`);
    throw new Error(`ODsay 오류(code=${code}): ${msg}`);
  }
  return data.result ?? data;
}

const TRAFFIC = { 1: 'subway', 2: 'bus', 3: 'walk' };

/**
 * origin/destination: { x: 경도, y: 위도 }
 * 반환: { totalTime(분), payment, transfers, steps[], polyline[{x,y}] }
 */
const routeCache = new Map(); // 무료 플랜 호출 한도(30건/일) 절약용 메모리 캐시
const cacheKey = (o, d) => [o.x, o.y, d.x, d.y].map(v => Number(v).toFixed(4)).join(',');

export async function searchTransitRoute(origin, destination) {
  if (!ODSAY_KEY) throw new Error('ODSAY_API_KEY 미설정');
  const key = cacheKey(origin, destination);
  if (routeCache.has(key)) {
    console.log('[odsay] 캐시 사용 (API 호출 생략)');
    return routeCache.get(key);
  }
  const result = await searchTransitRouteUncached(origin, destination);
  routeCache.set(key, result);
  return result;
}

async function searchTransitRouteUncached(origin, destination) {
  const result = await odsayGet('searchPubTransPathT', {
    SX: origin.x, SY: origin.y, EX: destination.x, EY: destination.y,
    OPT: 0, SearchType: 0, SearchPathType: 0,
  });
  const paths = result.path;
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('ODsay: 경로 결과가 없습니다 (너무 가깝거나 대중교통 불가 구간)');
  }
  const best = paths[0]; // ODsay 추천순(최단시간) 첫 번째
  const info = best.info || {};

  const steps = (best.subPath || []).map(sp => {
    const type = TRAFFIC[sp.trafficType] || 'unknown';
    const lane = sp.lane?.[0];
    return {
      type,
      minutes: sp.sectionTime,
      distanceM: sp.distance,
      line: type === 'bus' ? lane?.busNo : type === 'subway' ? lane?.name : undefined,
      from: sp.startName,
      to: sp.endName,
      stationCount: sp.stationCount,
    };
  });

  // 지도에 그릴 실제 경로선 (실패해도 무시)
  let polyline = [];
  if (info.mapObj) {
    try {
      const lane = await odsayGet('loadLane', { mapObject: `0:0@${info.mapObj}` });
      polyline = (lane.lane || []).flatMap(l => (l.section || []).flatMap(sec => sec.graphPos || []));
    } catch (e) {
      console.warn('[odsay] loadLane 실패(직선으로 표시):', e.message);
    }
  }

  return {
    mode: 'transit',
    totalTime: info.totalTime,
    details: {
      payment: info.payment,
      totalDistanceM: info.totalDistance,
      busTransitCount: info.busTransitCount,
      subwayTransitCount: info.subwayTransitCount,
      firstStartStation: info.firstStartStation,
      lastEndStation: info.lastEndStation,
      steps,
    },
    polyline,
  };
}
