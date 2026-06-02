export type ServiceProvider = {
  acs_url: string;
  entity_id: string;
};

export type IdentityProvider = {
  ssoUrl: string;
  entityId: string;
};

export type App = {
  id: string;
  name: string;
  description?: string | null;
  certificate?: string | null;
} & ServiceProvider;

export type IdPMetadata = {
  certificate: string;
  fingerprint?: string;
} & IdentityProvider;

export type SAMLRequest = {
  entityID: string;
  callbackUrl: string;
  signingKey: string;
};

export type AuthNRequest = {
  relayState: string;
  samlRequest: string;
};

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type FixtureUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  groups: string[];
  roles: string[];
  entraObjectId: string;
  tenantId: string;
  customClaims?: Record<string, string | string[]>;
};

export type FixturesDb = Record<string, FixtureUser>;

export type Group = {
  id: string;
  displayName: string;
  description?: string;
};

export type GroupsDb = Record<string, Group>;

export type ImportResult = {
  file: string;
  email: string;
  status: 'imported' | 'skipped';
  reason?: string;
  user?: FixtureUser;
};
