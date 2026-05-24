import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { handleInteraction } from './bot/interactions';
import { startNotificationPoller } from './services/notifications';
import { startScheduler } from './services/scheduler';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('[Boot] DISCORD_TOKEN is not set. Create a .env file from .env.example.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[Bot] Logged in as ${readyClient.user.tag}`);
  console.log(`[Bot] Serving ${readyClient.guilds.cache.size} guild(s)`);

  startNotificationPoller(readyClient);
  startScheduler(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
  await handleInteraction(interaction);
});

client.on(Events.Error, (err) => {
  console.error('[Discord] Client error:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[Process] Unhandled rejection:', err);
});

client.login(token).catch((err) => {
  console.error('[Boot] Failed to login:', err.message);
  process.exit(1);
});
