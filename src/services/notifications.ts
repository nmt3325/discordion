import { Client, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Client as NotionClient } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { loadGuild, saveGuild, listGuildIds } from '../config/store';
import { NotificationRule } from '../config/types';
import { getNotionClient } from '../notion/client';
import { getPageTitle, getPageUrl, buildPageEmbed, formatRelativeTime } from '../notion/helpers';

const POLL_INTERVAL_MS = (parseInt(process.env.POLL_INTERVAL_SECONDS ?? '60', 10)) * 1000;

// Tracks pages seen per rule to detect new/changed pages
const seenPages = new Map<string, Map<string, string>>(); // ruleId -> pageId -> last_edited_time

export function startNotificationPoller(discordClient: Client): NodeJS.Timeout {
  console.log(`[Notifications] Starting poller (interval: ${POLL_INTERVAL_MS / 1000}s)`);
  return setInterval(() => pollAll(discordClient), POLL_INTERVAL_MS);
}

async function pollAll(discordClient: Client): Promise<void> {
  const guildIds = listGuildIds();
  for (const guildId of guildIds) {
    try {
      await pollGuild(guildId, discordClient);
    } catch (err) {
      console.error(`[Notifications] Error polling guild ${guildId}:`, err);
    }
  }
}

async function pollGuild(guildId: string, discordClient: Client): Promise<void> {
  const guild = loadGuild(guildId);
  const enabledRules = guild.notificationRules.filter((r) => r.enabled && !r.isDraft && r.deliveryType === 'realtime');
  if (enabledRules.length === 0) return;

  let notion: NotionClient;
  try {
    notion = getNotionClient(guildId);
  } catch {
    return;
  }

  for (const rule of enabledRules) {
    try {
      await pollRule(rule, guildId, guild, notion, discordClient);
      rule.lastChecked = new Date().toISOString();
    } catch (err) {
      console.error(`[Notifications] Error polling rule ${rule.id}:`, err);
    }
  }

  saveGuild(guild);
}

