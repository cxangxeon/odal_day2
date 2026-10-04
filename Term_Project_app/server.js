// server.js
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module 환경일 때 __dirname 사용법
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// 정적 파일 서빙: public 폴더
app.use(express.static(path.join(__dirname, 'public')));

// JSON 바디 파싱 (필요 시)
app.use(express.json());


// 라우트 불러오기
import geocodeRouter from './routes/geocode.js';
import restaurantRouter from './routes/restaurant.js';
import routeRouter from './routes/route.js';

// 라우트 마운트
app.use('/api/geocode', geocodeRouter);
app.use('/api/restaurants', restaurantRouter);
app.use('/api/route', routeRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Vercel 배포용: 서버리스 함수로 앱을 내보낸다 (로컬 npm start는 위 listen 그대로 사용)
export default app;
