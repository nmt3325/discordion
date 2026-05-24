import { ChatInputCommandInteraction, EmbedBuilder, ChannelType, MessageFlags } from 'discord.js';
import { loadGuild, saveGuild, generateId } from '../config/store';
import { ScheduledSummary } from '../config/types';

export async function handleSummary(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  switch (sub) {
    case 'add': return handleSummaryAdd(interaction);
    case 'list': return handleSummaryList(interaction);
    case 'remove': return handleSummaryRemove(interaction);
    case 'run': return handleSummaryRun(interaction);
  }
}

async function handleSummaryAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const name = interaction.options.getString('name', true);
  const databaseId = interaction.options.getString('database_id', true);
  const channel = interaction.options.getChannel('channel', true);
  const frequency = interaction.options.getString('frequency', true) as 'daily' | 'weekly' | 'hourly';
  const time = interaction.options.getString('time') ?? '09:00';

  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
    await interaction.reply({ content: '❌ Please select a text channel.', flags: MessageFlags.Ephemeral });
    return;
  }

  const guild = loadGuild(guildId);

  const summary: ScheduledSummary = {
    id: generateId(),
    name,
    sourceType: 'database',
    sourceId: databaseId,
    channelId: channel.id,
    frequency,
    time,
    timezone: 'UTC',
    filters: [],
    displayFields: [],
    quickActions: [],
    onlyWhenResults: true,
    enabled: true,
  };

  guild.scheduledSummaries.push(summary);
  saveGuild(guild);

  const embed = new EmbedBuilder()
    .setColor(0x00b37d)
    .setTitle('✅ Scheduled Summary Added')
    .addFields(
      { name: 'Name', value: summary.name, inline: true },
      { name: 'ID', value: `\`${summary.id}\``, inline: true },
      { name: 'Frequency', value: frequency, inline: true },
      { name: 'Time (UTC)', value: time, inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true },
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleSummaryList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = loadGuild(guildId);

  if (guild.scheduledSummaries.length === 0) {
    await interaction.reply({
      content: 'No scheduled summaries. Use `/summary add` to create one.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Scheduled Summaries')
    .addFields(
      guild.scheduledSummaries.map((s) => ({
        name: `${s.enabled ? '🟢' : '🔴'} ${s.name}`,
        value: `ID: \`${s.id}\` · ${s.frequency} @ ${s.time} UTC · <#${s.channelId}>`,
        inline: false,
      })),
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleSummaryRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const summaryId = interaction.options.getString('id', true);
  const guild = loadGuild(guildId);

  const idx = guild.scheduledSummaries.findIndex((s) => s.id === summaryId);
  if (idx === -1) {
    await interaction.reply({ content: `❌ Summary \`${summaryId}\` not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const [removed] = guild.scheduledSummaries.splice(idx, 1);
  saveGuild(guild);
  await interaction.reply({ content: `✅ Removed summary **${removed.name}**.`, flags: MessageFlags.Ephemeral });
}

async function handleSummaryRun(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const summaryId = interaction.options.getString('id', true);
  const guild = loadGuild(guildId);

  const summary = guild.scheduledSummaries.find((s) => s.id === summaryId);
  if (!summary) {
    await interaction.reply({ content: `❌ Summary \`${summaryId}\` not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const { runSummary } = await import('../services/scheduler');
    const client = interaction.client;
    await runSummary(summary, guildId, client);
    await interaction.editReply({ content: `✅ Summary **${summary.name}** sent to <#${summary.channelId}>.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({ content: `❌ Failed to run summary: ${message}` });
  }
}
