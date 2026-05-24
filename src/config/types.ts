export type SourceType = 'all_pages' | 'database' | 'selected_pages';
export type DeliveryType = 'realtime' | 'digest_daily' | 'digest_weekly' | 'digest_hourly';
export type ScheduleFrequency = 'daily' | 'weekly' | 'hourly';
export type ButtonStyle = 'primary' | 'secondary' | 'success' | 'danger';
export type QuickActionType = 'comment' | 'file_upload' | 'status_change' | 'select_change' | 'assign_self';

export interface DisplayField {
  propertyName: string;
  label?: string;
}

export interface Filter {
  property: string;
  condition: string;
  value: string;
}

export interface QuickAction {
  id: string;
  type: QuickActionType;
  label: string;
  propertyName?: string;
  options?: string[];
}

export interface FormField {
  id: string;
  name: string;
  notionProperty: string;
  type: 'title' | 'rich_text' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'number' | 'url' | 'email' | 'phone_number' | 'people';
  required: boolean;
  options?: string[];
}

export interface NotificationRule {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceId?: string;
  sourceName?: string;
  channelId: string;
  deliveryType: DeliveryType;
  filters: Filter[];
  watchedProperties: string[];
  displayFields: DisplayField[];
  quickActions: QuickAction[];
  mentionRoleId?: string;
  cardLanguage?: string;
  lastChecked: string;
  enabled: boolean;
  isDraft: boolean;
}

export interface CreateCommand {
  id: string;
  name: string;
  commandName: string;
  destinationType: 'database' | 'parent_page' | 'choose_in_discord';
  destinationId?: string;
  destinationName?: string;
  fields: FormField[];
  displayFields: DisplayField[];
  quickActions: QuickAction[];
  cardLanguage?: string;
  enablePrivateThread: boolean;
  enableFromMessages: boolean;
  enabled: boolean;
}

export interface PageList {
  id: string;
  name: string;
  commandName: string;
  sourceType: SourceType;
  sourceId?: string;
  sourceName?: string;
  filters: Filter[];
  displayFields: DisplayField[];
  sortProperty?: string;
  sortDirection?: 'ascending' | 'descending';
  sharingMode: 'off' | 'one_time' | 'refreshable';
  quickActions: QuickAction[];
  enabled: boolean;
}

export interface PanelButton {
  id: string;
  label: string;
  emoji?: string;
  style: ButtonStyle;
  actionType: 'create' | 'list';
  targetId: string;
}

export interface Panel {
  id: string;
  name: string;
  title: string;
  description?: string;
  channelId?: string;
  messageId?: string;
  buttons: PanelButton[];
  published: boolean;
}

export interface ScheduledSummary {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceId?: string;
  sourceName?: string;
  channelId: string;
  frequency: ScheduleFrequency;
  time: string;
  timezone: string;
  filters: Filter[];
  displayFields: DisplayField[];
  quickActions: QuickAction[];
  onlyWhenResults: boolean;
  enabled: boolean;
}

export interface GuildConfig {
  guildId: string;
  notionToken?: string;
  notionWorkspaceId?: string;
  notionWorkspaceName?: string;
  notificationRules: NotificationRule[];
  createCommands: CreateCommand[];
  pageLists: PageList[];
  panels: Panel[];
  scheduledSummaries: ScheduledSummary[];
  createdAt: string;
  updatedAt: string;
}
