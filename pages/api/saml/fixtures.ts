import { deleteFixtureUser, listFixtureUsers, upsertFixtureUser } from 'lib/fixtures';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { FixtureUser } from 'types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.json(listFixtureUsers());
  }

  if (req.method === 'POST') {
    const { originalEmail, ...user } = req.body as FixtureUser & { originalEmail?: string };
    if (!user.email) {
      return res.status(400).json({ error: 'email is required' });
    }
    upsertFixtureUser(user, originalEmail);
    return res.json(listFixtureUsers());
  }

  if (req.method === 'DELETE') {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ error: 'email query param is required' });
    }
    deleteFixtureUser(email);
    return res.json(listFixtureUsers());
  }

  res.status(405).end();
}
