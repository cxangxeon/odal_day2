// routes/route.js
import express from 'express';
import { planOptimalRoute } from '../utils/routeService.js';

const router = express.Router();

/**
 * POST /api/route
 * 요청 바디 예시:
 * {
 *   "origin": { "x": 128.97, "y": 35.16 },
 *   "destination": { "x": 128.99, "y": 35.17 },
 *   "preferences": {
 *      // 선택 사항: 버스 우선/지하철 우선/비용 고려 등
 *   }
 * }
 * 응답: {
 *   mode: "bus" or "subway",
 *   estimatedTime: 분 단위 혹은 초 단위,
 *   details: [구체적인 경로 단계 정보]
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { origin, destination, preferences } = req.body;
    if (!origin || !destination || origin.x == null || origin.y == null || destination.x == null || destination.y == null) {
      return res.status(400).json({ error: 'origin, destination 좌표 필요' });
    }
    const result = await planOptimalRoute(origin, destination, preferences);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '경로 계획 실패', details: err.message });
  }
});

export default router;
