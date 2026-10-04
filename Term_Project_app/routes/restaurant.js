// routes/restaurant.js
import express from 'express';
import { fetchNearbyFoodService, fetchFoodInBounds, fetchNearbyFoodieService, matchesCategory, matchesPrice, extractMinPrice } from '../utils/foodService.js';

const router = express.Router();

/**
 * GET /api/restaurants/nearby?x=경도&y=위도&radius=반경(미터)
 * 주변 부산맛집정보 서비스 API 호출
 */
router.get('/nearby', async (req, res) => {
   console.log('[restaurant] /nearby:', req.query)
  try {
    const { x, y, radius } = req.query;
    console.log('[restaurant] /nearby 호출, req.query=', req.query);
    if (!x || !y) {
      return res.status(400).json({ error: 'x, y 쿼리 필요' });
    }
    const lon = Number(x), lat = Number(y);
    if (isNaN(lon) || isNaN(lat)) {
      return res.status(400).json({ error: '유효하지 않은 x,y 값' });
    }
    const r = radius ? Number(radius) : undefined;
    const list = await fetchNearbyFoodService(lon, lat, r);

    // 콘솔에 길이와 일부 항목만 찍기
    if (Array.isArray(list)) {
      console.log(`[restaurant] fetchNearbyFoodService 결과 개수: ${list.length}`);
      const sample = list.slice(0, 5); // 처음 5개 항목 예시
      console.log('[restaurant] 결과:', sample.map(i => i.name).join(', '));
    } else {
      console.log('[restaurant] fetchNearbyFoodService 반환값이 배열이 아님:', list);
    }

    return res.json(list);
  } catch (err) {
    console.error('[restaurant] 주변 맛집 조회 실패:', err);
    return res.status(500).json({ error: '주변 맛집 조회 실패', details: err.message });
  }
});

/**
 * GET /api/restaurants/foodie?x=경도&y=위도&radius=반경(미터)
 * 주변 부산푸디투어정보 서비스 API 호출 (추천 정보 강조)
 */
router.get('/foodie', async (req, res) => {
  try {
    const { x, y, radius } = req.query;
    console.log('[restaurant] /foodie 호출, req.query=', req.query);
    if (!x || !y) {
      return res.status(400).json({ error: 'x, y 쿼리 필요' });
    }
    const lon = Number(x), lat = Number(y);
    if (isNaN(lon) || isNaN(lat)) {
      return res.status(400).json({ error: '유효하지 않은 x,y 값' });
    }
    const r = radius ? Number(radius) : undefined;
    const list = await fetchNearbyFoodieService(lon, lat, r);

    // 콘솔에 길이와 일부 항목만 찍기
    if (Array.isArray(list)) {
      console.log(`[restaurant] fetchNearbyFoodieService 결과 개수: ${list.length}`);
      const sample = list.slice(0, 5);
      console.log('[restaurant] foodie 결과 예시(최대 5개):', sample);
    } else {
      console.log('[restaurant] fetchNearbyFoodieService 반환값이 배열이 아님:', list);
    }

    return res.json(list);
  } catch (err) {
    console.error('[restaurant] 부산푸디투어정보 조회 실패:', err);
    return res.status(500).json({ error: '부산푸디투어정보 조회 실패', details: err.message });
  }
});

/**
 * GET /api/restaurants/filter?category=한식&price=중&x=경도&y=위도
 */
router.get('/filter', async (req, res) => {
  try {
    const { x, y, category, price, radius } = req.query;
    console.log('[restaurant] /filter 호출, req.query=', req.query);
    if (!x || !y) {
      return res.status(400).json({ error: 'x, y 쿼리 필요' });
    }
    const lon = Number(x), lat = Number(y);
    if (isNaN(lon) || isNaN(lat)) {
      return res.status(400).json({ error: '유효하지 않은 x,y 값' });
    }
    // 1) 주변 전체 리스트 가져오기
    const list = await fetchNearbyFoodService(lon, lat, radius ? Number(radius) : 2000);
    console.log(`[restaurant] filter 전 전체 리스트 개수: ${Array.isArray(list)? list.length : 'not array'}`);
    let filtered = list;
    if (category) {
      filtered = filtered.filter(item => matchesCategory(item, category));
      console.log(`[restaurant] category 필터(${category}) 후 개수: ${filtered.length}`);
    }
    if (price) {
      filtered = filtered.filter(item => matchesPrice(item, price));
      console.log(`[restaurant] price 필터(${price}) 후 개수: ${filtered.length}`);
    }
    filtered = filtered.map(item => ({ ...item, minPrice: extractMinPrice(item) }));
    // 일부 샘플 항목 출력
    if (Array.isArray(filtered)) {
      console.log('[restaurant] filter 결과:', filtered.map(i => i.name).join(', '));
    }
    return res.json(filtered);
  } catch (err) {
    console.error('[restaurant] 필터링 실패:', err);
    return res.status(500).json({ error: '필터링 실패', details: err.message });
  }
});

/**
 * GET /api/restaurants/bounds?swLat=&swLng=&neLat=&neLng=&category=&price=
 * 지도에 보이는 영역(남서/북동 좌표) 안의 맛집 (+ 음식 종류/가격대 필터)
 */
router.get('/bounds', async (req, res) => {
  try {
    const swLat = Number(req.query.swLat), swLng = Number(req.query.swLng);
    const neLat = Number(req.query.neLat), neLng = Number(req.query.neLng);
    if ([swLat, swLng, neLat, neLng].some(v => isNaN(v))) {
      return res.status(400).json({ error: 'swLat, swLng, neLat, neLng 숫자 필요' });
    }
    const { category, price } = req.query;
    let list = await fetchFoodInBounds({ swLat, swLng, neLat, neLng });
    if (category) list = list.filter(it => matchesCategory(it, category));
    if (price) list = list.filter(it => matchesPrice(it, price));
    list = list.map(it => ({ ...it, minPrice: extractMinPrice(it) }));
    console.log(`[restaurant] /bounds 결과 ${list.length}곳 (category=${category || '-'}, price=${price || '-'})`);
    return res.json(list);
  } catch (err) {
    console.error('[restaurant] 화면 영역 검색 실패:', err);
    return res.status(500).json({ error: '화면 영역 검색 실패', details: err.message });
  }
});

export default router;
