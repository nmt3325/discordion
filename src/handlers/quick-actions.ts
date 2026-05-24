import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  MessageFlags,
} from 'discord.js';
import { getNotionClient } from '../notion/client';
import { addComment, updatePageProperty } from '../notion/search';
import { QuickAction } from '../config/types';

const QA_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function buildQuickActionRow(
  pageId: string,
  guildId: string,
  actions: QuickAction[],
): ActionRowBuilder<ButtonBuilder> | null {
  if (actions.length === 0) return null;

  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const action of actions.slice(0, 5)) {
    let label = action.label;
    let style = ButtonStyle.Secondary;

    switch (action.type) {
      case 'comment':
        style = ButtonStyle.Secondary;
        break;
      case 'status_change':
      case 'select_change':
        style = ButtonStyle.Primary;
        break;
      case 'assign_self':
        style = ButtonStyle.Success;
        break;
    }

    const btn = new ButtonBuilder()
      .setCustomId(`qa:${action.type}:${action.id}:${pageId}:${guildId}`)
      .setLabel(label.slice(0, 80))
      .setStyle(style);
    row.addComponents(btn);
  }

  return row.components.length > 0 ? row : null;
}

export function buildSelectActionRow(
  pageId: string,
  guildId: string,
  action: QuickAction,
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  if (!action.options || action.options.length === 0) return null;

  const select = new StringSelectMenuBuilder()
    .setCustomId(`qa_select:${action.type}:${action.id}:${pageId}:${guildId}`)
    .setPlaceholder(action.label)
    .addOptions(
      action.options.slice(0, 25).map((opt) => ({ label: opt, value: opt })),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export async function handleQuickActionButton(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const [, actionType, actionId, pageId, guildId] = parts;

  switch (actionType) {
    case 'comment':
      await showCommentModal(interaction, pageId, guildId);
      break;
    case 'status_change':
    case 'select_change':
      await showSelectOptions(interaction, actionId, pageId, guildId, actionType);
      break;
    case 'assign_self':
      await handleAssignSelf(interaction, actionId, pageId, guildId);
      break;
    default:
      await interaction.reply({ content: '❌ Unknown action type.', flags: MessageFlags.Ephemeral });
  }
}

async function showCommentModal(
  interaction: ButtonInteraction,
  pageId: string,
  guildId: string,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`qa_comment:${pageId}:${guildId}`)
    .setTitle('Add Comment');

  const input = new TextInputBuilder()
    .setCustomId('comment_text')
    .setLabel('Comment')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function showSelectOptions(
  interaction: ButtonInteraction,
  actionId: string,
  pageId: string,
  guildId: string,
  actionType: string,
): Promise<void> {
  // We need the guild config to find the action options
  const { loadGuild } = await import('../config/store');
  const guild = loadGuild(guildId);

  let action: QuickAction | undefined;
  // Search through all configured actions
  for (const rule of guild.notificationRules) {
    action = rule.quickActions.find((a) => a.id === actionId);
    if (action) break;
  }
  if (!action) {
    for (const cmd of guild.createCommands) {
      action = cmd.quickActions.find((a) => a.id === actionId);
      if (action) break;
    }
  }
  if (!action) {
    for (const list of guild.pageLists) {
      action = list.quickActions.find((a) => a.id === actionId);
      if (action) break;
    }
  }

  if (!action?.options?.length) {
    await interaction.reply({ content: '❌ No options configured for this action.', flags: MessageFlags.Ephemeral });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`qa_select:${actionType}:${actionId}:${pageId}:${guildId}`)
    .setPlaceholder(action.label)
    .addOptions(action.options.slice(0, 25).map((opt) => ({ label: opt, value: opt })));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  await interaction.reply({ components: [row], flags: MessageFlags.Ephemeral });
}

async function handleAssignSelf(
  interaction: ButtonInteraction,
  actionId: string,
  pageId: string,
  guildId: string,
): Promise<void> {
  await interaction.reply({
    content: '⚠️ Assign-self requires mapping your Discord account to a Notion user. This feature requires additional configuration.',
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleQuickActionComment(interaction: ModalSubmitInteraction): Promise<void> {
  const [, pageId, guildId] = interaction.customId.split(':');
  const text = interaction.fields.getTextInputValue('comment_text');

  await interaction.deferReply({ ephemeral: true });

  try {
    const notion = getNotionClient(guildId);
    await addComment(notion, pageId, `${interaction.user.username}: ${text}`);
    await interaction.editReply({ content: '✅ Comment added to Notion.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({ content: `❌ Failed to add comment: ${message}` });
  }
}

export async function handleQuickActionSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, actionType, actionId, pageId, guildId] = interaction.customId.split(':');
  const value = interaction.values[0];

  await interaction.deferReply({ ephemeral: true });

  try {
    const notion = getNotionClient(guildId);
    const { loadGuild } = await import('../config/store');
    const guild = loadGuild(guildId);

    let propertyName = 'Status';
    let propType = actionType === 'status_change' ? 'status' : 'select';

    // Find action config for property name
    const allActions: QuickAction[] = [
      ...guild.notificationRules.flatMap((r) => r.quickActions),
      ...guild.createCommands.flatMap((c) => c.quickActions),
      ...guild.pageLists.flatMap((l) => l.quickActions),
    ];
    const action = allActions.find((a) => a.id === actionId);
    if (action?.propertyName) propertyName = action.propertyName;

    await updatePageProperty(notion, pageId, propertyName, propType, value);
    await interaction.editReply({ content: `✅ Updated **${propertyName}** to **${value}**.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({ content: `❌ Failed to update: ${message}` });
  }
}
