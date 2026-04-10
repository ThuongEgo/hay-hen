import { fetchGameData } from "../../server/common.js";

const cache = new Map();

export const handler = async () => {
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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceBaseUrl: "https://www.minhngoc.net.vn",
        fetchedAt: new Date().toISOString(),
        total: jackpotDraws.length,
        draws: jackpotDraws,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Không thể lấy thống kê jackpot.",
        details: error?.message ?? "Unknown error",
      }),
    };
  }
};
