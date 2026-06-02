import fs from 'fs';
import path from 'path';
import { parseSAMLResponseXML } from 'lib/xml-import';
import type { ImportResult } from 'types';
import { upsertFixtureUser } from 'lib/fixtures';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { FixtureUser } from 'types';

const XML_DIR =
  process.env.XML_IMPORT_DIR || path.join(process.cwd(), 'fixtures', 'xml');

function parseDirectory(): ImportResult[] {
  if (!fs.existsSync(XML_DIR)) return [];
  const files = fs.readdirSync(XML_DIR).filter((f) => f.toLowerCase().endsWith('.xml'));
  return files.map((file) => {
    const xml = fs.readFileSync(path.join(XML_DIR, file), 'utf-8');
    return parseSAMLResponseXML(xml, file);
  });
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET ?dry=true → parse only, no upsert
  if (req.method === 'GET') {
    const results = parseDirectory();
    return res.json({ results });
  }

  // POST { users: FixtureUser[] } → save the user-selected subset
  if (req.method === 'POST') {
    const { users } = req.body as { users: FixtureUser[] };
    if (!Array.isArray(users)) return res.status(400).json({ error: 'users must be an array' });

    for (const user of users) {
      upsertFixtureUser(user);
    }
    return res.json({ imported: users.length });
  }

  res.status(405).end();
}
