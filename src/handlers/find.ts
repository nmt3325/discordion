import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { getNotionClient } from '../notion/client';
import { searchNotionPages } from '../notion/search';
import { formatRelativeTime } from '../notion/helpers';

export async function handleFind(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString('query', true);
  const guildId = interaction.guildId!;

  await interaction.deferReply({ ephemeral: true });

  try {
    const notion = getNotionClient(guildId);
    const results = await searchNotionPages(notion, query, 10);

    if (results.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle('No results found')
        .setDescription(
          `No Notion pages matched **"${query}"**.\n\n` +
            '`/find` searches page titles only — not page content, comments, or property values.',
        );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Search: "${query}"`)
      .setDescription(`Found ${results.length} result${results.length === 1 ? '' : 's'}`)
      .setFooter({ text: 'Notion · /find searches page titles only' });

    const fields = results.slice(0, 10).map((r) => ({
      name: r.title || 'Untitled',
      value: `[Open in Notion](${r.url}) · ${formatRelativeTime(r.lastEdited)}`,
      inline: false,
    }));
    embed.addFields(fields);

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < Math.min(results.length, 5); i++) {
      const r = results[i];
      const btn = new ButtonBuilder()
        .setLabel(`Details: ${(r.title || 'Untitled').slice(0, 40)}`)
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`find_detail:${r.id}:${guildId}`);
      if (i % 5 === 0) {
        rows.push(new ActionRowBuilder<ButtonBuilder>());
      }
      rows[rows.length - 1].addComponents(btn);
    }

    const reply = await interaction.editReply({ embeds: [embed], components: rows.slice(0, 5) });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300_000,
      filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith('find_detail:'),
    });

    collector.on('collect', async (btnInteraction) => {
      const [, pageId] = btnInteraction.customId.split(':');
      const result = results.find((r) => r.id === pageId);
      if (!result) {
        await btnInteraction.reply({ content: 'Page not found.', ephemeral: true });
        return;
      }
      const detailEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(result.title || 'Untitled')
        .setURL(result.url)
        .addFields(
          { name: 'Last Edited', value: formatRelativeTime(result.lastEdited), inline: true },
          { name: 'Type', value: result.parentType === 'database_id' ? 'Database Item' : 'Page', inline: true },
        )
        .setFooter({ text: 'Notion' });
      await btnInteraction.reply({ embeds: [detailEmbed], ephemeral: true });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({
      content: `❌ Error: ${message}\n\nMake sure you've run \`/setup\` to connect Notion.`,
    });
  }
}
