import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Client } from '@notionhq/client';
import { loadGuild, saveGuild } from '../config/store';

export async function handleSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  const token = interaction.options.getString('token', true);
  const guildId = interaction.guildId!;

  await interaction.deferReply({ ephemeral: true });

  // Validate the token by making a test request
  const notion = new Client({ auth: token });
  try {
    const me = await notion.users.me({});
    const workspaceName = ('workspace_name' in me ? (me as { workspace_name: string }).workspace_name : undefined) ?? 'Your workspace';

    const guild = loadGuild(guildId);
    guild.notionToken = token;
    guild.notionWorkspaceName = workspaceName;
    saveGuild(guild);

    const embed = new EmbedBuilder()
      .setColor(0x00b37d)
      .setTitle('✅ Notion Connected')
      .setDescription(
        `Successfully connected to **${workspaceName}**.\n\nYou can now:\n` +
          '• Use `/notification add` to send Notion updates to Discord\n' +
          '• Use `/create-command add` to create Notion pages from Discord\n' +
          '• Use `/page-list add` to browse Notion databases\n' +
          '• Use `/find <query>` to search Notion pages\n' +
          '• Use `/panel create` to add button menus to channels',
      )
      .setFooter({ text: 'Run /help at any time to see your connection status' });

    await interaction.editReply({ embeds: [embed] });
  } catch {
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Connection Failed')
      .setDescription(
        'Could not connect to Notion. Please check that:\n' +
          '• Your integration token is correct (starts with `secret_`)\n' +
          '• The integration has been added to your Notion workspace\n' +
          '• You have shared at least one page with the integration',
      );
    await interaction.editReply({ embeds: [embed] });
  }
}
