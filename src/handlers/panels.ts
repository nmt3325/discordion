import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ChannelType,
  MessageFlags,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { loadGuild, saveGuild, generateId } from '../config/store';
import { Panel, PanelButton } from '../config/types';
import { handleCreatePage } from './create-page';
import { showPageList } from './pages';

export async function handlePanel(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  switch (sub) {
    case 'create': return handlePanelCreate(interaction);
    case 'list': return handlePanelList(interaction);
    case 'publish': return handlePanelPublish(interaction);
    case 'remove': return handlePanelRemove(interaction);
  }
}

async function handlePanelCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const name = interaction.options.getString('name', true);
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description') ?? undefined;

  const guild = loadGuild(guildId);

  const panel: Panel = {
    id: generateId(),
    name,
    title,
    description,
    buttons: [],
    published: false,
  };

  guild.panels.push(panel);
  saveGuild(guild);

  const embed = new EmbedBuilder()
    .setColor(0x00b37d)
    .setTitle('✅ Panel Created')
    .addFields(
      { name: 'Name', value: panel.name, inline: true },
      { name: 'ID', value: `\`${panel.id}\``, inline: true },
    )
    .setDescription(
      `Panel created but not yet published.\n\n` +
        `To add buttons, edit the config file at \`data/guilds/${guildId}.json\` and add entries to the panel's \`buttons\` array.\n\n` +
        `Then use \`/panel publish\` to post it to a channel.`,
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handlePanelList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = loadGuild(guildId);

  if (guild.panels.length === 0) {
    await interaction.reply({
      content: 'No panels configured. Use `/panel create` to create one.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Panels')
    .addFields(
      guild.panels.map((p) => ({
        name: `${p.published ? '🟢 Published' : '🔴 Draft'} ${p.name}`,
        value: `ID: \`${p.id}\` · Buttons: ${p.buttons.length}${p.channelId ? ` · Channel: <#${p.channelId}>` : ''}`,
        inline: false,
      })),
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handlePanelPublish(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const panelId = interaction.options.getString('id', true);
  const channel = interaction.options.getChannel('channel', true);

  if (channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: '❌ Please select a text channel.', flags: MessageFlags.Ephemeral });
    return;
  }

  const guild = loadGuild(guildId);
  const panel = guild.panels.find((p) => p.id === panelId);

  if (!panel) {
    await interaction.reply({ content: `❌ Panel \`${panelId}\` not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const embed = buildPanelEmbed(panel);
    const rows = buildPanelComponents(panel, guildId);

    const textChannel = interaction.guild?.channels.cache.get(channel.id) as TextChannel;
    if (!textChannel) throw new Error('Channel not found');

    // Delete old message if re-publishing
    if (panel.messageId) {
      try {
        const oldMsg = await textChannel.messages.fetch(panel.messageId);
        await oldMsg.delete();
      } catch {
        // Ignore if already deleted
      }
    }

    const msg = await textChannel.send({ embeds: [embed], components: rows });
    panel.channelId = channel.id;
    panel.messageId = msg.id;
    panel.published = true;
    saveGuild(guild);

    await interaction.editReply({ content: `✅ Panel **${panel.name}** published to <#${channel.id}>.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({ content: `❌ Failed to publish panel: ${message}` });
  }
}

async function handlePanelRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const panelId = interaction.options.getString('id', true);
  const guild = loadGuild(guildId);

  const idx = guild.panels.findIndex((p) => p.id === panelId);
  if (idx === -1) {
    await interaction.reply({ content: `❌ Panel \`${panelId}\` not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const [removed] = guild.panels.splice(idx, 1);
  saveGuild(guild);
  await interaction.reply({ content: `✅ Removed panel **${removed.name}**.`, flags: MessageFlags.Ephemeral });
}

function buildPanelEmbed(panel: Panel): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(panel.title)
    .setDescription(panel.description ?? null);
}

function buildPanelComponents(panel: Panel, guildId: string): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const buttons = panel.buttons.slice(0, 25);

  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const btn of buttons.slice(i, i + 5)) {
      const style = styleFromString(btn.style);
      const builder = new ButtonBuilder()
        .setCustomId(`panel_btn:${btn.actionType}:${btn.targetId}:${guildId}`)
        .setLabel(btn.label.slice(0, 80))
        .setStyle(style);
      if (btn.emoji) builder.setEmoji(btn.emoji);
      row.addComponents(builder);
    }
    rows.push(row);
  }

  return rows;
}

function styleFromString(style: PanelButton['style']): ButtonStyle {
  switch (style) {
    case 'primary': return ButtonStyle.Primary;
    case 'success': return ButtonStyle.Success;
    case 'danger': return ButtonStyle.Danger;
    default: return ButtonStyle.Secondary;
  }
}

export async function handlePanelButton(interaction: ButtonInteraction): Promise<void> {
  const [, actionType, targetId, guildId] = interaction.customId.split(':');
  const guild = loadGuild(guildId);

  if (actionType === 'create') {
    const cmd = guild.createCommands.find((c) => c.id === targetId);
    if (!cmd) {
      await interaction.reply({ content: '❌ Create command not found or removed.', flags: MessageFlags.Ephemeral });
      return;
    }
    // Show the modal for this create command
    const fields = cmd.fields.slice(0, 5);
    const modal = new ModalBuilder()
      .setCustomId(`create_modal:${cmd.id}:${guildId}`)
      .setTitle(cmd.name.slice(0, 45));

    for (const field of fields) {
      const input = new TextInputBuilder()
        .setCustomId(field.id)
        .setLabel((field.name + (field.required ? ' *' : '')).slice(0, 45))
        .setStyle(field.type === 'rich_text' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(field.required);
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    }
    await interaction.showModal(modal);
  } else if (actionType === 'list') {
    const pageList = guild.pageLists.find((l) => l.id === targetId);
    if (!pageList) {
      await interaction.reply({ content: '❌ Page list not found or removed.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    await showPageList(interaction, pageList, guildId);
  } else {
    await interaction.reply({ content: '❌ Unknown panel action.', flags: MessageFlags.Ephemeral });
  }
}
