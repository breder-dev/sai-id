import { deleteGroup, listGroups, upsertGroup } from 'lib/groups';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Group } from 'types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.json(listGroups());
  }

  if (req.method === 'POST') {
    const group = req.body as Group;
    if (!group?.id) return res.status(400).json({ error: 'id is required' });
    upsertGroup(group);
    return res.json(listGroups());
  }

  if (req.method === 'DELETE') {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id query param is required' });
    deleteGroup(id);
    return res.json(listGroups());
  }

  res.status(405).end();
}
