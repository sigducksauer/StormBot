/**
 * apps/bot/src/events/ready.js
 * Inicialização V2 — registra comandos, define status
 */
const { REST, Routes, ActivityType } = require("discord.js");
const { readdirSync } = require("fs");
const path = require("path");

module.exports = {
  name: "ready",
  once: true,

  async execute(client) {
    console.log(`\n✅ Storm Bots online como ${client.user.tag}`);
    console.log(`   Servidores : ${client.guilds.cache.size}`);
    console.log(`   Usuários   : ${client.users.cache.size}\n`);

    // Status rotativo
    const statuses = [
      { name: "🛒 Storm Bots | /loja", type: ActivityType.Watching },
      { name: "⚡ Processando vendas", type: ActivityType.Playing  },
    ];
    let idx = 0;
    client.user.setPresence({ activities: [statuses[0]], status: "online" });
    setInterval(() => {
      idx = (idx + 1) % statuses.length;
      client.user.setPresence({ activities: [statuses[idx]], status: "online" });
    }, 30_000);

    // Registra comandos globalmente
    const commands = [];
    const cmdPath  = path.join(__dirname, "../commands");
    for (const file of readdirSync(cmdPath).filter(f => f.endsWith(".js"))) {
      const cmd = require(path.join(cmdPath, file));
      if (cmd.data) commands.push(cmd.data.toJSON());
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
      console.log(`✅ ${commands.length} comandos registrados globalmente.`);
    } catch (err) {
      console.error("❌ Erro ao registrar comandos:", err.message);
    }
  },
};
