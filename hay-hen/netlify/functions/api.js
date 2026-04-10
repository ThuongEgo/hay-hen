import serverless from "serverless-http";
import app from "../../server/index.js";

export const handler = serverless(app, {
  basePath: ".netlify/functions/api",
  request: {
    method: "GET",
    path: "/api/vietlott",
  },
});
