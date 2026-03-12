/**
 * apps/bot/src/index.js
 * Ponto de entrada do Storm Bots V2
 */
require("dotenv").config();

// Validação de variáveis obrigatórias na inicialização
const REQUIRED_ENV = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "API_INTERNAL_SECRET"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Variável de ambiente obrigatória não definida: ${key}`);
    process.exit(1);
  }
}

const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const { readdirSync } = require("fs");
const path    = require("path");
const express = require("express");

// ── Cliente Discord ───────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();

// ── Carrega comandos ──────────────────────────────────────
const cmdPath = path.join(__dirname, "commands");
for (const file of readdirSync(cmdPath).filter(f => f.endsWith(".js"))) {
  const cmd = require(path.join(cmdPath, file));
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`✅ Comando: /${cmd.data.name}`);
  }
}

// ── Carrega eventos ───────────────────────────────────────
const evtPath = path.join(__dirname, "events");
for (const file of readdirSync(evtPath).filter(f => f.endsWith(".js"))) {
  const event = require(path.join(evtPath, file));
  const fn    = (...args) => event.execute(...args, client);
  event.once ? client.once(event.name, fn) : client.on(event.name, fn);
}

// ── Servidor interno ──────────────────────────────────────
const app            = express();
const internalRoutes = require("./internal/routes");

app.use(express.json({ limit: "1mb" }));

// Passa client para as rotas internas
internalRoutes.setClient(client);
app.use("/internal", internalRoutes.router);

app.get("/health", (req, res) =>
  res.json({ status: "ok", bot: client.user?.tag || "starting", guilds: client.guilds.cache.size })
);

const PORT = process.env.BOT_INTERNAL_PORT || 3001;
app.listen(PORT, () => console.log(`🔗 Servidor interno na porta ${PORT}`));

// ── Login ─────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("❌ Falha ao logar no Discord:", err.message);
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────
const shutdown = () => { client.destroy(); process.exit(0); };
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);
process.on("unhandledRejection", err => console.error("⚠️  Unhandled rejection:", err?.message || err));
process.on("uncaughtException",  err => {
  console.error("💥 Uncaught exception:", err);
  process.exit(1);
});
