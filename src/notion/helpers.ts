import {
  PageObjectResponse,
  DatabaseObjectResponse,
  PartialPageObjectResponse,
  PartialDatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { DisplayField } from '../config/types';

type AnyPage = PageObjectResponse | PartialPageObjectResponse | DatabaseObjectResponse | PartialDatabaseObjectResponse;

export function getPageTitle(page: AnyPage): string {
  if (!('properties' in page)) return 'Untitled';
  for (const prop of Object.values(page.properties)) {
    if (prop.type === 'title') {
      return prop.title.map((t: { plain_text: string }) => t.plain_text).join('') || 'Untitled';
    }
  }
  return 'Untitled';
}

export function getPageUrl(page: AnyPage): string {
  if (!('url' in page)) return '';
  return page.url;
}

export function getPropertyValue(page: PageObjectResponse, propertyName: string): string {
  const prop = page.properties[propertyName];
  if (!prop) return '';

  switch (prop.type) {
    case 'title':
      return prop.title.map((t) => t.plain_text).join('');
    case 'rich_text':
      return prop.rich_text.map((t) => t.plain_text).join('');
    case 'select':
      return prop.select?.name ?? '';
    case 'multi_select':
      return prop.multi_select.map((s) => s.name).join(', ');
    case 'date':
      return prop.date?.start ?? '';
    case 'checkbox':
      return prop.checkbox ? '✓' : '✗';
    case 'number':
      return prop.number?.toString() ?? '';
    case 'url':
      return prop.url ?? '';
    case 'email':
      return prop.email ?? '';
    case 'phone_number':
      return prop.phone_number ?? '';
    case 'people':
      return prop.people.map((p) => ('name' in p ? p.name : 'Unknown')).join(', ');
    case 'status':
      return prop.status?.name ?? '';
    case 'last_edited_time':
      return new Date(prop.last_edited_time).toLocaleString();
    case 'created_time':
      return new Date(prop.created_time).toLocaleString();
    case 'last_edited_by':
      return 'name' in prop.last_edited_by ? (prop.last_edited_by.name ?? '') : '';
    case 'created_by':
      return 'name' in prop.created_by ? (prop.created_by.name ?? '') : '';
    default:
      return '';
  }
}

export function buildPageEmbed(
  page: PageObjectResponse,
  displayFields: DisplayField[],
  color = 0x5865f2,
): Record<string, unknown> {
  const title = getPageTitle(page);
  const url = getPageUrl(page);
  const fields: { name: string; value: string; inline: boolean }[] = [];

  for (const df of displayFields) {
    const value = getPropertyValue(page, df.propertyName);
    if (value) {
      fields.push({
        name: df.label ?? df.propertyName,
        value: value.length > 1024 ? value.slice(0, 1021) + '...' : value,
        inline: true,
      });
    }
  }

  const lastEdited = 'last_edited_time' in page ? new Date(page.last_edited_time).toISOString() : undefined;

  return {
    title: title.length > 256 ? title.slice(0, 253) + '...' : title,
    url,
    color,
    fields,
    footer: { text: 'Notion' },
    timestamp: lastEdited,
  };
}

export function getDatabaseProperties(page: PageObjectResponse): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, prop] of Object.entries(page.properties)) {
    result[name] = prop.type;
  }
  return result;
}

export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
