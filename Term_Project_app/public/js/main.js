let map;
let currentMarkers = [];
let originCoords = null;
let autoSearchPausedUntil = 0; // 경로 안내로 지도가 움직일 때 자동 검색을 잠시 멈춤
let destCoords = null;
let currentPolyline = null;
let currentPolylines = []; // 구간별 선(도보/버스/지하철)
let currentRouteMarkers = [];

function initMap() {
  if (typeof kakao === 'undefined' || !kakao.maps) {
    console.error('Kakao Maps SDK가 로드되지 않았습니다.');
    return;
  }
  const center = new kakao.maps.LatLng(35.1796, 129.0756);
  const mapContainer = document.getElementById('map');
  const mapOption = { center: center, level: 4 };
  map = new kakao.maps.Map(mapContainer, mapOption);
}

function clearMarkers() {
  currentMarkers.forEach(m => m.setMap(null));
  currentMarkers = [];
  clearRouteOverlays();
}

function addSimpleMarker(latlng, title) {
  // 출발지는 기본 핀과 확실히 구별되는 펄스 마커로 표시
  if (title === '출발지') {
    const ov = new kakao.maps.CustomOverlay({
      map, position: latlng, yAnchor: 0.5, xAnchor: 0.5, zIndex: 10,
      content: `<div class="origin-marker" title="내 위치(출발지)">
        <span class="origin-pulse"></span><span class="origin-dot"></span>
        <span class="origin-label">출발</span></div>`
    });
    currentMarkers.push(ov);
    return;
  }
  const marker = new kakao.maps.Marker({
    map: map,
    position: latlng,
    title: title
  });
  currentMarkers.push(marker);
  const infowindow = new kakao.maps.InfoWindow({
    content: `<div style="padding:5px;">${title}</div>`
  });
  kakao.maps.event.addListener(marker, 'click', function() {
    infowindow.open(map, marker);
  });
}


// ---------- 현재 지도 화면 기준 맛집 검색 ----------
async function searchInViewport(silent = false) {
  if (!map) return;
  const b = map.getBounds();
  const sw = b.getSouthWest(), ne = b.getNorthEast();
  const category = document.getElementById('categorySelect').value;
  const price = document.getElementById('priceSelect').value;
  const url = new URL('/api/restaurants/bounds', window.location.origin);
  url.searchParams.append('swLat', sw.getLat());
  url.searchParams.append('swLng', sw.getLng());
  url.searchParams.append('neLat', ne.getLat());
  url.searchParams.append('neLng', ne.getLng());
  if (category) url.searchParams.append('category', category);
  if (price) url.searchParams.append('price', price);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const t = await res.json().catch(() => ({}));
      throw new Error(`API 응답 상태 ${res.status} ${t.details || ''}`);
    }
    const data = await res.json();
    clearMarkers();
    if (originCoords) addSimpleMarker(new kakao.maps.LatLng(originCoords.y, originCoords.x), '출발지');
    data.forEach(item => {
      const lat = parseFloat(item.lat), lon = parseFloat(item.lng);
      if (!isNaN(lat) && !isNaN(lon)) {
        addRestaurantMarker(new kakao.maps.LatLng(lat, lon), item.name || '맛집', item);
      }
    });
    const cnt = document.getElementById('resultCount');
    if (cnt) cnt.textContent = `화면 안 맛집 ${data.length}곳`;
    if (data.length === 0 && !silent) {
      alert('현재 지도 화면 안에 조건에 맞는 맛집이 없습니다. 지도를 이동하거나 축소해 보세요.');
    }
  } catch (err) {
    console.error('화면 영역 검색 오류:', err);
    if (!silent) alert('화면 영역 검색 오류: ' + err.message);
  }
}

let viewportTimer = null;
function setupViewportAutoSearch() {
  // 'idle': 드래그/줌이 끝난 뒤 한 번만 발생
  kakao.maps.event.addListener(map, 'idle', () => {
    const auto = document.getElementById('autoViewport');
    if (!auto || !auto.checked) return;
    if (Date.now() < autoSearchPausedUntil) return;
    clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => searchInViewport(true), 400);
  });
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function nl2br(v) { return escapeHtml(String(v ?? '').trim()).replace(/\n/g, '<br>'); }

