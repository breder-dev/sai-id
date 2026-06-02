import { randomUUID } from 'crypto';
import type { FixtureUser, ImportResult } from 'types';

// Claims with a direct mapping to FixtureUser fields
const CLAIM_MAP: Record<string, keyof FixtureUser> = {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'firstName',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'lastName',
  'http://schemas.microsoft.com/identity/claims/displayname': 'displayName',
  'http://schemas.microsoft.com/identity/claims/objectidentifier': 'entraObjectId',
  'http://schemas.microsoft.com/identity/claims/tenantid': 'tenantId',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups': 'groups',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'roles',
};

// Internal Entra metadata — not useful for mock testing
const IGNORE_CLAIMS = new Set([
  'http://schemas.microsoft.com/identity/claims/identityprovider',
  'http://schemas.microsoft.com/claims/authnmethodsreferences',
]);

type ParsedAttributes = Record<string, string[]>;

function extractAttributes(xml: string): ParsedAttributes {
  const result: ParsedAttributes = {};

  // Match <Attribute Name="...">...</Attribute> with optional namespace prefix
  const attrBlockPattern =
    /<(?:[\w]+:)?Attribute\s[^>]*\bName="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[\w]+:)?Attribute>/g;
  const attrValuePattern =
    /<(?:[\w]+:)?AttributeValue[^>]*>([\s\S]*?)<\/(?:[\w]+:)?AttributeValue>/g;

  for (const attrMatch of xml.matchAll(attrBlockPattern)) {
    const name = attrMatch[1];
    const block = attrMatch[2];
    const values: string[] = [];

    for (const valMatch of block.matchAll(attrValuePattern)) {
      const text = valMatch[1].trim();
      if (text) values.push(text);
    }

    if (values.length > 0) result[name] = values;
  }

  return result;
}

function extractNameId(xml: string): string {
  const m = xml.match(/<(?:[\w]+:)?NameID[^>]*>([\s\S]*?)<\/(?:[\w]+:)?NameID>/);
  return m ? m[1].trim() : '';
}

export function parseSAMLResponseXML(xml: string, fileName: string): ImportResult {
  const attrs = extractAttributes(xml);

  const mapped: Partial<Record<keyof FixtureUser, string | string[]>> = {
    groups: [],
    roles: [],
  };
  const customClaims: Record<string, string | string[]> = {};

  for (const [claimName, values] of Object.entries(attrs)) {
    if (IGNORE_CLAIMS.has(claimName)) continue;

    const field = CLAIM_MAP[claimName];
    if (field) {
      mapped[field] = field === 'groups' || field === 'roles' ? values : values[0];
    } else {
      customClaims[claimName] = values.length === 1 ? values[0] : values;
    }
  }

  // Resolve email — prefer claims/name attribute, fall back to NameID element
  const email = (mapped.email as string) || extractNameId(xml);
  if (!email) {
    return { file: fileName, email: '', status: 'skipped', reason: 'no email claim or NameID found' };
  }

  // Derive name fields from email prefix when not present in XML
  const emailPrefix = email.split('@')[0];

  const user: FixtureUser = {
    id: randomUUID(),
    email,
    firstName: (mapped.firstName as string) || emailPrefix,
    lastName: (mapped.lastName as string) || emailPrefix,
    displayName: (mapped.displayName as string) || emailPrefix,
    entraObjectId: (mapped.entraObjectId as string) || randomUUID(),
    tenantId: (mapped.tenantId as string) || '',
    groups: (mapped.groups as string[]) || [],
    roles: (mapped.roles as string[]) || [],
    ...(Object.keys(customClaims).length > 0 ? { customClaims } : {}),
  };

  return { file: fileName, email, status: 'imported', user };
}
