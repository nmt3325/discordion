import {
  SlashCommandBuilder,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

type CommandDefinition = Pick<SlashCommandBuilder, 'toJSON'>;

const commands: CommandDefinition[] = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Connect your Notion workspace to this Discord server')
    .addStringOption((o) =>
      o
        .setName('token')
        .setDescription('Your Notion integration token (starts with secret_)')
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('find')
    .setDescription('Search Notion pages by title')
    .addStringOption((o) =>
      o
        .setName('query')
        .setDescription('Word, project code, ticket number, or customer name')
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('create-page')
    .setDescription('Create a new Notion page from Discord')
    .addStringOption((o) =>
      o
        .setName('command')
        .setDescription('Which create command to use (leave blank to see all)')
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('pages')
    .setDescription('Browse a Notion database from Discord')
    .addStringOption((o) =>
      o
        .setName('list')
        .setDescription('Which page list to browse (leave blank to see all)')
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('notification')
    .setDescription('Manage notification rules')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a notification rule')
        .addStringOption((o) =>
          o.setName('name').setDescription('Rule name').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('source')
            .setDescription('Source type')
            .setRequired(true)
            .addChoices(
              { name: 'All pages', value: 'all_pages' },
              { name: 'Database items', value: 'database' },
              { name: 'Selected pages', value: 'selected_pages' },
            ),
        )
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Discord channel to post notifications').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('delivery')
            .setDescription('Delivery type (default: realtime)')
            .setRequired(false)
            .addChoices(
              { name: 'Realtime', value: 'realtime' },
              { name: 'Daily digest', value: 'digest_daily' },
              { name: 'Weekly digest', value: 'digest_weekly' },
              { name: 'Hourly digest', value: 'digest_hourly' },
            ),
        )
        .addStringOption((o) =>
          o
            .setName('source_id')
            .setDescription('Database or page ID (required for database/selected_pages source)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all notification rules'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a notification rule')
        .addStringOption((o) =>
          o.setName('id').setDescription('Rule ID').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable a rule')
        .addStringOption((o) =>
          o.setName('id').setDescription('Rule ID').setRequired(true),
        ),
    ),

  new SlashCommandBuilder()
    .setName('create-command')
    .setDescription('Manage create commands')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a create command')
        .addStringOption((o) =>
          o.setName('name').setDescription('Command name (e.g. "bug", "task")').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('destination')
            .setDescription('Destination type')
            .setRequired(true)
            .addChoices(
              { name: 'Database', value: 'database' },
              { name: 'Parent page', value: 'parent_page' },
            ),
        )
        .addStringOption((o) =>
          o.setName('destination_id').setDescription('Database or parent page ID').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all create commands'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a create command')
        .addStringOption((o) =>
          o.setName('id').setDescription('Command ID').setRequired(true),
        ),
    ),

  new SlashCommandBuilder()
    .setName('page-list')
    .setDescription('Manage page list commands')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a page list command')
        .addStringOption((o) =>
          o.setName('name').setDescription('List name (e.g. "tasks", "bugs")').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('source')
            .setDescription('Source type')
            .setRequired(true)
            .addChoices(
              { name: 'Database items', value: 'database' },
              { name: 'All pages', value: 'all_pages' },
            ),
        )
        .addStringOption((o) =>
          o.setName('source_id').setDescription('Database ID (required for database source)').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all page list commands'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a page list command')
        .addStringOption((o) =>
          o.setName('id').setDescription('List ID').setRequired(true),
        ),
    ),

  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Manage Discord panels')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new panel')
        .addStringOption((o) =>
          o.setName('name').setDescription('Panel name').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('title').setDescription('Panel title shown in Discord').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('description').setDescription('Panel description text').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all panels'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('publish')
        .setDescription('Publish a panel to a channel')
        .addStringOption((o) =>
          o.setName('id').setDescription('Panel ID').setRequired(true),
        )
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Channel to publish to').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a panel')
        .addStringOption((o) =>
          o.setName('id').setDescription('Panel ID').setRequired(true),
        ),
    ),

  new SlashCommandBuilder()
    .setName('summary')
    .setDescription('Manage scheduled summaries')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a scheduled summary')
        .addStringOption((o) =>
          o.setName('name').setDescription('Summary name').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('database_id').setDescription('Notion database ID').setRequired(true),
        )
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Discord channel').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('frequency')
            .setDescription('How often to send')
            .setRequired(true)
            .addChoices(
              { name: 'Daily', value: 'daily' },
              { name: 'Weekly', value: 'weekly' },
              { name: 'Hourly', value: 'hourly' },
            ),
        )
        .addStringOption((o) =>
          o
            .setName('time')
            .setDescription('Time to send (HH:MM, 24h UTC, e.g. 09:00)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all scheduled summaries'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a scheduled summary')
        .addStringOption((o) =>
          o.setName('id').setDescription('Summary ID').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('run')
        .setDescription('Manually trigger a scheduled summary now')
        .addStringOption((o) =>
          o.setName('id').setDescription('Summary ID').setRequired(true),
        ),
    ),

  new SlashCommandBuilder()
    .setName('embed-discord')
    .setDescription('Embed this Discord channel in a Notion page')
    .addStringOption((o) =>
      o.setName('page_id').setDescription('Notion page ID to embed this channel into').setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show connection status and available commands'),
];

export function getCommandsJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return commands.map((c) => c.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody);
}

export default commands;
