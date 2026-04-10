import { fetchGameData, GAME_CONFIG } from "../../server/common.js";

const cache = new Map();

export const handler = async (event) => {
  try {
    const pathParts = (event.path ?? "").split("/").filter(Boolean);

    // Extract game key from path like /.netlify/functions/vietlott/6-45
    // or /api/vietlott/6-45
    let gameKey = null;
    if (pathParts.length >= 2) {
      gameKey = pathParts[pathParts.length - 1];
    }

    if (!gameKey || !Object.keys(GAME_CONFIG).includes(gameKey)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Game không hợp lệ. Chỉ chấp nhận: 6-45, 6-55",
        }),
      };
    }

    const data = await fetchGameData(gameKey, cache);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Không thể lấy dữ liệu Vietlott.",
        details: error?.message ?? "Unknown error",
      }),
    };
  }
};
