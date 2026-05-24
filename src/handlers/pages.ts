import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ButtonInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { getNotionClient } from '../notion/client';
import { getDatabaseItems, searchNotionPages } from '../notion/search';
import { buildPageEmbed, getPageTitle, getPageUrl } from '../notion/helpers';
import { loadGuild } from '../config/store';
import { PageList } from '../config/types';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export async function handlePages(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = loadGuild(guildId);
  const listArg = interaction.options.getString('list');

  const enabled = guild.pageLists.filter((l) => l.enabled);
  if (enabled.length === 0) {
    await interaction.reply({
      content: '❌ No page lists configured. Use `/page-list add` to set one up.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let pageList: PageList | undefined;

  if (listArg) {
    pageList = enabled.find((l) => l.commandName === listArg || l.id === listArg);
    if (!pageList) {
      await interaction.reply({
        content: `❌ Page list "${listArg}" not found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  } else if (enabled.length === 1) {
    pageList = enabled[0];
  } else {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`pages_select:${guildId}`)
      .setPlaceholder('Select a page list...')
      .addOptions(
        enabled.slice(0, 25).map((l) => ({
          label: l.name,
          value: l.id,
          description: `/${l.commandName}`,
        })),
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    const reply = await interaction.reply({
      content: 'Which page list would you like to browse?',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    const sel = await reply
      .awaitMessageComponent({ componentType: ComponentType.StringSelect, time: 60_000 })
      .catch(() => null);
    if (!sel) {
      await interaction.editReply({ content: 'Timed out.', components: [] });
      return;
    }
    pageList = enabled.find((l) => l.id === sel.values[0]);
    await sel.deferUpdate();
  }

  if (!pageList) return;

  await (interaction.deferred ? interaction.editReply({ content: 'Loading...' }) : interaction.deferReply({ ephemeral: true }));
  await showPageList(interaction, pageList, guildId);
}

export async function showPageList(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  pageList: PageList,
  guildId: string,
  startCursor?: string,
): Promise<void> {
  try {
    const notion = getNotionClient(guildId);
    let pages: PageObjectResponse[] = [];

    if (pageList.sourceType === 'database' && pageList.sourceId) {
      pages = await getDatabaseItems(
        notion,
        pageList.sourceId,
        pageList.filters,
        pageList.sortProperty,
        pageList.sortDirection ?? 'descending',
        10,
      );
    } else {
      const results = await searchNotionPages(notion, '', 10);
      pages = results.map((r) => ({ id: r.id, url: r.url } as PageObjectResponse));
    }

    if (pages.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setTitle(pageList.name)
        .setDescription('No items found.');
      await interaction.editReply({ embeds: [emptyEmbed], components: [] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(pageList.name)
      .setFooter({ text: `Notion · Showing ${Math.min(pages.length, 10)} items` });

    const fields = pages.slice(0, 10).map((page) => {
      const title = getPageTitle(page);
      const url = getPageUrl(page);
      const lines: string[] = [`[Open in Notion](${url})`];
      for (const df of pageList!.displayFields.slice(0, 3)) {
        if ('properties' in page && page.properties) {
          const propNames = Object.keys(page.properties);
          const matchedProp = propNames.find(
            (n) => n.toLowerCase() === df.propertyName.toLowerCase(),
          );
          if (matchedProp) {
            const { getPropertyValue } = require('../notion/helpers') as typeof import('../notion/helpers');
            const value = getPropertyValue(page as PageObjectResponse, matchedProp);
            if (value) lines.push(`**${df.label ?? df.propertyName}:** ${value}`);
          }
        }
      }
      return { name: title.slice(0, 256), value: lines.join('\n').slice(0, 1024), inline: false };
    });
    embed.addFields(fields);

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (pages.length >= 10) {
      const moreBtn = new ButtonBuilder()
        .setCustomId(`pages_more:${pageList.id}:${guildId}`)
        .setLabel('Show More')
        .setStyle(ButtonStyle.Secondary);
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(moreBtn));
    }

    if (pageList.sharingMode !== 'off') {
      const shareBtn = new ButtonBuilder()
        .setCustomId(`pages_share:${pageList.id}:${guildId}`)
        .setLabel(pageList.sharingMode === 'refreshable' ? 'Post (Refreshable)' : 'Post Snapshot')
        .setStyle(ButtonStyle.Primary);
      if (components.length === 0) components.push(new ActionRowBuilder<ButtonBuilder>());
      components[components.length - 1].addComponents(shareBtn);
    }

    await interaction.editReply({ embeds: [embed], components });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({ content: `❌ Error loading pages: ${message}`, components: [] });
  }
}

export async function handlePagesShare(interaction: ButtonInteraction): Promise<void> {
  const [, listId, guildId] = interaction.customId.split(':');
  const guild = loadGuild(guildId);
  const pageList = guild.pageLists.find((l) => l.id === listId);
  if (!pageList) {
    await interaction.reply({ content: '❌ Page list not found.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  try {
    const notion = getNotionClient(guildId);
    let pages: PageObjectResponse[] = [];

    if (pageList.sourceType === 'database' && pageList.sourceId) {
      pages = await getDatabaseItems(notion, pageList.sourceId, pageList.filters, pageList.sortProperty, pageList.sortDirection ?? 'descending', 10);
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(pageList.name)
      .setFooter({ text: `Notion · ${new Date().toLocaleString()}` });

    const fields = pages.slice(0, 10).map((page) => ({
      name: getPageTitle(page).slice(0, 256),
      value: `[Open in Notion](${getPageUrl(page)})`,
      inline: false,
    }));
    embed.addFields(fields);

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (pageList.sharingMode === 'refreshable') {
      const refreshBtn = new ButtonBuilder()
        .setCustomId(`pages_refresh:${pageList.id}:${guildId}`)
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Secondary);
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(refreshBtn));
    }

    await interaction.editReply({ embeds: [embed], components });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({ content: `❌ Error: ${message}` });
  }
}

export async function handlePagesRefresh(interaction: ButtonInteraction): Promise<void> {
  const [, listId, guildId] = interaction.customId.split(':');
  const guild = loadGuild(guildId);
  const pageList = guild.pageLists.find((l) => l.id === listId);
  if (!pageList) {
    await interaction.reply({ content: '❌ Page list not found.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();

  try {
    const notion = getNotionClient(guildId);
    let pages: PageObjectResponse[] = [];
    if (pageList.sourceType === 'database' && pageList.sourceId) {
      pages = await getDatabaseItems(notion, pageList.sourceId, pageList.filters, pageList.sortProperty, pageList.sortDirection ?? 'descending', 10);
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(pageList.name)
      .setFooter({ text: `Notion · Updated ${new Date().toLocaleString()}` });

    const fields = pages.slice(0, 10).map((page) => ({
      name: getPageTitle(page).slice(0, 256),
      value: `[Open in Notion](${getPageUrl(page)})`,
      inline: false,
    }));
    embed.addFields(fields);

    const refreshBtn = new ButtonBuilder()
      .setCustomId(`pages_refresh:${pageList.id}:${guildId}`)
      .setLabel('🔄 Refresh')
      .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(refreshBtn);

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await interaction.editReply({ content: `❌ Error: ${message}`, components: [] });
  }
}
