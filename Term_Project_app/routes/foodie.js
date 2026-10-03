// routes/foodie.js
import express from 'express';
import { fetchNearbyFoodieService } from '../utils/foodService.js';

const router = express.Router();

/**
 * GET /api/foodie/nearby?x=경도&y=위도&radius=반경
 */
router.get('/nearby', async (req, res) => {
  try {
    const { x, y, radius } = req.query;
    if (!x || !y) {
      return res.status(400).json({ error: 'x, y 쿼리 필요' });
    }
    const list = await fetchNearbyFoodieService(Number(x), Number(y), radius ? Number(radius) : undefined);
    return res.json(list);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '주변 Foodie 조회 실패', details: err.message });
  }
});

export default router;
