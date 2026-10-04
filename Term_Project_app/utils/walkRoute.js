// utils/walkRoute.js - 실제 보행 경로 (OpenStreetMap 기반 OSRM foot 프로필, 키 불필요)
import fetch from 'node-fetch';

const WALK_M_PER_MIN = 4500 / 60; // 보행 4.5km/h = 75m/분

export async function walkingRoute(origin, destination) {
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
    `${origin.x},${origin.y};${destination.x},${destination.y}?overview=full&geometries=geojson`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`보행 경로 없음 (${data.code || res.status})`);
    }
    const r = data.routes[0];
    return {
      mode: 'walk',
      totalTime: r.distance / WALK_M_PER_MIN,
      details: {
        distanceM: Math.round(r.distance),
        note: '실제 보행 경로, 보행속도 4.5km/h 기준 (OpenStreetMap)',
      },
      polyline: r.geometry.coordinates.map(([x, y]) => ({ x, y })),
    };
  } catch (e) {
    throw new Error(`[walk] ${e.name === 'AbortError' ? '시간 초과' : e.message}`);
  } finally {
    clearTimeout(timer);
  }
}
