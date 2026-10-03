// routes/restaurant.js
import express from 'express';
import { fetchNearbyFoodService, fetchNearbyFoodieService } from '../utils/foodService.js';

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
      console.log('[restaurant] 결과 예시(최대 5개):', sample);
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
    const { x, y, category, price } = req.query;
    console.log('[restaurant] /filter 호출, req.query=', req.query);
    if (!x || !y) {
      return res.status(400).json({ error: 'x, y 쿼리 필요' });
    }
    const lon = Number(x), lat = Number(y);
    if (isNaN(lon) || isNaN(lat)) {
      return res.status(400).json({ error: '유효하지 않은 x,y 값' });
    }
    // 1) 주변 전체 리스트 가져오기
    const list = await fetchNearbyFoodService(lon, lat);
    console.log(`[restaurant] filter 전 전체 리스트 개수: ${Array.isArray(list)? list.length : 'not array'}`);
    let filtered = list;
    if (category) {
      filtered = filtered.filter(item => {
        return item.BSNS_STATM_BZCND_NM && item.BSNS_STATM_BZCND_NM.includes(category);
      });
      console.log(`[restaurant] category 필터(${category}) 후 개수: ${filtered.length}`);
    }
    // price 필터링 로직이 있으면 추가, 현재는 예시 생략
    // if (price) { ... }
    // 일부 샘플 항목 출력
    if (Array.isArray(filtered)) {
      console.log('[restaurant] filter 결과 예시(최대 5개):', filtered.slice(0,5));
    }
    return res.json(filtered);
  } catch (err) {
    console.error('[restaurant] 필터링 실패:', err);
    return res.status(500).json({ error: '필터링 실패', details: err.message });
  }
});

export default router;
