import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { loadGuild } from '../config/store';
import { hasNotionToken } from '../notion/client';

export async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = loadGuild(guildId);
  const connected = hasNotionToken(guildId);

  const statusEmoji = connected ? '🟢' : '🔴';
  const statusText = connected
    ? `Connected to **${guild.notionWorkspaceName ?? 'Notion'}**`
    : 'Not connected — run `/setup` with your Notion integration token';

  const embed = new EmbedBuilder()
    .setColor(connected ? 0x00b37d : 0xe74c3c)
    .setTitle('Discordion — Notion + Discord Integration')
    .addFields(
      {
        name: `${statusEmoji} Notion Status`,
        value: statusText,
        inline: false,
      },
      {
        name: '📋 Configuration',
        value: [
          '`/setup <token>` — Connect Notion workspace',
          '`/notification add` — Create notification rule',
          '`/create-command add` — Add page creation command',
          '`/page-list add` — Add page browse command',
          '`/panel create` + `/panel publish` — Add button panel',
          '`/summary add` — Add scheduled summary',
        ].join('\n'),
        inline: false,
      },
      {
        name: '🔍 Usage',
        value: [
          '`/find <query>` — Search Notion pages by title',
          '`/create-page` — Create a Notion page from Discord',
          '`/pages` — Browse a Notion database',
          '`/embed-discord <page_id>` — Get embed link for Notion',
        ].join('\n'),
        inline: false,
      },
      {
        name: '📊 Configured',
        value: [
          `• ${guild.notificationRules.length} notification rule${guild.notificationRules.length === 1 ? '' : 's'}`,
          `• ${guild.createCommands.length} create command${guild.createCommands.length === 1 ? '' : 's'}`,
          `• ${guild.pageLists.length} page list${guild.pageLists.length === 1 ? '' : 's'}`,
          `• ${guild.panels.length} panel${guild.panels.length === 1 ? '' : 's'}`,
          `• ${guild.scheduledSummaries.length} scheduled summar${guild.scheduledSummaries.length === 1 ? 'y' : 'ies'}`,
        ].join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: 'Discordion · Notion + Discord integration bot' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
