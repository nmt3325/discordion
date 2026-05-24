import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { getNotionClient } from '../notion/client';

export async function handleEmbedDiscord(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const pageId = interaction.options.getString('page_id', true);
  const channelId = interaction.channelId;

  await interaction.deferReply({ ephemeral: true });

  try {
    const notion = getNotionClient(guildId);
    const page = await notion.pages.retrieve({ page_id: pageId });

    const embedUrl = `https://discord.com/channels/${guildId}/${channelId}`;
    const notionUrl = 'url' in page ? page.url : `https://notion.so/${pageId.replace(/-/g, '')}`;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Discord Channel Embed')
      .setDescription(
        `To embed this Discord channel in your Notion page:\n\n` +
          `1. Open the Notion page: [Open in Notion](${notionUrl})\n` +
          `2. Type \`/embed\` in Notion and select **Embed**\n` +
          `3. Paste this URL:\n\`\`\`${embedUrl}\`\`\`\n\n` +
          `**Note:** Viewers need to authenticate with Discord to see the embed. ` +
          `The embed shows message text, replies, links, attachments, and reactions (read-only).`,
      )
      .addFields({ name: 'Channel URL', value: embedUrl, inline: false })
      .setFooter({ text: 'Discordion · Discord Viewer' });

    await interaction.editReply({ embeds: [embed] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({ content: `❌ Error: ${message}` });
  }
}
