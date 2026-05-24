import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { loadGuild, saveGuild, generateId } from '../config/store';
import { CreateCommand, PageList, FormField } from '../config/types';

// --- Create Commands ---

export async function handleCreateCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  switch (sub) {
    case 'add': return handleCreateCommandAdd(interaction);
    case 'list': return handleCreateCommandList(interaction);
    case 'remove': return handleCreateCommandRemove(interaction);
  }
}

async function handleCreateCommandAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const name = interaction.options.getString('name', true);
  const destination = interaction.options.getString('destination', true) as 'database' | 'parent_page';
  const destinationId = interaction.options.getString('destination_id', true);

  const guild = loadGuild(guildId);

  const defaultFields: FormField[] = [
    {
      id: generateId(),
      name: 'Title',
      notionProperty: 'Name',
      type: 'title',
      required: true,
    },
    {
      id: generateId(),
      name: 'Description',
      notionProperty: 'Description',
      type: 'rich_text',
      required: false,
    },
  ];

  const cmd: CreateCommand = {
    id: generateId(),
    name,
    commandName: name.toLowerCase().replace(/\s+/g, '-').slice(0, 32),
    destinationType: destination,
    destinationId,
    fields: defaultFields,
    displayFields: [],
    quickActions: [],
    enablePrivateThread: false,
    enableFromMessages: false,
    enabled: true,
  };

  guild.createCommands.push(cmd);
  saveGuild(guild);

  const embed = new EmbedBuilder()
    .setColor(0x00b37d)
    .setTitle('✅ Create Command Added')
    .addFields(
      { name: 'Name', value: cmd.name, inline: true },
      { name: 'ID', value: `\`${cmd.id}\``, inline: true },
      { name: 'Destination', value: `${destination} (${destinationId.slice(0, 8)}...)`, inline: true },
    )
    .setDescription(
      `Use \`/create-page command:${cmd.commandName}\` to create pages.\n\n` +
        'Default fields: Title, Description (edit the config JSON to customize fields).',
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleCreateCommandList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = loadGuild(guildId);

  if (guild.createCommands.length === 0) {
    await interaction.reply({
      content: 'No create commands configured. Use `/create-command add` to add one.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Create Commands')
    .addFields(
      guild.createCommands.map((c) => ({
        name: `${c.enabled ? '🟢' : '🔴'} ${c.name}`,
        value: `ID: \`${c.id}\` · Destination: ${c.destinationType} · Fields: ${c.fields.length}`,
        inline: false,
      })),
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleCreateCommandRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const cmdId = interaction.options.getString('id', true);
  const guild = loadGuild(guildId);

  const idx = guild.createCommands.findIndex((c) => c.id === cmdId);
  if (idx === -1) {
    await interaction.reply({ content: `❌ Command \`${cmdId}\` not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const [removed] = guild.createCommands.splice(idx, 1);
  saveGuild(guild);
  await interaction.reply({ content: `✅ Removed command **${removed.name}**.`, flags: MessageFlags.Ephemeral });
}

// --- Page Lists ---

export async function handlePageList(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();
  switch (sub) {
    case 'add': return handlePageListAdd(interaction);
    case 'list': return handlePageListList(interaction);
    case 'remove': return handlePageListRemove(interaction);
  }
}

async function handlePageListAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const name = interaction.options.getString('name', true);
  const source = interaction.options.getString('source', true) as 'database' | 'all_pages';
  const sourceId = interaction.options.getString('source_id') ?? undefined;

  if (source === 'database' && !sourceId) {
    await interaction.reply({
      content: '❌ `source_id` is required for database source.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guild = loadGuild(guildId);

  const list: PageList = {
    id: generateId(),
    name,
    commandName: name.toLowerCase().replace(/\s+/g, '-').slice(0, 32),
    sourceType: source,
    sourceId,
    filters: [],
    displayFields: [],
    sharingMode: 'off',
    quickActions: [],
    enabled: true,
  };

  guild.pageLists.push(list);
  saveGuild(guild);

  const embed = new EmbedBuilder()
    .setColor(0x00b37d)
    .setTitle('✅ Page List Added')
    .addFields(
      { name: 'Name', value: list.name, inline: true },
      { name: 'ID', value: `\`${list.id}\``, inline: true },
      { name: 'Source', value: source + (sourceId ? ` (${sourceId.slice(0, 8)}...)` : ''), inline: true },
    )
    .setDescription(`Use \`/pages list:${list.commandName}\` to browse this list.`);

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handlePageListList(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = loadGuild(guildId);

  if (guild.pageLists.length === 0) {
    await interaction.reply({
      content: 'No page lists configured. Use `/page-list add` to add one.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Page Lists')
    .addFields(
      guild.pageLists.map((l) => ({
        name: `${l.enabled ? '🟢' : '🔴'} ${l.name}`,
        value: `ID: \`${l.id}\` · Source: ${l.sourceType} · Command: \`/${l.commandName}\``,
        inline: false,
      })),
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handlePageListRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const listId = interaction.options.getString('id', true);
  const guild = loadGuild(guildId);

  const idx = guild.pageLists.findIndex((l) => l.id === listId);
  if (idx === -1) {
    await interaction.reply({ content: `❌ List \`${listId}\` not found.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const [removed] = guild.pageLists.splice(idx, 1);
  saveGuild(guild);
  await interaction.reply({ content: `✅ Removed list **${removed.name}**.`, flags: MessageFlags.Ephemeral });
}
