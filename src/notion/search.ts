import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { getPageTitle, getPageUrl } from './helpers';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  lastEdited: string;
  objectType: 'page' | 'database';
  parentType: string;
}

export async function searchNotionPages(
  client: Client,
  query: string,
  limit = 10,
): Promise<SearchResult[]> {
  const response = await client.search({
    query,
    filter: { property: 'object', value: 'page' },
    sort: { direction: 'descending', timestamp: 'last_edited_time' },
    page_size: Math.min(limit, 25),
  });

  const results: SearchResult[] = [];
  for (const item of response.results) {
    if (item.object !== 'page') continue;
    const page = item as PageObjectResponse;
    results.push({
      id: page.id,
      title: getPageTitle(page),
      url: getPageUrl(page),
      lastEdited: page.last_edited_time,
      objectType: 'page',
      parentType: page.parent.type,
    });
  }
  return results;
}

export async function getDatabaseItems(
  client: Client,
  databaseId: string,
  filters: { property: string; condition: string; value: string }[] = [],
  sortProperty?: string,
  sortDirection: 'ascending' | 'descending' = 'descending',
  limit = 10,
): Promise<PageObjectResponse[]> {
  const sorts: ({ property: string; direction: 'ascending' | 'descending' } | { timestamp: 'last_edited_time' | 'created_time'; direction: 'ascending' | 'descending' })[] = [];
  if (sortProperty) {
    sorts.push({ property: sortProperty, direction: sortDirection });
  } else {
    sorts.push({ timestamp: 'last_edited_time', direction: 'descending' });
  }

  const response = await client.databases.query({
    database_id: databaseId,
    page_size: Math.min(limit, 25),
    sorts,
  });

  return response.results.filter((r): r is PageObjectResponse => r.object === 'page');
}

export async function getSharedDatabases(client: Client): Promise<{ id: string; title: string }[]> {
  const response = await client.search({
    filter: { property: 'object', value: 'database' },
    page_size: 25,
  });
  return response.results
    .filter((r) => r.object === 'database')
    .map((r) => {
      const db = r as { id: string; title: { plain_text: string }[] };
      return {
        id: db.id,
        title: db.title?.map((t) => t.plain_text).join('') || 'Untitled Database',
      };
    });
}

export async function getSharedPages(client: Client): Promise<{ id: string; title: string }[]> {
  const response = await client.search({
    filter: { property: 'object', value: 'page' },
    page_size: 25,
  });
  return response.results
    .filter((r) => r.object === 'page')
    .map((r) => {
      const page = r as PageObjectResponse;
      return {
        id: page.id,
        title: getPageTitle(page),
      };
    });
}

export async function createNotionPage(
  client: Client,
  parentId: string,
  parentType: 'database_id' | 'page_id',
  fields: { propertyName: string; type: string; value: string }[],
): Promise<{ id: string; url: string; title: string }> {
  const properties: Record<string, unknown> = {};

  for (const field of fields) {
    if (!field.value) continue;
    switch (field.type) {
      case 'title':
        properties[field.propertyName] = { title: [{ text: { content: field.value } }] };
        break;
      case 'rich_text':
        properties[field.propertyName] = { rich_text: [{ text: { content: field.value } }] };
        break;
      case 'select':
        properties[field.propertyName] = { select: { name: field.value } };
        break;
      case 'multi_select':
        properties[field.propertyName] = {
          multi_select: field.value.split(',').map((v) => ({ name: v.trim() })),
        };
        break;
      case 'checkbox':
        properties[field.propertyName] = { checkbox: field.value === 'true' };
        break;
      case 'number':
        properties[field.propertyName] = { number: parseFloat(field.value) };
        break;
      case 'url':
        properties[field.propertyName] = { url: field.value };
        break;
      case 'email':
        properties[field.propertyName] = { email: field.value };
        break;
      case 'phone_number':
        properties[field.propertyName] = { phone_number: field.value };
        break;
      case 'date':
        properties[field.propertyName] = { date: { start: field.value } };
        break;
    }
  }

  const parent = parentType === 'database_id'
    ? { database_id: parentId }
    : { page_id: parentId };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await client.pages.create({ parent, properties: properties as any });
  const page = response as PageObjectResponse;
  return {
    id: page.id,
    url: page.url,
    title: getPageTitle(page),
  };
}

export async function addComment(
  client: Client,
  pageId: string,
  text: string,
): Promise<void> {
  await client.comments.create({
    parent: { page_id: pageId },
    rich_text: [{ text: { content: text } }],
  });
}

export async function updatePageProperty(
  client: Client,
  pageId: string,
  propertyName: string,
  propertyType: string,
  value: string,
): Promise<void> {
  const properties: Record<string, unknown> = {};
  switch (propertyType) {
    case 'status':
      properties[propertyName] = { status: { name: value } };
      break;
    case 'select':
      properties[propertyName] = { select: { name: value } };
      break;
    case 'checkbox':
      properties[propertyName] = { checkbox: value === 'true' };
      break;
    default:
      properties[propertyName] = { rich_text: [{ text: { content: value } }] };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await client.pages.update({ page_id: pageId, properties: properties as any });
}
