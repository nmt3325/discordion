import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { handleSetup } from '../handlers/setup';
import { handleFind } from '../handlers/find';
import { handleCreatePage, handleCreateModal } from '../handlers/create-page';
import { handlePages, handlePagesShare, handlePagesRefresh } from '../handlers/pages';
import { handleNotification } from '../handlers/notification';
import { handleCreateCommand, handlePageList } from '../handlers/manage-commands';
import { handlePanel, handlePanelButton } from '../handlers/panels';
import { handleSummary } from '../handlers/summary';
import { handleHelp } from '../handlers/help';
import { handleEmbedDiscord } from '../handlers/embed-discord';
import {
  handleQuickActionButton,
  handleQuickActionComment,
  handleQuickActionSelect,
} from '../handlers/quick-actions';

export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      await routeCommand(interaction);
    } else if (interaction.isButton()) {
      await routeButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await routeModal(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await routeSelect(interaction);
    }
  } catch (err) {
    console.error('[Interactions] Unhandled error:', err);
    const reply = { content: '❌ An unexpected error occurred.', ephemeral: true };
    try {
      if (interaction.isRepliable()) {
        if ('deferred' in interaction && interaction.deferred) {
          await interaction.editReply(reply);
        } else if ('replied' in interaction && !interaction.replied) {
          await interaction.reply(reply);
        }
      }
    } catch {
      // Ignore reply errors
    }
  }
}

async function routeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case 'setup': return handleSetup(interaction);
    case 'find': return handleFind(interaction);
    case 'create-page': return handleCreatePage(interaction);
    case 'pages': return handlePages(interaction);
    case 'notification': return handleNotification(interaction);
    case 'create-command': return handleCreateCommand(interaction);
    case 'page-list': return handlePageList(interaction);
    case 'panel': return handlePanel(interaction);
    case 'summary': return handleSummary(interaction);
    case 'embed-discord': return handleEmbedDiscord(interaction);
    case 'help': return handleHelp(interaction);
    default:
      await interaction.reply({ content: '❌ Unknown command.', ephemeral: true });
  }
}

async function routeButton(interaction: ButtonInteraction): Promise<void> {
  const id = interaction.customId;
  if (id.startsWith('qa:')) return handleQuickActionButton(interaction);
  if (id.startsWith('pages_share:')) return handlePagesShare(interaction);
  if (id.startsWith('pages_refresh:')) return handlePagesRefresh(interaction);
  if (id.startsWith('panel_btn:')) return handlePanelButton(interaction);
  // find_detail is handled inline via collector
}

async function routeModal(interaction: ModalSubmitInteraction): Promise<void> {
  const id = interaction.customId;
  if (id.startsWith('create_modal:')) return handleCreateModal(interaction);
  if (id.startsWith('qa_comment:')) return handleQuickActionComment(interaction);
}

async function routeSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const id = interaction.customId;
  if (id.startsWith('qa_select:')) return handleQuickActionSelect(interaction);
}