// 맛집 상세 정보 패널
function showRestaurantInfo(item) {
  const box = document.getElementById('restaurantInfo');
  if (!box || !item) return;
  const name = item.name || item.MAIN_TITLE || '맛집';
  const img = item.MAIN_IMG_NORMAL || item.MAIN_IMG_THUMB;
  const addr = [item.ADDR1, item.ADDR2].filter(Boolean).join(' ').trim();
  const rows = [
    ['주소', addr],
    ['전화', item.CNTCT_TEL],
    ['영업시간', item.USAGE_DAY_WEEK_AND_TIME],
    ['대표메뉴', item.RPRSNTV_MENU],
    ['지역', item.GUGUN_NM],
  ].filter(([, v]) => v && String(v).trim());
  const homepage = item.HOMEPAGE_URL && /^https?:\/\//.test(item.HOMEPAGE_URL.trim())
    ? `<p><a href="${escapeHtml(item.HOMEPAGE_URL.trim())}" target="_blank" rel="noopener">홈페이지 / 블로그</a></p>` : '';
  box.innerHTML = `
    <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">
      ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" style="width:220px; max-width:100%; border-radius:8px; object-fit:cover;" onerror="this.style.display='none'">` : ''}
      <div style="flex:1; min-width:260px;">
        <h3 style="margin-top:0;">${escapeHtml(name)}</h3>
        ${rows.map(([k, v]) => `<p style="margin:4px 0;"><strong>${k}</strong> ${nl2br(v)}</p>`).join('')}
        ${homepage}
      </div>
    </div>
    ${item.ITEMCNTNTS ? `<p style="margin-top:12px; line-height:1.6;">${nl2br(item.ITEMCNTNTS)}</p>` : ''}
  `;
}

function addRestaurantMarker(latlng, title, itemData) {
  const marker = new kakao.maps.Marker({
    map: map,
    position: latlng,
    title: title
  });
  currentMarkers.push(marker);

  kakao.maps.event.addListener(marker, 'click', async function() {
    if (!originCoords) {
      alert('먼저 출발지를 설정하세요.');
      return;
    }
    showRestaurantInfo(itemData);
    const lat = latlng.getLat();
    const lon = latlng.getLng();
    destCoords = { x: lon, y: lat };

    clearMarkers();
    const originLatLng = new kakao.maps.LatLng(originCoords.y, originCoords.x);
    addSimpleMarker(originLatLng, '출발지');
    addSimpleMarker(latlng, title || '도착지');

    try {
      const result = await fetchRouteAndDraw(originCoords, destCoords, title);
      drawRouteOnMap(originCoords, destCoords, result);
    } catch (err) {
      console.error(err);
      alert('경로 안내 오류: ' + err.message);
    }
  });

  const infowindow = new kakao.maps.InfoWindow({
    content: `<div style="padding:8px; max-width:240px; font-size:13px; line-height:1.5;">
      <strong>${escapeHtml(title)}</strong>
      ${itemData?.RPRSNTV_MENU ? `<br>${escapeHtml(String(itemData.RPRSNTV_MENU).trim().split('\n')[0])}` : ''}
      ${itemData?.USAGE_DAY_WEEK_AND_TIME ? `<br>${escapeHtml(String(itemData.USAGE_DAY_WEEK_AND_TIME).trim().split('\n')[0])}` : ''}
      <br><span style="color:#2563eb;">클릭: 상세정보 + 경로 안내</span></div>`
  });
  kakao.maps.event.addListener(marker, 'mouseover', function() {
    infowindow.open(map, marker);
  });
  kakao.maps.event.addListener(marker, 'mouseout', function() {
    infowindow.close();
  });
}

// ---------- 출발지 입력: 러프한 검색 + 후보 선택 + 현위치 ----------
function setOriginStatus(msg, isError = false) {
  const el = document.getElementById('originStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? '#b91c1c' : '#2563eb';
}

function applyOrigin(x, y, label) {
  originCoords = { x, y }; // x=경도, y=위도
  clearMarkers();
  const originLatLng = new kakao.maps.LatLng(y, x);
  addSimpleMarker(originLatLng, '출발지');
  autoSearchPausedUntil = Date.now() + 1500;
  map.setLevel(4);
  map.setCenter(originLatLng);
  hideOriginSuggestions();
  setOriginStatus(`📍 출발지: ${label}`);
}

let originCandidates = [];
function hideOriginSuggestions() {
  const box = document.getElementById('originSuggest');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}

function showOriginSuggestions(list) {
  const box = document.getElementById('originSuggest');
  if (!box) return;
  originCandidates = list;
  if (!list.length) { hideOriginSuggestions(); return; }
  box.innerHTML = list.map((c, i) => `<li data-i="${i}">
      <b>${escapeHtml(c.name)}</b><span>${escapeHtml(c.address || '')}</span></li>`).join('');
  box.style.display = 'block';
}

async function fetchCandidates(q) {
  const res = await fetch(`/api/geocode/search?query=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`장소 검색 응답 상태 ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function setOrigin() {
  const addr = document.getElementById('originAddress').value.trim();
  if (!addr) {
    setOriginStatus('출발지를 입력하세요. (예: 부산대 앞, 서면역, 사상구 학장동)', true);
    return;
  }
  try {
    setOriginStatus('검색 중...');
    const list = await fetchCandidates(addr);
    if (!list.length) {
      setOriginStatus('찾을 수 없어요. 건물/역 이름이나 동 이름으로 다시 입력해 보세요.', true);
      return;
    }
    // 첫 번째 후보로 바로 설정하고, 후보가 여럿이면 목록에서 바꿀 수 있게 보여준다
    applyOrigin(list[0].x, list[0].y, list[0].name);
    if (list.length > 1) showOriginSuggestions(list);
  } catch (err) {
    console.error(err);
    setOriginStatus('출발지 설정 오류: ' + err.message, true);
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    setOriginStatus('이 브라우저는 현재 위치를 지원하지 않습니다.', true);
    return;
  }
  setOriginStatus('현재 위치 확인 중...');
  navigator.geolocation.getCurrentPosition(
    pos => {
      document.getElementById('originAddress').value = '현재 위치';
      applyOrigin(pos.coords.longitude, pos.coords.latitude, '현재 위치');
    },
    err => setOriginStatus('현재 위치를 가져오지 못했습니다: ' + err.message, true),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function setupOriginInput() {
  const input = document.getElementById('originAddress');
  const box = document.getElementById('originSuggest');
  if (!input || !box) return;
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { hideOriginSuggestions(); return; }
    timer = setTimeout(async () => {
      try { showOriginSuggestions(await fetchCandidates(q)); } catch (e) { /* 입력 중 오류는 무시 */ }
    }, 300);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); setOrigin(); }
    if (e.key === 'Escape') hideOriginSuggestions();
  });
  box.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    const c = originCandidates[Number(li.dataset.i)];
    input.value = c.name;
    applyOrigin(c.x, c.y, c.name);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#originAddress, #originSuggest')) hideOriginSuggestions();
  });
}

async function showNearbyRestaurants() {
  if (!originCoords) {
    alert('먼저 출발지를 설정하세요.');
    return;
  }
  const { x, y } = originCoords;
  console.log('showNearbyRestaurants: originCoords=', x, y);
  const url = `/api/restaurants/nearby?x=${x}&y=${y}&radius=2000`;
  console.log('calling fetch URL:', url);
  try {
    const nearbyRes = await fetch(url);
    console.log('fetch 응답 status:', nearbyRes.status);
    if (!nearbyRes.ok) {
      console.error('API 응답 오류 상태:', nearbyRes.status);
      throw new Error(`API 응답 상태 ${nearbyRes.status}`);
    }
    const restaurantList = await nearbyRes.json();
    console.log('받은 restaurantList 전체:', restaurantList);
    console.log('Array.isArray:', Array.isArray(restaurantList), 'length:', Array.isArray(restaurantList)? restaurantList.length : '-');
    if (!Array.isArray(restaurantList) || restaurantList.length === 0) {
      console.warn('restaurantList가 배열이 아니거나 빈 배열입니다.');
      alert('반경 2km 안에 등록된 맛집이 없습니다.');
    }
    clearMarkers();
    const originLatLng = new kakao.maps.LatLng(y, x);
    addSimpleMarker(originLatLng, '출발지');
    restaurantList.forEach(item => {
      const lat = parseFloat(item.lat ?? item.LAT ?? item.RSTR_LA);
      const lon = parseFloat(item.lng ?? item.LNG ?? item.RSTR_LO);
      if (!isNaN(lat) && !isNaN(lon)) {
        const latlng = new kakao.maps.LatLng(lat, lon);
        const title = item.name || item.MAIN_TITLE || item.RSTR_NM || '맛집';
        addRestaurantMarker(latlng, title, item);
      } else {
        console.warn('유효하지 않은 좌표 아이템:', item);
      }
    });
  } catch (err) {
    console.error('주변 맛집 조회 중 오류:', err);
    alert('주변 맛집 조회 오류: ' + err.message);
  }
}


async function applyFilter() {
  if (!originCoords) {
    alert('먼저 출발지를 설정하세요.');
    return;
  }
  const category = document.getElementById('categorySelect').value;
  const price = document.getElementById('priceSelect').value;
  try {
    const url = new URL('/api/restaurants/filter', window.location.origin);
    url.searchParams.append('x', originCoords.x);
    url.searchParams.append('y', originCoords.y);
    url.searchParams.append('radius', 2000);
    if (category) url.searchParams.append('category', category);
    if (price) url.searchParams.append('price', price);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API 응답 상태 ${res.status}`);
    const data = await res.json();
    clearMarkers();
    // 출발지 재표시
    const originLatLng = new kakao.maps.LatLng(originCoords.y, originCoords.x);
    addSimpleMarker(originLatLng, '출발지');
    if (data.length === 0) {
      alert('조건에 맞는 맛집이 없습니다. (가격대 선택 시 메뉴에 가격 정보가 없는 가게는 제외됩니다)');
    }
    data.forEach(item => {
      const lat = parseFloat(item.lat ?? item.LAT ?? item.RSTR_LA);
      const lon = parseFloat(item.lng ?? item.LNG ?? item.RSTR_LO);
      if (!isNaN(lat) && !isNaN(lon)) {
        const latlng = new kakao.maps.LatLng(lat, lon);
        const title = item.name || item.MAIN_TITLE || item.RSTR_NM || '맛집';
        addRestaurantMarker(latlng, title, item);
      }
    });
  } catch (err) {
    console.error(err);
    alert('필터 적용 오류: ' + err.message);
  }
}

