import { createHash } from 'crypto';
import config from 'lib/env';
import { getFixtureUser } from 'lib/fixtures';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { User } from 'types';
import saml from '@boxyhq/saml20';
import { getEntityId } from 'lib/entity-id';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { email, audience, acsUrl, id, relayState } = req.body;

    const fixtureUser = getFixtureUser(email);

    // Allow fixture users regardless of domain; otherwise apply default domain restriction
    if (!fixtureUser && !email.endsWith('@example.com') && !email.endsWith('@example.org')) {
      res.status(403).send(`${email} denied access`);
      return;
    }

    let claims: Record<string, unknown>;

    if (fixtureUser) {
      const raw: Record<string, unknown> = {
        id: fixtureUser.id,
        email: fixtureUser.email,
        firstName: fixtureUser.firstName,
        lastName: fixtureUser.lastName,
        displayName: fixtureUser.displayName,
        entraObjectId: fixtureUser.entraObjectId,
        tenantId: fixtureUser.tenantId,
        // Microsoft Entra ID / Azure AD URI claims (mirrors adm.xml / transherculano.xml)
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': fixtureUser.email,
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': fixtureUser.firstName,
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': fixtureUser.lastName,
        'http://schemas.microsoft.com/identity/claims/displayname': fixtureUser.displayName,
        'http://schemas.microsoft.com/identity/claims/objectidentifier': fixtureUser.entraObjectId,
        'http://schemas.microsoft.com/identity/claims/tenantid': fixtureUser.tenantId,
      };

      // Only include array claims when non-empty to avoid empty <Attribute> nodes
      if (fixtureUser.groups.length > 0) {
        raw['groups'] = fixtureUser.groups;
        raw['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] = fixtureUser.groups;
      }
      if (fixtureUser.roles.length > 0) {
        raw['roles'] = fixtureUser.roles;
        raw['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] = fixtureUser.roles;
      }

      if (fixtureUser.customClaims) {
        Object.assign(raw, fixtureUser.customClaims);
      }

      claims = { email: fixtureUser.email, raw };
    } else {
      // Default behavior: derive user from email
      const userId = createHash('sha256').update(email).digest('hex');
      const userName = email.split('@')[0];

      const user: User = {
        id: userId,
        email,
        firstName: userName,
        lastName: userName,
      };

      claims = { email: user.email, raw: user };
    }

    const xmlSigned = await saml.createSAMLResponse({
      issuer: getEntityId(config.entityId, req.query.namespace as any),
      audience,
      acsUrl,
      requestId: id,
      claims,
      privateKey: config.privateKey,
      publicKey: config.publicKey,
    });

    const encodedSamlResponse = Buffer.from(xmlSigned).toString('base64');
    const html = saml.createPostForm(acsUrl, [
      { name: 'RelayState', value: relayState },
      { name: 'SAMLResponse', value: encodedSamlResponse },
    ]);

    res.send(html);
  } else {
    res.status(405).send(`Method ${req.method} Not Allowed`);
  }
}
