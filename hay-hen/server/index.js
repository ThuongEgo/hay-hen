import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = 4000;
const BASE_URL = "https://www.vietlott.vn";

const allowedOrigins = [
  "https://www.vietlott.vn",
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
  "5-35": {
    pagePath: "/vi/trung-thuong/ket-qua-trung-thuong/winning-number-535",
    detailPath: "/vi/trung-thuong/ket-qua-trung-thuong/535",
    maxNumber: 35,
    pickCount: 5,
  },
  "6-45": {
    pagePath: "/vi/trung-thuong/ket-qua-trung-thuong/winning-number-645",
    detailPath: "/vi/trung-thuong/ket-qua-trung-thuong/645",
    maxNumber: 45,
    pickCount: 6,
  },
  "6-55": {
    pagePath: "/vi/trung-thuong/ket-qua-trung-thuong/winning-number-655",
    detailPath: "/vi/trung-thuong/ket-qua-trung-thuong/655",
    maxNumber: 55,
    pickCount: 6,
  },
};

const http = axios.create({
  baseURL: BASE_URL,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: `${BASE_URL}/`,
    Origin: BASE_URL,
  },
  timeout: 15000,
});

function parseIntSafe(value) {
  const number = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isNaN(number) ? 0 : number;
}

function parseListRowsFromPage(html) {
  const $ = cheerio.load(html);
  const rows = [];
  const rowSelector = $("div#divResultContent tbody tr").length
    ? "div#divResultContent tbody tr"
    : "tbody tr";

  $(rowSelector).each((_, row) => {
    const date = $(row).find("td").eq(0).text().trim();
    const drawCode = $(row).find("td").eq(1).text().trim();
    const numbers = $(row)
      .find(".bong_tron")
      .map((__, el) => parseIntSafe($(el).text()))
      .get()
      .filter(Boolean);

    if (date && drawCode && numbers.length >= 5) {
      rows.push({ date, drawCode, numbers });
    }
  });

  return rows;
}

function parseAjaxConfig(html) {
  const endpointMatch = html.match(
    /\/ajaxpro\/Vietlott\.PlugIn\.WebParts\.Game\d+CompareWebPart,Vietlott\.PlugIn\.WebParts\.ashx/
  );
  const keyMatch = html.match(/ServerSideDrawResult\(RenderInfo,\s*'([^']+)'/);
  const maxPageMatch = html.match(/javascript:NextPage\((\d+)\)/g);
  const maxPageIndex = maxPageMatch
    ? Math.max(...maxPageMatch.map((item) => parseIntSafe(item)))
    : 0;

  return {
    endpoint: endpointMatch?.[0] ?? "",
    key: keyMatch?.[1] ?? "",
    maxPageIndex,
  };
}

async function createRenderInfo() {
  const envUrl = "/ajaxpro/Vietlott.Utility.WebEnvironments,Vietlott.Utility.ashx";
  const response = await http.post(
    `${BASE_URL}${envUrl}`,
    { SiteId: "main.frontend.vi" },
    { headers: { "X-AjaxPro-Method": "ServerSideFrontEndCreateRenderInfo" } }
  );

  const renderInfo = response.data?.value ?? {};
  renderInfo.SiteLang = "vi";
  return renderInfo;
}

async function fetchListRowsByAjax(ajaxConfig) {
  if (!ajaxConfig.endpoint || !ajaxConfig.key) return [];
  const renderInfo = await createRenderInfo();
  const emptyNumbers = Array.from({ length: 6 }, () => Array.from({ length: 18 }, () => ""));
  const rows = [];

  for (let pageIndex = 1; pageIndex <= ajaxConfig.maxPageIndex; pageIndex += 1) {
    const payload = {
      ORenderInfo: renderInfo,
      Key: ajaxConfig.key,
      GameDrawId: "",
      ArrayNumbers: emptyNumbers,
      CheckMulti: false,
      PageIndex: pageIndex,
    };

    const response = await http.post(`${BASE_URL}${ajaxConfig.endpoint}`, payload, {
      headers: { "X-AjaxPro-Method": "ServerSideDrawResult" },
    });

    const htmlFragment = response.data?.value?.HtmlContent ?? "";
    if (htmlFragment) {
      rows.push(...parseListRowsFromPage(htmlFragment));
    }
  }

  return rows;
}

