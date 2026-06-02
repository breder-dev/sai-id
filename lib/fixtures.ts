import fs from 'fs';
import path from 'path';
import type { FixtureUser, FixturesDb } from 'types';

const fixturePath = path.join(process.cwd(), 'fixtures', 'users.json');

let cachedFixtures: FixturesDb | null = null;

function loadFixtures(): FixturesDb {
  if (cachedFixtures) return cachedFixtures;
  try {
    const raw = fs.readFileSync(fixturePath, 'utf-8');
    cachedFixtures = JSON.parse(raw) as FixturesDb;
    return cachedFixtures;
  } catch {
    return {};
  }
}

function saveFixtures(db: FixturesDb): void {
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, JSON.stringify(db, null, 2), 'utf-8');
  cachedFixtures = db;
}

export function getFixtureUser(email: string): FixtureUser | null {
  return loadFixtures()[email] ?? null;
}

export function listFixtureUsers(): FixtureUser[] {
  return Object.values(loadFixtures());
}

export function upsertFixtureUser(user: FixtureUser, originalEmail?: string): void {
  const db = { ...loadFixtures() };
  if (originalEmail && originalEmail !== user.email) {
    delete db[originalEmail];
  }
  db[user.email] = user;
  saveFixtures(db);
}

export function deleteFixtureUser(email: string): void {
  const db = { ...loadFixtures() };
  delete db[email];
  saveFixtures(db);
}
