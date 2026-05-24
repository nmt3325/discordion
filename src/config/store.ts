import fs from 'fs';
import path from 'path';
import { GuildConfig } from './types';

const DATA_DIR = process.env.DATA_DIR ?? './data';
const GUILDS_DIR = path.join(DATA_DIR, 'guilds');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function guildPath(guildId: string): string {
  return path.join(GUILDS_DIR, `${guildId}.json`);
}

export function loadGuild(guildId: string): GuildConfig {
  ensureDir(GUILDS_DIR);
  const filePath = guildPath(guildId);
  if (!fs.existsSync(filePath)) {
    return createDefaultGuildConfig(guildId);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as GuildConfig;
}

export function saveGuild(config: GuildConfig): void {
  ensureDir(GUILDS_DIR);
  config.updatedAt = new Date().toISOString();
  fs.writeFileSync(guildPath(config.guildId), JSON.stringify(config, null, 2), 'utf-8');
}

export function listGuildIds(): string[] {
  ensureDir(GUILDS_DIR);
  return fs
    .readdirSync(GUILDS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

function createDefaultGuildConfig(guildId: string): GuildConfig {
  return {
    guildId,
    notificationRules: [],
    createCommands: [],
    pageLists: [],
    panels: [],
    scheduledSummaries: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
