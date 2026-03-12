/**
 * apps/bot/src/utils/api.js
 * Cliente HTTP para a API interna — com retry e timeout
 */
const axios = require("axios");

const API_URL    = process.env.API_URL             || "http://api:8000";
const INT_SECRET = process.env.API_INTERNAL_SECRET || "";

const client = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: {
    "Content-Type":      "application/json",
    "X-Internal-Secret": INT_SECRET,
  },
});

// Retry automático em falhas de rede (não em 4xx)
client.interceptors.response.use(
  res => res.data,
  async err => {
    const isNetwork = !err.response && err.code !== "ECONNABORTED";
    const cfg = err.config;

    if (isNetwork && !cfg._retry) {
      cfg._retry = true;
      await new Promise(r => setTimeout(r, 1000));
      return client(cfg);
    }

    const msg    = err.response?.data?.detail || err.message;
    const status = err.response?.status;
    const error  = new Error(msg);
    error.status   = status;
    error.response = err.response;
    throw error;
  }
);

function headers(guildId) {
  return guildId ? { "X-Guild-Id": String(guildId) } : {};
}

module.exports = {
  get:          (url, guildId)       => client.get(url,   { headers: headers(guildId) }),
  post:         (url, data, guildId) => client.post(url, data, { headers: headers(guildId) }),
  put:          (url, data, guildId) => client.put(url,  data, { headers: headers(guildId) }),
  delete:       (url, guildId)       => client.delete(url,     { headers: headers(guildId) }),
  postInternal: (url, data)          => client.post(url, data),
};
