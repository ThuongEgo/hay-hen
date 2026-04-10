import axios from "axios";
import * as cheerio from "cheerio";

export const SOURCE_BASE = "https://www.minhngoc.net.vn";

export const GAME_CONFIG = {
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

export const http = axios.create({
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

export function parseIntSafe(value) {
  const number = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isNaN(number) ? 0 : number;
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return dateStr;
  return `${match[1]}/${match[2]}/${match[3]}`;
}

export function buildSuggestions(draws, maxNumber, pickCount, recentDrawCount) {
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

function parseDrawFromHeading($, heading, game) {
  const headingText = $(heading).text().trim();

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
    return {
      drawCode,
      date: formatDate(dateStr),
      numbers: numbers.slice(0, game.pickCount),
      jackpotWinners,
      hasJackpotWinner: jackpotWinners.some((w) => w > 0),
    };
  }

  return null;
}

export async function fetchGameData(gameKey, cacheStore) {
  const cached = cacheStore?.get(gameKey);
  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) {
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
    if (
      !headingText.includes("MEGA 6/45") &&
      !headingText.includes("POWER 6/55")
    )
      return;

    const draw = parseDrawFromHeading($, heading, game);
    if (draw) draws.push(draw);
  });

  if (draws.length === 0) {
    $("h3, h4").each((_, heading) => {
      const headingText = $(heading).text().trim();
      if (!headingText.includes("KẾT QUẢ")) return;

      const dateMatch = headingText.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (!dateMatch) return;

      const draw = parseDrawFromHeading($, heading, game);
      if (draw) draws.push(draw);
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

  if (cacheStore) {
    cacheStore.set(gameKey, { data, createdAt: Date.now() });
  }

  return data;
}