async function pollRule(
  rule: NotificationRule,
  guildId: string,
  guild: ReturnType<typeof loadGuild>,
  notion: NotionClient,
  discordClient: Client,
): Promise<void> {
  const lastChecked = new Date(rule.lastChecked);
  const ruleKey = `${guildId}:${rule.id}`;

  if (!seenPages.has(ruleKey)) {
    seenPages.set(ruleKey, new Map());
    // Initialize: just mark existing pages as seen without notifying
    const pages = await fetchPagesForRule(rule, notion);
    const pageMap = seenPages.get(ruleKey)!;
    for (const page of pages) {
      pageMap.set(page.id, page.last_edited_time);
    }
    return;
  }

  const pages = await fetchPagesForRule(rule, notion);
  const pageMap = seenPages.get(ruleKey)!;
  const newOrChanged: { page: PageObjectResponse; isNew: boolean }[] = [];

  for (const page of pages) {
    const prevTime = pageMap.get(page.id);
    if (!prevTime) {
      newOrChanged.push({ page, isNew: true });
    } else if (prevTime !== page.last_edited_time) {
      newOrChanged.push({ page, isNew: false });
    }
    pageMap.set(page.id, page.last_edited_time);
  }

  if (newOrChanged.length === 0) return;

  const channel = await discordClient.channels.fetch(rule.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  for (const { page, isNew } of newOrChanged.slice(0, 10)) {
    const embed = buildNotificationEmbed(page, rule, isNew);
    const components = buildNotificationComponents(page, guildId, rule);

    try {
      await (channel as TextChannel).send({ embeds: [embed], components });
    } catch (err) {
      console.error(`[Notifications] Failed to send to channel ${rule.channelId}:`, err);
    }
  }
}

async function fetchPagesForRule(
  rule: NotificationRule,
  notion: NotionClient,
): Promise<PageObjectResponse[]> {
  try {
    if (rule.sourceType === 'database' && rule.sourceId) {
      const response = await notion.databases.query({
        database_id: rule.sourceId,
        page_size: 50,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      });
      return response.results.filter((r): r is PageObjectResponse => r.object === 'page');
    }

    if (rule.sourceType === 'all_pages' || rule.sourceType === 'selected_pages') {
      const response = await notion.search({
        filter: { property: 'object', value: 'page' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: 25,
      });
      const pages = response.results.filter((r): r is PageObjectResponse => r.object === 'page');

      if (rule.sourceType === 'selected_pages' && rule.sourceId) {
        return pages.filter(
          (p) =>
            p.id === rule.sourceId ||
            ('page_id' in p.parent && p.parent.page_id === rule.sourceId) ||
            ('database_id' in p.parent && p.parent.database_id === rule.sourceId),
        );
      }
      return pages;
    }
  } catch (err) {
    console.error(`[Notifications] fetchPagesForRule error:`, err);
  }
  return [];
}

function buildNotificationEmbed(
  page: PageObjectResponse,
  rule: NotificationRule,
  isNew: boolean,
): EmbedBuilder {
  const title = getPageTitle(page);
  const url = getPageUrl(page);
  const color = isNew ? 0x00b37d : 0x5865f2;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${isNew ? '🆕' : '✏️'} ${title}`.slice(0, 256))
    .setURL(url)
    .setFooter({ text: `Notion · ${rule.name}` })
    .setTimestamp(new Date(page.last_edited_time));

  if ('last_edited_by' in page && page.last_edited_by && 'name' in page.last_edited_by) {
    const authorName = page.last_edited_by.name;
    if (typeof authorName === 'string') {
      embed.setAuthor({ name: authorName });
    }
  }

  for (const df of rule.displayFields.filter((f) => f.propertyName !== 'title').slice(0, 5)) {
    const { getPropertyValue } = require('../notion/helpers') as typeof import('../notion/helpers');
    const value = getPropertyValue(page, df.propertyName);
    if (value) {
      embed.addFields({ name: df.label ?? df.propertyName, value: value.slice(0, 1024), inline: true });
    }
  }

  return embed;
}

function buildNotificationComponents(
  page: PageObjectResponse,
  guildId: string,
  rule: NotificationRule,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (rule.quickActions.length > 0) {
    const { buildQuickActionRow } = require('../handlers/quick-actions') as typeof import('../handlers/quick-actions');
    const qaRow = buildQuickActionRow(page.id, guildId, rule.quickActions);
    if (qaRow) rows.push(qaRow);
  }

  const openBtn = new ButtonBuilder()
    .setLabel('Open in Notion')
    .setStyle(ButtonStyle.Link)
    .setURL(getPageUrl(page));
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(openBtn));

  return rows;
}

// Digest delivery: collect changes since last check and send grouped summary
export async function sendDigestSummary(
  rule: NotificationRule,
  guildId: string,
  discordClient: Client,
): Promise<void> {
  let notion: NotionClient;
  try {
    notion = getNotionClient(guildId);
  } catch {
    return;
  }

  const pages = await fetchPagesForRule(rule, notion);
  const since = new Date(rule.lastChecked);
  const changed = pages.filter((p) => new Date(p.last_edited_time) > since);

  if (changed.length === 0) return;

  const channel = await discordClient.channels.fetch(rule.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📋 ${rule.name} — Summary`)
    .setDescription(`${changed.length} update${changed.length === 1 ? '' : 's'} since last digest`)
    .setFooter({ text: `Notion · ${rule.deliveryType.replace('digest_', '')} digest` })
    .setTimestamp();

  const fields = changed.slice(0, 10).map((page) => ({
    name: getPageTitle(page).slice(0, 256),
    value: `[Open](${getPageUrl(page)}) · ${formatRelativeTime(page.last_edited_time)}`,
    inline: false,
  }));
  embed.addFields(fields);

  await (channel as TextChannel).send({ embeds: [embed] });
}
