import { Client } from '@notionhq/client';
import { loadGuild } from '../config/store';

const defaultToken = process.env.NOTION_TOKEN;

export function getNotionClient(guildId: string): Client {
  const guild = loadGuild(guildId);
  const token = guild.notionToken ?? defaultToken;
  if (!token) {
    throw new Error('No Notion token configured. Run /setup to connect your Notion workspace.');
  }
  return new Client({ auth: token });
}

export function hasNotionToken(guildId: string): boolean {
  const guild = loadGuild(guildId);
  return !!(guild.notionToken ?? defaultToken);
}
