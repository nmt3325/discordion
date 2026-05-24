import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from 'discord.js';
import { getNotionClient } from '../notion/client';
import { createNotionPage } from '../notion/search';
import { loadGuild, saveGuild } from '../config/store';
import { CreateCommand } from '../config/types';
import { buildQuickActionRow } from './quick-actions';

export async function handleCreatePage(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = loadGuild(guildId);
  const commandArg = interaction.options.getString('command');

  const enabled = guild.createCommands.filter((c) => c.enabled);
  if (enabled.length === 0) {
    await interaction.reply({
      content:
        '❌ No create commands configured. Use `/create-command add` to set one up.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (enabled.length === 1 || commandArg) {
    const cmd = commandArg
      ? enabled.find((c) => c.commandName === commandArg || c.id === commandArg)
      : enabled[0];
    if (!cmd) {
      await interaction.reply({
        content: `❌ Create command "${commandArg}" not found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await showCreateModal(interaction, cmd, guildId);
    return;
  }

  // Show selection menu
  const select = new StringSelectMenuBuilder()
    .setCustomId(`create_select:${guildId}`)
    .setPlaceholder('Select a create command...')
    .addOptions(
      enabled.slice(0, 25).map((c) => ({
        label: c.name,
        value: c.id,
        description: `/${c.commandName}`,
      })),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  const reply = await interaction.reply({
    content: 'Which type of page would you like to create?',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });

  const selection = await reply
    .awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    })
    .catch(() => null);

  if (!selection) {
    await interaction.editReply({ content: 'Timed out.', components: [] });
    return;
  }

  const cmd = enabled.find((c) => c.id === selection.values[0]);
  if (!cmd) return;
  await showCreateModal(selection as unknown as ChatInputCommandInteraction, cmd, guildId, true);
}

async function showCreateModal(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  cmd: CreateCommand,
  guildId: string,
  isSelect = false,
): Promise<void> {
  const fields = cmd.fields.slice(0, 5);
  const modal = new ModalBuilder()
    .setCustomId(`create_modal:${cmd.id}:${guildId}`)
    .setTitle(cmd.name.slice(0, 45));

  for (const field of fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel((field.name + (field.required ? ' *' : '')).slice(0, 45))
      .setStyle(field.type === 'rich_text' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(field.required)
      .setPlaceholder(field.type === 'date' ? 'YYYY-MM-DD' : '');
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }

  if (isSelect) {
    await (interaction as StringSelectMenuInteraction).showModal(modal);
  } else {
    await (interaction as ChatInputCommandInteraction).showModal(modal);
  }
}

export async function handleCreateModal(interaction: ModalSubmitInteraction): Promise<void> {
  const [, cmdId, guildId] = interaction.customId.split(':');
  const guild = loadGuild(guildId);
  const cmd = guild.createCommands.find((c) => c.id === cmdId);

  if (!cmd) {
    await interaction.reply({ content: '❌ Command not found.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const notion = getNotionClient(guildId);
    const fieldValues = cmd.fields.slice(0, 5).map((field) => ({
      propertyName: field.notionProperty,
      type: field.type,
      value: interaction.fields.getTextInputValue(field.id),
    }));

    const parentType = cmd.destinationType === 'database' ? 'database_id' : 'page_id';
    const result = await createNotionPage(notion, cmd.destinationId!, parentType, fieldValues);

    const embed = new EmbedBuilder()
      .setColor(0x00b37d)
      .setTitle(`✅ ${result.title || 'Page Created'}`)
      .setURL(result.url)
      .setDescription(`Successfully created in ${cmd.destinationName ?? 'Notion'}`)
      .setFooter({ text: 'Notion' });

    for (const df of cmd.displayFields.slice(0, 5)) {
      const fv = fieldValues.find((f) => f.propertyName === df.propertyName);
      if (fv?.value) {
        embed.addFields({ name: df.label ?? df.propertyName, value: fv.value, inline: true });
      }
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (cmd.quickActions.length > 0) {
      const qaRow = buildQuickActionRow(result.id, guildId, cmd.quickActions);
      if (qaRow) components.push(qaRow);
    }

    const openBtn = new ButtonBuilder()
      .setLabel('Open in Notion')
      .setStyle(ButtonStyle.Link)
      .setURL(result.url);
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(openBtn));

    await interaction.editReply({ embeds: [embed], components });

    if (cmd.enablePrivateThread && interaction.channel?.isTextBased()) {
      try {
        const msg = await interaction.fetchReply();
        if ('startThread' in msg) {
          await msg.startThread({
            name: `${result.title || 'New page'} discussion`.slice(0, 100),
            autoArchiveDuration: 1440,
          });
        }
      } catch {
        // Thread creation is optional, ignore failures
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({ content: `❌ Failed to create page: ${message}` });
  }
}
