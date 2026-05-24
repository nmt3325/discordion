import cron from 'node-cron';
import { Client, EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { listGuildIds, loadGuild, saveGuild } from '../config/store';
import { ScheduledSummary } from '../config/types';
import { getNotionClient } from '../notion/client';
import { getDatabaseItems } from '../notion/search';
import { getPageTitle, getPageUrl } from '../notion/helpers';
import { sendDigestSummary } from './notifications';

export function startScheduler(discordClient: Client): void {
  console.log('[Scheduler] Starting scheduled summary service');

  // Run every minute to check what needs to fire
  cron.schedule('* * * * *', () => {
    checkAndRunSummaries(discordClient).catch((err) =>
      console.error('[Scheduler] Error:', err),
    );
  });

  // Hourly digest check
  cron.schedule('0 * * * *', () => {
    runDigests('digest_hourly', discordClient).catch((err) =>
      console.error('[Scheduler] Hourly digest error:', err),
    );
  });

  // Daily digest check — run at top of each hour, filter by configured time
  cron.schedule('0 * * * *', () => {
    runDigests('digest_daily', discordClient).catch((err) =>
      console.error('[Scheduler] Daily digest error:', err),
    );
  });

  // Weekly digest — Monday at configured time
  cron.schedule('0 * * * 1', () => {
    runDigests('digest_weekly', discordClient).catch((err) =>
      console.error('[Scheduler] Weekly digest error:', err),
    );
  });
}

async function checkAndRunSummaries(discordClient: Client): Promise<void> {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  const currentDayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon

  const guildIds = listGuildIds();
  for (const guildId of guildIds) {
    const guild = loadGuild(guildId);
    for (const summary of guild.scheduledSummaries.filter((s) => s.enabled)) {
      const shouldRun =
        (summary.frequency === 'hourly' && currentMinute === 0) ||
        (summary.frequency === 'daily' && summary.time === currentTimeStr) ||
        (summary.frequency === 'weekly' && currentDayOfWeek === 1 && summary.time === currentTimeStr);

      if (shouldRun) {
        runSummary(summary, guildId, discordClient).catch((err) =>
          console.error(`[Scheduler] Summary ${summary.id} failed:`, err),
        );
      }
    }
  }
}

async function runDigests(
  deliveryType: 'digest_hourly' | 'digest_daily' | 'digest_weekly',
  discordClient: Client,
): Promise<void> {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:00`;

  const guildIds = listGuildIds();
  for (const guildId of guildIds) {
    const guild = loadGuild(guildId);
    for (const rule of guild.notificationRules.filter(
      (r) => r.enabled && !r.isDraft && r.deliveryType === deliveryType,
    )) {
      if (deliveryType !== 'digest_hourly') {
        // Check if the configured time matches
        if (rule.lastChecked) {
          const expectedTime = '09:00'; // Default; could be stored per rule
          if (currentTimeStr !== expectedTime) continue;
        }
      }
      try {
        await sendDigestSummary(rule, guildId, discordClient);
        rule.lastChecked = new Date().toISOString();
      } catch (err) {
        console.error(`[Scheduler] Digest rule ${rule.id} failed:`, err);
      }
    }
    saveGuild(guild);
  }
}

export async function runSummary(
  summary: ScheduledSummary,
  guildId: string,
  discordClient: Client,
): Promise<void> {
  const notion = getNotionClient(guildId);

  let items: Awaited<ReturnType<typeof getDatabaseItems>> = [];
  if (summary.sourceType === 'database' && summary.sourceId) {
    items = await getDatabaseItems(notion, summary.sourceId, summary.filters, undefined, 'descending', 10);
  }

  if (items.length === 0 && summary.onlyWhenResults) return;

  const channel = await discordClient.channels.fetch(summary.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Channel ${summary.channelId} not accessible`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📋 ${summary.name}`)
    .setFooter({ text: `Notion · ${summary.frequency} summary` })
    .setTimestamp();

  if (items.length === 0) {
    embed.setDescription('No items found.');
  } else {
    const fields = items.slice(0, 10).map((page) => ({
      name: getPageTitle(page).slice(0, 256),
      value: `[Open in Notion](${getPageUrl(page)})`,
      inline: false,
    }));
    embed.addFields(fields);
    embed.setDescription(`Showing ${Math.min(items.length, 10)} item${items.length === 1 ? '' : 's'}`);
  }

  const openBtn = new ButtonBuilder()
    .setLabel('Open Database in Notion')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://notion.so/${summary.sourceId?.replace(/-/g, '')}`);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(openBtn);
  await (channel as TextChannel).send({ embeds: [embed], components: [row] });
}
