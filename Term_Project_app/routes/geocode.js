// routes/geocode.js
import express from 'express';
import { geocodeAddress } from '../utils/geocode.js';

const router = express.Router();

/**
 * GET /api/geocode?address=...
 * 요청: 쿼리스트링으로 address 파라미터 전달
 * 응답: { x: 경도, y: 위도 } (숫자형)
 */
router.get('/', async (req, res) => {
  try {
    const address = req.query.address;
    if (!address) {
      return res.status(400).json({ error: 'address 쿼리 파라미터 필요' });
    }
    const coords = await geocodeAddress(address);
    return res.json(coords);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Geocoding 실패', details: err.message });
  }
});

export default router;
