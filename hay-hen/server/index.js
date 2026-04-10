import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = 4000;

const SOURCE_BASE = "https://www.minhngoc.net.vn";

const allowedOrigins = [
  "https://www.minhngoc.net.vn",
  "http://localhost:4000",
  "http://localhost:3000",
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
const CACHE_TTL_MS = 10 * 60 * 1000;

const GAME_CONFIG = {
  "6-45": {
    pagePath: "/ket-qua-xo-so/dien-toan-vietlott/mega-6x45.html",
    maxNumber: 45,
    pickCount: 6,
  },
  "6-55": {
    pagePath: "/ket-qua-xo-so/dien-toan-vietlott/power-6x55.html",
    maxNumber: 55,
    pickCount: 6,
  },
};

const http = axios.create({
  baseURL: SOURCE_BASE,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: `${SOURCE_BASE}/`,
  },
  timeout: 20000,
});

function parseIntSafe(value) {
  const number = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isNaN(number) ? 0 : number;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return dateStr;
  return `${match[1]}/${match[2]}/${match[3]}`;
}

function buildSuggestions(draws, maxNumber, pickCount, recentDrawCount) {
  const slice = draws.slice(0, recentDrawCount);
  const frequencyMap = new Map();

  slice.forEach((draw) => {
    draw.numbers.slice(0, pickCount).forEach((num) => {
      frequencyMap.set(num, (frequencyMap.get(num) ?? 0) + 1);
    });
  });

  const suggested = Array.from({ length: maxNumber }, (_, index) => index + 1)
    .map((num) => ({
      number: num,
      frequency: frequencyMap.get(num) ?? 0,
    }))
    .sort((a, b) => {
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return a.number - b.number;
    })
    .slice(0, pickCount)
    .map((item) => item.number)
    .sort((a, b) => a - b);

  return {
    baseOn: Math.min(slice.length, recentDrawCount),
    numbers: suggested,
  };
}

async function fetchGameData(gameKey) {
  const cached = cache.get(gameKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const game = GAME_CONFIG[gameKey];
  if (!game) throw new Error("Game không hợp lệ.");

  let mainHtml;
  try {
    const response = await http.get(game.pagePath);
    mainHtml = response.data;
  } catch (err) {
    throw new Error(`Không thể truy cập minhngoc.net.vn: ${err.message}`);
  }

  const $ = cheerio.load(mainHtml);
  const draws = [];

  $("h3, h4, h5").each((_, heading) => {
    const headingText = $(heading).text().trim();
    if (!headingText.includes("MEGA 6/45") && !headingText.includes("POWER 6/55")) return;

    let drawCode = "";
    let dateStr = "";

    const dateMatch = headingText.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) dateStr = dateMatch[1];

    const kqMatch = headingText.match(/KỲ VÉ[:\s#]*(\d+)/i);
    if (kqMatch) drawCode = kqMatch[1];

    let numbers = [];
    let jackpotWinners = [];

    const table = $(heading).next("table");
    if (table.length) {
      table.find("tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 2) return;
        const label = cells.eq(0).text().trim().toLowerCase();

        if (label.includes("jackpot")) {
          const winners =
            cells.length >= 3
              ? parseIntSafe(cells.eq(cells.length - 2).text())
              : parseIntSafe(cells.last().text());
          if (winners > 0) jackpotWinners.push(winners);
          return;
        }

        const numStr = cells.last().text().trim();
        const nums = numStr
          .replace(/[^0-9\s]/g, " ")
          .split(/\s+/)
          .map((s) => parseIntSafe(s))
          .filter(Boolean);

        if (nums.length >= 5) {
          const seen = new Set(numbers);
          for (const n of nums) {
            if (!seen.has(n)) {
              seen.add(n);
              numbers.push(n);
            }
          }
        }
      });
    }

    if (numbers.length >= game.pickCount && drawCode) {
      draws.push({
        drawCode,
        date: formatDate(dateStr),
        numbers: numbers.slice(0, game.pickCount),
        jackpotWinners,
        hasJackpotWinner: jackpotWinners.some((w) => w > 0),
      });
    }
  });

  if (draws.length === 0) {
    $("h3, h4").each((_, heading) => {
      const headingText = $(heading).text().trim();
      if (!headingText.includes("KẾT QUẢ")) return;

      const dateMatch = headingText.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (!dateMatch) return;

      let drawCode = "";
      const kqMatch = headingText.match(/KỲ VÉ[:\s#]*(\d+)/i);
      if (kqMatch) drawCode = kqMatch[1];

      let numbers = [];
      let jackpotWinners = [];

      const table = $(heading).next("table");
      if (table.length) {
        table.find("tr").each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length < 2) return;
          const label = cells.eq(0).text().trim().toLowerCase();

          if (label.includes("jackpot")) {
            const winners =
              cells.length >= 3
                ? parseIntSafe(cells.eq(cells.length - 2).text())
                : parseIntSafe(cells.last().text());
            if (winners > 0) jackpotWinners.push(winners);
            return;
          }

          const numStr = cells.last().text().trim();
          const nums = numStr
            .replace(/[^0-9\s]/g, " ")
            .split(/\s+/)
            .map((s) => parseIntSafe(s))
            .filter(Boolean);

          if (nums.length >= 5) {
            const seen = new Set(numbers);
            for (const n of nums) {
              if (!seen.has(n)) {
                seen.add(n);
                numbers.push(n);
              }
            }
          }
        });
      }

      if (numbers.length >= game.pickCount && drawCode) {
        draws.push({
          drawCode,
          date: formatDate(dateMatch[1]),
          numbers: numbers.slice(0, game.pickCount),
          jackpotWinners,
          hasJackpotWinner: jackpotWinners.some((w) => w > 0),
        });
      }
    });
  }

  const uniqueMap = new Map();
  draws.forEach((d) => {
    if (!uniqueMap.has(d.drawCode)) {
      uniqueMap.set(d.drawCode, d);
    }
  });
  const cleanDraws = Array.from(uniqueMap.values()).sort(
    (a, b) => Number(b.drawCode) - Number(a.drawCode)
  );

  const data = {
    game: gameKey,
    sourceBaseUrl: SOURCE_BASE,
    fetchedAt: new Date().toISOString(),
    latest: cleanDraws[0] ?? null,
    draws: cleanDraws,
    suggestions: {
      "10": buildSuggestions(cleanDraws, game.maxNumber, game.pickCount, 10),
      "20": buildSuggestions(cleanDraws, game.maxNumber, game.pickCount, 20),
      "50": buildSuggestions(cleanDraws, game.maxNumber, game.pickCount, 50),
    },
  };

  cache.set(gameKey, { data, createdAt: Date.now() });
  return data;
}

app.get(`/api/health`, (_, res) => {
  res.json({ ok: true });
});

app.get(`/api/vietlott/jackpot-winners`, async (_, res) => {
  try {
    const [game645, game655] = await Promise.all([
      fetchGameData("6-45"),
      fetchGameData("6-55"),
    ]);

    const jackpotDraws = [
      ...game645.draws.map((draw) => ({ ...draw, game: "6-45" })),
      ...game655.draws.map((draw) => ({ ...draw, game: "6-55" })),
    ]
      .filter((draw) => draw.hasJackpotWinner)
      .sort((a, b) => Number(b.drawCode) - Number(a.drawCode));

    res.json({
      sourceBaseUrl: SOURCE_BASE,
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
    const data = await fetchGameData(req.params.game);
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
    console.log(`Nguồn dữ liệu: ${SOURCE_BASE}`);
  });
}