async function fetchRouteAndDraw(originCoords, destCoords, destName) {
  const body = {
    origin: originCoords,
    destination: destCoords,
    destinationName: destName,
    preferences: { modePreference: 'auto' }
  };
  const res = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`경로 API 오류: ${res.status} ${errText}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }
  const options = data.options || [data];
  const transitError = data.transitError;
  const best = options.reduce((a, b) => (b.totalTime < a.totalTime ? b : a));
  return { ...best, options, transitError };
}

const SEG_STYLE = {
  walk:   { color: '#16a34a', label: '도보',   dash: 'shortdash' },
  bus:    { color: '#2563eb', label: '버스',   dash: 'solid' },
  subway: { color: '#ea580c', label: '지하철', dash: 'solid' },
};

function clearRouteOverlays() {
  if (currentPolyline) { currentPolyline.setMap(null); currentPolyline = null; }
  currentPolylines.forEach(p => p.setMap(null));
  currentPolylines = [];
  currentRouteMarkers.forEach(m => m.setMap(null));
  currentRouteMarkers = [];
}

const MODE_STYLE = {
  walk:     { label: '🚶 도보',               color: '#16a34a' },
  transit:  { label: '🚌🚇 대중교통(버스/지하철)', color: '#2563eb' },
  estimate: { label: '직선거리 추정',          color: '#6b7280' },
};

function drawRouteOnMap(originCoords, destCoords, routeData) {
  clearRouteOverlays();
  const originLatLng = new kakao.maps.LatLng(originCoords.y, originCoords.x);
  const destLatLng = new kakao.maps.LatLng(destCoords.y, destCoords.x);
  const style = MODE_STYLE[routeData.mode] || MODE_STYLE.estimate;
  // 구간별로 색을 달리해서 그린다 (도보 초록 점선 / 버스 파랑 / 지하철 주황)
  const segments = (routeData.segments && routeData.segments.length)
    ? routeData.segments
    : [{ type: routeData.mode === 'transit' ? 'bus' : 'walk', path: routeData.polyline }];
  const segPaths = [];
  segments.forEach(seg => {
    const pts = (seg.path && seg.path.length > 1)
      ? seg.path.map(p => new kakao.maps.LatLng(p.y, p.x)) : null;
    if (!pts) { segPaths.push(null); return; }
    const ss = SEG_STYLE[seg.type] || { color: style.color, dash: 'solid' };
    // 흰색 테두리로 선이 지도 위에서 잘 보이게
    currentPolylines.push(new kakao.maps.Polyline({
      map, path: pts, strokeWeight: 9, strokeColor: '#ffffff', strokeOpacity: 0.9, zIndex: 1 }));
    currentPolylines.push(new kakao.maps.Polyline({
      map, path: pts, strokeWeight: 5, strokeColor: ss.color, strokeOpacity: 0.95,
      strokeStyle: routeData.mode === 'estimate' ? 'shortdash' : ss.dash, zIndex: 2 }));
    segPaths.push(pts);
    // 대중교통 승·하차 지점 표시
    if (seg.type !== 'walk') {
      [pts[0], pts[pts.length - 1]].forEach(pos => {
        currentRouteMarkers.push(new kakao.maps.CustomOverlay({
          map, position: pos, yAnchor: 0.5, xAnchor: 0.5, zIndex: 3,
          content: `<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid ${ss.color};"></div>`
        }));
      });
    }
  });
  const linePath = segPaths.some(Boolean)
    ? segPaths.filter(Boolean).flat()
    : [originLatLng, destLatLng];
  if (!segPaths.some(Boolean)) {
    currentPolylines.push(new kakao.maps.Polyline({
      map, path: linePath, strokeWeight: 5, strokeColor: style.color, strokeOpacity: 0.8,
      strokeStyle: 'shortdash' }));
  }

  const options = routeData.options || [routeData];
  const bestTime = Math.min(...options.map(o => o.totalTime));
  const d = routeData.details || {};
  const icon = { bus: '🚌', subway: '🚇', walk: '🚶' };

  // ---- 경로 안내 카드 ----
  const fmtDist = m => (m == null || isNaN(m)) ? '' : (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);
  const stepColor = { bus: '#2563eb', subway: '#ea580c', walk: '#16a34a' };
  const totalMin = Math.round(routeData.totalTime);
  const transferCnt = d.busTransitCount != null
    ? Math.max(0, (d.busTransitCount || 0) + (d.subwayTransitCount || 0) - 1) : null;
  const totalDist = d.totalDistanceM ?? d.distanceM;

  // 요약 칩
  const chips = [];
  if (d.payment) chips.push(`<span class="chip">💳 ${Number(d.payment).toLocaleString()}원</span>`);
  if (transferCnt != null) chips.push(`<span class="chip">🔁 환승 ${transferCnt}회</span>`);
  if (totalDist) chips.push(`<span class="chip">📏 ${fmtDist(totalDist)}</span>`);

  // 구간별 타임라인
  let stepsHtml = '';
  if (routeData.mode === 'transit' && Array.isArray(d.steps)) {
    const items = d.steps.map((st, si) => {
      const c = stepColor[st.type] || '#6b7280';
      if (st.type === 'walk') {
        return `<li style="--c:${c}" class="step-click" data-seg="${si}">
          <div class="step-title">${icon.walk} 도보 <b>${st.minutes}분</b>
            <span class="step-meta">${fmtDist(st.distanceM)}</span></div>
        </li>`;
      }
      const kind = st.type === 'bus' ? '버스' : '지하철';
      return `<li style="--c:${c}" class="step-click" data-seg="${si}">
        <div class="step-title">${icon[st.type] || ''} ${kind}
          <span class="line-badge" style="background:${c}">${escapeHtml(st.line || '')}</span>
          <b>${st.minutes}분</b>
          ${st.stationCount != null ? `<span class="step-meta">${st.stationCount}정거장</span>` : ''}</div>
        <div class="step-route">${escapeHtml(st.from)} <span>→</span> ${escapeHtml(st.to)}</div>
      </li>`;
    });
    stepsHtml = `<ol class="route-steps">
      <li style="--c:#9ca3af"><div class="step-title step-end">📍 출발지</div></li>
      ${items.join('')}
      <li style="--c:#9ca3af"><div class="step-title step-end">🏁 도착지</div></li>
    </ol>`;
  } else if (routeData.mode === 'walk') {
    stepsHtml = `<p class="walk-note">🚶 총 <b>${fmtDist(d.distanceM)}</b>를 걸어서 이동합니다.
      ${d.note ? `<span>(${escapeHtml(d.note)})</span>` : ''}</p>`;
  }

  // 경로 비교 탭
  const optBtns = options.length > 1 ? `<div class="route-tabs">${options.map((o, i) => {
    const st = MODE_STYLE[o.mode] || MODE_STYLE.estimate;
    const isBest = o.totalTime === bestTime;
    const active = o.mode === routeData.mode;
    return `<button data-opt="${i}" class="route-tab${active ? ' active' : ''}" style="--c:${st.color}">
      ${st.label} <b>${Math.round(o.totalTime)}분</b>${isBest ? ' <span class="best">⭐ 최적</span>' : ''}</button>`;
  }).join('')}</div>` : '';

  const transitNote = routeData.transitError
    ? `<p class="route-warn">⚠ 대중교통 경로를 불러오지 못했습니다: ${escapeHtml(routeData.transitError)}
       ${/HTTP 40[13]|미설정/.test(routeData.transitError) ? '<br>→ .env의 TMAP_APP_KEY와 TMAP 대중교통 상품 사용 신청 여부를 확인하세요.' : ''}</p>` : '';

  // 상세 정보 (JSON 대신 표)
  const detailRows = [
    ['총 이동 거리', totalDist ? fmtDist(totalDist) : ''],
    ['버스 승차', d.busTransitCount != null ? `${d.busTransitCount}회` : ''],
    ['지하철 승차', d.subwayTransitCount != null ? `${d.subwayTransitCount}회` : ''],
    ['최초 승차역', d.firstStartStation || ''],
    ['최종 하차역', d.lastEndStation || ''],
  ].filter(r => r[1]);
  const detailHtml = detailRows.length ? `<details class="route-detail">
      <summary>상세 정보 보기</summary>
      <table>${detailRows.map(r => `<tr><th>${r[0]}</th><td>${escapeHtml(String(r[1]))}</td></tr>`).join('')}</table>
    </details>` : '';

  const infoDiv = document.getElementById('routeInfo');
  infoDiv.innerHTML = `
    <h3 class="route-heading">경로 안내 결과</h3>
    ${optBtns}
    <div class="route-summary" style="--c:${style.color}">
      <div class="route-mode">${style.label}</div>
      <div class="route-time">${totalMin}<small>분</small></div>
      <div class="chips">${chips.join('')}</div>
    </div>
    <div class="map-legend">
      ${['walk','bus','subway'].map(t => `<span><i style="background:${SEG_STYLE[t].color}"></i>${SEG_STYLE[t].label}</span>`).join('')}
    </div>
    ${stepsHtml}
    ${transitNote}
    ${detailHtml}
  `;
  // 구간을 클릭하면 해당 구간으로 지도 이동
  infoDiv.querySelectorAll('li[data-seg]').forEach(li => {
    li.addEventListener('click', () => {
      const pts = segPaths[Number(li.dataset.seg)];
      if (!pts) return;
      const b = new kakao.maps.LatLngBounds();
      pts.forEach(p => b.extend(p));
      autoSearchPausedUntil = Date.now() + 2000;
      map.setBounds(b);
    });
  });
  infoDiv.querySelectorAll('button[data-opt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const o = options[Number(btn.dataset.opt)];
      drawRouteOnMap(originCoords, destCoords, { ...o, options, transitError: routeData.transitError });
    });
  });

  autoSearchPausedUntil = Date.now() + 2000;
  const bounds = new kakao.maps.LatLngBounds();
  linePath.forEach(p => bounds.extend(p));
  bounds.extend(originLatLng);
  bounds.extend(destLatLng);
  map.setBounds(bounds);
}

window.onload = () => {
  initMap();
  const setBtn = document.getElementById('setOriginBtn');
  if (setBtn) setBtn.addEventListener('click', setOrigin);
  document.getElementById('useLocationBtn')?.addEventListener('click', useCurrentLocation);
  setupOriginInput();
  const showBtn = document.getElementById('showRestaurantsBtn');
  if (showBtn) showBtn.addEventListener('click', showNearbyRestaurants);
  document.getElementById('filterBtn')?.addEventListener('click', applyFilter);
  document.getElementById('viewportBtn')?.addEventListener('click', () => searchInViewport(false));
  document.getElementById('autoViewport')?.addEventListener('change', e => { if (e.target.checked) searchInViewport(true); });
  setupViewportAutoSearch();
};
