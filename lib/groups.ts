import fs from 'fs';
import path from 'path';
import type { Group, GroupsDb } from 'types';

const groupsPath = path.join(process.cwd(), 'fixtures', 'groups.json');

let cachedGroups: GroupsDb | null = null;

function loadGroups(): GroupsDb {
  if (cachedGroups) return cachedGroups;
  try {
    cachedGroups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8')) as GroupsDb;
    return cachedGroups;
  } catch {
    return {};
  }
}

function saveGroups(db: GroupsDb): void {
  fs.mkdirSync(path.dirname(groupsPath), { recursive: true });
  fs.writeFileSync(groupsPath, JSON.stringify(db, null, 2), 'utf-8');
  cachedGroups = db;
}

export function listGroups(): Group[] {
  return Object.values(loadGroups());
}

export function getGroup(id: string): Group | null {
  return loadGroups()[id] ?? null;
}

export function upsertGroup(group: Group): void {
  const db = { ...loadGroups(), [group.id]: group };
  saveGroups(db);
}

export function deleteGroup(id: string): void {
  const db = { ...loadGroups() };
  delete db[id];
  saveGroups(db);
}
