import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, ChannelType } from 'discord.js';
import { loadGuild, saveGuild, generateId } from '../config/store';
import { NotificationRule, SourceType, DeliveryType } from '../config/types';

export async function handleNotification(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  switch (sub) {
    case 'add': return handleNotificationAdd(interaction);
    case 'list': return handleNotificationList(interaction);
    case 'remove': return handleNotificationRemove(interaction);
    case 'toggle': return handleNotificationToggle(interaction);
  }
}

async function handleNotificationAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const name = interaction.options.getString('name', true);
  const sourceType = interaction.options.getString('source', true) as SourceType;
  const channel = interaction.options.getChannel('channel', true);
  const delivery = (interaction.options.getString('delivery') ?? 'realtime') as DeliveryType;
  const sourceId = interaction.options.getString('source_id') ?? undefined;

  if (sourceType !== 'all_pages' && !sourceId) {
    await interaction.reply({
      content: '❌ `source_id` is required when source is `database` or `selected_pages`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
    await interaction.reply({
      content: '❌ Please select a text channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guild = loadGuild(guildId);

  const rule: NotificationRule = {
    id: generateId(),
    name,
    sourceType,
    sourceId,
    channelId: channel.id,
    deliveryType: delivery,
    filters: [],
    watchedProperties: [],
    displayFields: [{ propertyName: 'title' }],
    quickActions: [],
    lastChecked: new Date().toISOString(),
    enabled: true,
    isDraft: false,
  };

  guild.notificationRules.push(rule);
  saveGuild(guild);

  const embed = new EmbedBuilder()
    .setColor(0x00b37d)
    .setTitle('✅ Notification Rule Created')
    .addFields(
      { name: 'Rule', value: name, inline: true },
      { name: 'ID', value: `\`${rule.id}\``, inline: true },
      { name: 'Source', value: sourceType + (sourceId ? ` (${sourceId.slice(0, 8)}...)` : ''), inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true },
      { name: 'Delivery', value: delivery, inline: true },
    )
    .setFooter({ text: 'Notifications will arrive within 1–5 minutes of Notion changes' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleNotificationList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = loadGuild(guildId);

  if (guild.notificationRules.length === 0) {
    await interaction.reply({
      content: 'No notification rules configured. Use `/notification add` to create one.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Notification Rules')
    .addFields(
      guild.notificationRules.map((r) => ({
        name: `${r.enabled ? '🟢' : '🔴'} ${r.name}`,
        value: `ID: \`${r.id}\` · Source: ${r.sourceType} · Channel: <#${r.channelId}> · ${r.deliveryType}`,
        inline: false,
      })),
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleNotificationRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const ruleId = interaction.options.getString('id', true);
  const guild = loadGuild(guildId);

  const idx = guild.notificationRules.findIndex((r) => r.id === ruleId);
  if (idx === -1) {
    await interaction.reply({ content: `❌ Rule \`${ruleId}\` not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const [removed] = guild.notificationRules.splice(idx, 1);
  saveGuild(guild);
  await interaction.reply({ content: `✅ Removed rule **${removed.name}**.`, flags: MessageFlags.Ephemeral });
}

async function handleNotificationToggle(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const ruleId = interaction.options.getString('id', true);
  const guild = loadGuild(guildId);

  const rule = guild.notificationRules.find((r) => r.id === ruleId);
  if (!rule) {
    await interaction.reply({ content: `❌ Rule \`${ruleId}\` not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  rule.enabled = !rule.enabled;
  saveGuild(guild);
  await interaction.reply({
    content: `${rule.enabled ? '✅ Enabled' : '🔴 Disabled'} rule **${rule.name}**.`,
    flags: MessageFlags.Ephemeral,
  });
}
