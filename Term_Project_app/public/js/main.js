let map;
let currentMarkers = [];
let originCoords = null;
let destCoords = null;
let currentPolyline = null;

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
  if (currentPolyline) {
    currentPolyline.setMap(null);
    currentPolyline = null;
  }
}

function addSimpleMarker(latlng, title) {
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
    content: `<div style="padding:5px;">${title}<br>클릭하여 이곳으로 경로 안내</div>`
  });
  kakao.maps.event.addListener(marker, 'mouseover', function() {
    infowindow.open(map, marker);
  });
  kakao.maps.event.addListener(marker, 'mouseout', function() {
    infowindow.close();
  });
}

async function setOrigin() {
  const addr = document.getElementById('originAddress').value.trim();
  if (!addr) {
    alert('출발지 주소를 입력하세요.');
    return;
  }
  try {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`);
    if (!res.ok) {
      throw new Error(`Geocode API 응답 상태 ${res.status}`);
    }
    const data = await res.json();
    if (data.error) {
      alert('출발지 변환 실패: ' + data.error);
      return;
    }
    originCoords = { x: data.y, y: data.x };
    clearMarkers();
    const originLatLng = new kakao.maps.LatLng(originCoords.y, originCoords.x);
    addSimpleMarker(originLatLng, '출발지');
    map.setCenter(originLatLng);
    alert(`출발지 설정됨: (${data.x.toFixed(6)}, ${data.y.toFixed(6)})`);
  } catch (err) {
    console.error(err);
    alert('출발지 설정 오류: ' + err.message);
  }
}

async function showNearbyRestaurants() {
  if (!originCoords) {
    alert('먼저 출발지를 설정하세요.');
    return;
  }
  const { x, y } = originCoords;
  console.log('showNearbyRestaurants: originCoords=', x, y);
  const url = `/api/restaurants/nearby?x=${x}&y=${y}&radius=1000`;
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
    }
    clearMarkers();
    const originLatLng = new kakao.maps.LatLng(y, x);
    addSimpleMarker(originLatLng, '출발지');
    restaurantList.forEach(item => {
      const lat = parseFloat(item.RSTR_LA);
      const lon = parseFloat(item.RSTR_LO);
      if (!isNaN(lat) && !isNaN(lon)) {
        const latlng = new kakao.maps.LatLng(lat, lon);
        const title = item.RSTR_NM || '맛집';
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
    if (category) url.searchParams.append('category', category);
    if (price) url.searchParams.append('price', price);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API 응답 상태 ${res.status}`);
    const data = await res.json();
    clearMarkers();
    // 출발지 재표시
    const originLatLng = new kakao.maps.LatLng(originCoords.y, originCoords.x);
    addSimpleMarker(originLatLng, '출발지');
    data.forEach(item => {
      const lat = parseFloat(item.RSTR_LA);
      const lon = parseFloat(item.RSTR_LO);
      if (!isNaN(lat) && !isNaN(lon)) {
        const latlng = new kakao.maps.LatLng(lat, lon);
        const title = item.RSTR_NM || '맛집';
        addRestaurantMarker(latlng, title, item);
      }
    });
  } catch (err) {
    console.error(err);
    alert('필터 적용 오류: ' + err.message);
  }
}

async function showNearbyFoodie() {
  if (!originCoords) {
    alert('먼저 출발지를 설정하세요.');
    return;
  }
  try {
    const url = new URL('/api/foodie/nearby', window.location.origin);
    url.searchParams.append('x', originCoords.x);
    url.searchParams.append('y', originCoords.y);
    url.searchParams.append('radius', 1000);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API 응답 상태 ${res.status}`);
    const data = await res.json();
    clearMarkers();
    const originLatLng = new kakao.maps.LatLng(originCoords.y, originCoords.x);
    addSimpleMarker(originLatLng, '출발지');
    data.forEach(item => {
      const lat = parseFloat(item.LAT || item.RSTR_LA || 0);
      const lon = parseFloat(item.LNG || item.RSTR_LO || 0);
      if (!isNaN(lat) && !isNaN(lon)) {
        const latlng = new kakao.maps.LatLng(lat, lon);
        const title = item.MAIN_TITLE || item.RSTR_NM || '추천 장소';
        addRestaurantMarker(latlng, title, item);
      }
    });
  } catch (err) {
    console.error(err);
    alert('주변 길거리 음식/카페 조회 오류: ' + err.message);
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
  return data;
}

function drawRouteOnMap(originCoords, destCoords, routeData) {
  if (currentPolyline) {
    currentPolyline.setMap(null);
    currentPolyline = null;
  }
  const originLatLng = new kakao.maps.LatLng(originCoords.y, originCoords.x);
  const destLatLng = new kakao.maps.LatLng(destCoords.y, destCoords.x);
  const linePath = [ originLatLng, destLatLng ];
  const polyline = new kakao.maps.Polyline({
    map: map,
    path: linePath,
    strokeWeight: 5,
    strokeColor: routeData.mode === 'bus' ? '#FF0000' : '#0000FF',
    strokeOpacity: 0.7,
    strokeStyle: 'solid'
  });
  currentPolyline = polyline;

  const infoDiv = document.getElementById('routeInfo');
  infoDiv.innerHTML = `
    <h3>경로 안내 결과</h3>
    <p>도착지: ${routeData.mode === 'bus' ? '버스' : '지하철'} 경로 선택</p>
    <p>예상 소요시간: <strong>${Math.round(routeData.totalTime)} 분</strong></p>
    <details style="white-space:pre-wrap;"><summary>상세 정보 보기</summary>${JSON.stringify(routeData.details, null, 2)}</details>
  `;

  const bounds = new kakao.maps.LatLngBounds();
  bounds.extend(originLatLng);
  bounds.extend(destLatLng);
  map.setBounds(bounds);
}

window.onload = () => {
  initMap();
  const setBtn = document.getElementById('setOriginBtn');
  if (setBtn) setBtn.addEventListener('click', setOrigin);
  const showBtn = document.getElementById('showRestaurantsBtn');
  if (showBtn) showBtn.addEventListener('click', showNearbyRestaurants);
  document.getElementById('filterBtn')?.addEventListener('click', applyFilter);
  document.getElementById('showFoodieBtn')?.addEventListener('click', showNearbyFoodie);
};
