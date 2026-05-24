import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { getCommandsJSON } from './commands/index';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env');
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    const commands = getCommandsJSON();
    console.log(`[Deploy] Registering ${commands.length} global slash commands...`);

    await rest.put(Routes.applicationCommands(clientId), { body: commands });

    console.log('[Deploy] ✅ Commands registered successfully!');
    console.log('Commands registered:');
    commands.forEach((c) => console.log(`  /${c.name} — ${c.description}`));
  } catch (err) {
    console.error('[Deploy] Failed:', err);
    process.exit(1);
  }
})();
