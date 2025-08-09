// app.js (메인 서버 파일)

import 'dotenv/config';
import express from 'express';
import geminiRouter from './routes/gemini.js';
import indexRoutes from './routes/index.js';

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs')
app.use(express.json());
app.use('/gemini', geminiRouter);
app.use('/', indexRoutes);

// 404 Not Found 처리 미들웨어 (모든 라우트 뒤에 위치)
app.use((req, res, next) => {
  const error = new Error(`요청된 경로를 찾을 수 없습니다: ${req.originalUrl}`);
  error.status = 404;
  next(error);
});

// 일반 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    error: {
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : error.stack
    }
  });
});

export default app;