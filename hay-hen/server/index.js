import express from "express";
import cors from "cors";
import { fetchGameData, GAME_CONFIG } from "./common.js";

const app = express();
const PORT = 4000;

const allowedOrigins = [
  "https://www.minhngoc.net.vn",
  "http://localhost:4000",
  "http://localhost:5173",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
};

app.use(cors(corsOptions));

const cache = new Map();

app.get(`/api/health`, (_, res) => {
  res.json({ ok: true });
});

app.get(`/api/vietlott/jackpot-winners`, async (_, res) => {
  try {
    const [game645, game655] = await Promise.all([
      fetchGameData("6-45", cache),
      fetchGameData("6-55", cache),
    ]);

    const jackpotDraws = [
      ...game645.draws.map((draw) => ({ ...draw, game: "6-45" })),
      ...game655.draws.map((draw) => ({ ...draw, game: "6-55" })),
    ]
      .filter((draw) => draw.hasJackpotWinner)
      .sort((a, b) => Number(b.drawCode) - Number(a.drawCode));

    res.json({
      sourceBaseUrl: "https://www.minhngoc.net.vn",
      fetchedAt: new Date().toISOString(),
      total: jackpotDraws.length,
      draws: jackpotDraws,
    });
  } catch (error) {
    res.status(500).json({
      message: "Không thể lấy thống kê jackpot.",
      details: error?.message ?? "Unknown error",
    });
  }
});

app.get(`/api/vietlott/:game`, async (req, res) => {
  try {
    const { game } = req.params;
    const validGames = Object.keys(GAME_CONFIG);
    if (!validGames.includes(game)) {
      return res.status(400).json({
        message: "Game không hợp lệ. Chỉ chấp nhận: 6-45, 6-55",
      });
    }

    const data = await fetchGameData(game, cache);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: "Không thể lấy dữ liệu Vietlott.",
      details: error?.message ?? "Unknown error",
    });
  }
});

export default app;

if (globalThis.process?.env?.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server API đang chạy tại http://localhost:${PORT}`);
    console.log(`Nguồn dữ liệu: https://www.minhngoc.net.vn`);
  });
}