function parseDrawOptions(html) {
  const $ = cheerio.load(html);
  return $("#drpSelectGameDraw option")
    .map((_, option) => {
      const text = $(option).text().trim();
      const drawCodeMatch = text.match(/\((\d+)\)/);
      const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      return {
        id: $(option).attr("value")?.trim() ?? "",
        drawCode: drawCodeMatch?.[1] ?? "",
        date: dateMatch?.[1] ?? "",
      };
    })
    .get()
    .filter((item) => item.id && item.drawCode);
}

function parseDetailPage(html) {
  const $ = cheerio.load(html);
  const numbers = $(".day_so_ket_qua_v2 .bong_tron, .day_so_ket_qua .bong_tron")
    .map((_, el) => parseIntSafe($(el).text()))
    .get()
    .filter(Boolean);

  const jackpotWinners = [];
  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (!cells.length) return;

    const label = cells.eq(0).text().trim().toLowerCase();
    if (!label.includes("jackpot")) return;

    const winnersCell = cells.eq(Math.max(1, cells.length - 2)).text().trim();
    jackpotWinners.push(parseIntSafe(winnersCell));
  });

  return {
    numbers,
    jackpotWinners,
  };
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

  const mainPage = await http.get(`${BASE_URL}${game.pagePath}`);
  const html = mainPage.data;
  const ajaxConfig = parseAjaxConfig(html);
  const optionList = parseDrawOptions(html);
  const firstPageRows = parseListRowsFromPage(html);
  const ajaxRows = await fetchListRowsByAjax(ajaxConfig);
  const listRows = [...firstPageRows, ...ajaxRows];
  const uniqueListRows = Array.from(
    new Map(listRows.map((item) => [item.drawCode, item])).values()
  );
  const listMap = new Map(listRows.map((item) => [item.drawCode, item]));
  const drawCandidates = (uniqueListRows.length ? uniqueListRows : optionList).slice(0, 50);

  const draws = await Promise.all(drawCandidates.map(async (option) => {
    const drawCode = option.drawCode;
    const prefetched = listMap.get(drawCode);
    let numbers = prefetched?.numbers ?? [];
    let jackpotWinners = [];

    try {
      const detailPage = await http.get(
        `${BASE_URL}${game.detailPath}?id=${drawCode}&nocatche=1`
      );
      const detail = parseDetailPage(detailPage.data);
      if (detail.numbers.length >= game.pickCount) {
        numbers = detail.numbers;
      }
      jackpotWinners = detail.jackpotWinners;
    } catch {
      jackpotWinners = [];
    }

    if (numbers.length >= game.pickCount) {
      return {
        drawCode,
        date: option.date || prefetched?.date || "",
        numbers,
        jackpotWinners,
        hasJackpotWinner: jackpotWinners.some((item) => item > 0),
      };
    }
    return null;
  }));

  const cleanDraws = draws.filter(Boolean);

  const data = {
    game: gameKey,
    sourceBaseUrl: BASE_URL,
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
    const [game535, game645, game655] = await Promise.all([
      fetchGameData("5-35"),
      fetchGameData("6-45"),
      fetchGameData("6-55"),
    ]);

    const jackpotDraws = [
      ...game535.draws.map((draw) => ({ ...draw, game: "5-35" })),
      ...game645.draws.map((draw) => ({ ...draw, game: "6-45" })),
      ...game655.draws.map((draw) => ({ ...draw, game: "6-55" })),
    ]
      .filter((draw) => draw.hasJackpotWinner)
      .sort((a, b) => Number(b.drawCode) - Number(a.drawCode));

    res.json({
      sourceBaseUrl: BASE_URL,
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
  });
}
