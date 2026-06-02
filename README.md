# SaiID - SAML Assertion Issuer for Identity Development

SaiID is a SAML 2.0 Identity Provider simulator designed for local development, testing, and debugging of enterprise authentication flows.

SaiID started as a fork of [`boxyhq/mock-saml`](https://github.com/boxyhq/mock-saml) and extends the original idea with behavior, payloads, and testing scenarios closer to Microsoft Entra ID.

> SaiID is not affiliated with Microsoft, Microsoft Entra ID, Ory, or BoxyHQ.

---

## What is SaiID?

SaiID is a development tool for teams that need to test SAML-based Single Sign-On without depending on a real enterprise Identity Provider during local or automated testing.

It acts as a mock Identity Provider and issues SAML responses/assertions that can be consumed by a Service Provider application.

The goal is simple:

- simulate SAML login flows;
- test user attributes and claims;
- validate group and role mapping;
- reproduce Entra ID-like payloads;
- make SAML debugging easier during development.

---

## Why SaiID?

Basic SAML testing tools are useful for simple login flows, but enterprise integrations usually depend on details such as:

- NameID formats;
- user principal names;
- email claims;
- object identifiers;
- group claims;
- tenant-like metadata;
- signed assertions;
- SP metadata compatibility;
- Entra ID-style attribute naming;
- group and role mapping behavior.

SaiID exists to make those scenarios easier to test locally.

---

## Features

- SAML 2.0 Identity Provider simulation
- Local development support
- Configurable Entity ID
- Configurable signing certificate and private key
- SAML metadata endpoint
- SSO login testing
- Custom user attributes
- Entra ID-inspired claim structure
- Group and role simulation
- Useful for frontend, backend, and CI testing
- Useful for testing SAML adapters before connecting to a real IdP

---

## Namespaces

SaiID supports namespaces to isolate different SAML testing contexts inside the same running instance.

A namespace allows you to create a separated testing area for a specific application, customer, tenant, environment, or integration scenario.

For example, instead of using only the root instance:

```txt
http://localhost:4000
````

You can use a namespace:

```txt
http://localhost:4000/namespace/acme
```

or:

```txt
http://localhost:4000/namespace/internal-test
```

This is useful when you need to test multiple Service Provider configurations without running multiple SaiID instances.

Example use cases:

* one namespace per local application;
* one namespace per test customer;
* one namespace per SAML adapter;
* one namespace for Entra ID-like tests;
* one namespace for generic SAML tests.

Each namespace can be used to keep SAML testing flows more organized and predictable.

---

## Install

### With Docker

```bash
docker run \
  -p 4000:4000 \
  -e APP_URL="http://localhost:4000" \
  -e ENTITY_ID="https://saml.example.com/entityid" \
  -e PUBLIC_KEY="<BASE64_PUBLIC_KEY>" \
  -e PRIVATE_KEY="<BASE64_PRIVATE_KEY>" \
  -d breder.dev/sai-id
```

Alternatively, you can pass an env file (for example `app.env`) instead of listing individual `-e` flags.

Create a file named `app.env` with the following contents:

```env
APP_URL="http://localhost:4000"
ENTITY_ID="https://saml.example.com/entityid"
PUBLIC_KEY="<BASE64_PUBLIC_KEY>"
PRIVATE_KEY="<BASE64_PRIVATE_KEY>"
```

Then run the container using `--env-file`:

```bash
docker run \
  -p 4000:4000 \
  --env-file ./app.env \
  -d breder.dev/sai-id
```

---

### Without Docker

Clone the repository:

```bash
git clone https://github.com/breder-dev/sai-id.git
```

Enter the project folder:

```bash
cd sai-id
```

Install dependencies (pnpm):

We use `pnpm` for package management. If you don't have it installed, install it globally or enable it with Corepack.

```bash
# one-time: install pnpm globally
npm install -g pnpm
# or with Corepack (Node 16.14+/Node 18+ recommended)
corepack enable
corepack prepare pnpm@latest --activate

# install project dependencies
pnpm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your own values.

Build the Next.js app:

```bash
pnpm build
```

Run the SaiID server:

```bash
pnpm start
```

By default, SaiID should be available at:

```txt
http://localhost:4000
```

---

## Environment Variables

SaiID uses environment variables to configure the local Identity Provider behavior.

Check `.env.example` for the most up-to-date list of supported variables.

Common variables:

| Variable             | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `APP_URL`            | Public URL where SaiID is running                           |
| `ENTITY_ID`          | SAML Entity ID used by SaiID                                |
| `PUBLIC_KEY`         | Base64 encoded public certificate/key used for SAML signing |
| `PRIVATE_KEY`        | Base64 encoded private key used for SAML signing            |
| `PUBLIC_KEY_FILE`    | Path to a public key/certificate file                       |
| `PRIVATE_KEY_FILE`   | Path to a private key file                                  |
| `NEXT_PUBLIC_GTM_ID` | Optional Google Tag Manager ID, if enabled                  |

You can configure signing keys in two ways:

1. using Base64 values directly in environment variables;
2. using key files and pointing SaiID to their file paths.

---

## Signing Keys

SAML responses and assertions usually need to be signed.

SaiID needs a public key/certificate and a private key to generate signed SAML responses.

You can provide these keys either as Base64 environment variables or as files.

---

### Option 1: Using Base64 environment variables

Generate a private key:

```bash
openssl genrsa -out private.key 2048
```

Generate a public certificate:

```bash
openssl req -new -x509 -key private.key -out public.crt -days 3650
```

Encode the files as Base64:

```bash
base64 -w 0 public.crt
```

```bash
base64 -w 0 private.key
```

Then add the generated values to your `.env` file:

```env
APP_URL=http://localhost:4000
ENTITY_ID=https://saml.example.com/entityid

PUBLIC_KEY=<BASE64_PUBLIC_CERTIFICATE>
PRIVATE_KEY=<BASE64_PRIVATE_KEY>
```

On macOS, if `base64 -w 0` is not available, use:

```bash
base64 public.crt | tr -d '\n'
```

```bash
base64 private.key | tr -d '\n'
```

---

### Option 2: Using key files

You can also store the key files inside the project and reference their paths in `.env`.

Create a local folder for the keys:

```bash
mkdir -p certs
```

Generate the private key:

```bash
openssl genrsa -out certs/private.key 2048
```

Generate the public certificate:

```bash
openssl req -new -x509 -key certs/private.key -out certs/public.crt -days 3650
```

Then configure `.env` like this:

```env
APP_URL=http://localhost:4000
ENTITY_ID=https://saml.example.com/entityid

PUBLIC_KEY_FILE=certs/public.crt
PRIVATE_KEY_FILE=certs/private.key
```

Recommended local structure:

```txt
saiid/
├── certs/
│   ├── public.crt
│   └── private.key
├── .env
├── .env.example
└── package.json
```

Do not commit private keys to the repository.

Add the local key files to `.gitignore`:

```gitignore
certs/*.key
certs/*.crt
```

If you want to keep the folder in Git, add a placeholder file:

```bash
touch certs/.gitkeep
```

Then update `.gitignore` like this:

```gitignore
certs/*
!certs/.gitkeep
```

---

## SAML Configuration

Use the SaiID metadata endpoint to configure your Service Provider.

Example metadata URL:

```txt
http://localhost:4000/api/saml/metadata
```

Your Service Provider will usually need:

| Setting       | Value                                            |
| ------------- | ------------------------------------------------ |
| IdP Entity ID | Configured by `ENTITY_ID`                        |
| SSO URL       | SaiID login endpoint                             |
| Certificate   | Public certificate used by SaiID                 |
| Binding       | HTTP-POST or HTTP-Redirect, depending on your SP |
| NameID Format | Configurable according to your test scenario     |

Check the actual routes in your fork and update the metadata URL if needed.

---

## Entra ID-like Claims

SaiID can be used to simulate claims commonly found in Microsoft Entra ID SAML integrations.

Example attributes:

```xml
http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name
http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname
http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname
http://schemas.microsoft.com/identity/claims/objectidentifier
http://schemas.microsoft.com/identity/claims/tenantid
http://schemas.microsoft.com/ws/2008/06/identity/claims/groups
```

Example user payload:

```json
{
  "id": "user-001",
  "displayName": "John Doe",
  "givenName": "John",
  "surname": "Doe",
  "email": "john.doe@example.com",
  "userPrincipalName": "john.doe@example.com",
  "objectId": "00000000-0000-0000-0000-000000000001",
  "tenantId": "11111111-1111-1111-1111-111111111111",
  "groups": [
    "Finance",
    "Administrators"
  ]
}
```

---

## Example Testing Flow

1. Start SaiID locally.
2. Configure your application as a SAML Service Provider.
3. Point your SP to SaiID metadata.
4. Start the SAML login flow from your application.
5. Select or configure a test user in SaiID.
6. SaiID issues a SAML response.
7. Your application consumes the assertion.
8. Validate user provisioning, claims, roles, and permissions.

---

## Use Cases

SaiID is useful when you need to:

* develop SAML SSO integration locally;
* test an application before receiving real Entra ID access;
* simulate different enterprise users;
* test group-based authorization;
* validate SAML claim mapping;
* debug assertion parsing;
* build adapters for Entra ID-like SAML responses;
* reproduce login scenarios without changing a real IdP.

---

## Project Goals

SaiID is designed to be:

* simple to run;
* predictable during tests;
* closer to enterprise SAML behavior;
* useful for debugging;
* friendly to local development;
* easy to adapt for custom identity providers.

---

## Non-goals

SaiID is not intended to be:

* a production Identity Provider;
* a replacement for Microsoft Entra ID;
* a secure authentication service for real users;
* a complete directory service;
* a full IAM platform.

Use it only for development, testing, and controlled environments.

---

## Security Notice

SaiID is a mock Identity Provider.

Do not use SaiID in production environments.

Do not use real private keys, real user credentials, or sensitive production identity data when testing.

For local development, prefer disposable keys generated only for SaiID.

---

## Development

Run in development mode:

```bash
pnpm dev
```

Build:

```bash
pnpm build
```

Start:

```bash
pnpm start
```

Lint:

```bash
pnpm lint
```

---

## Roadmap

Possible future improvements:

* multiple user profiles;
* user selection screen;
* Entra ID XML import adapter;
* configurable claim templates;
* group overage simulation;
* signed assertion options;
* encrypted assertion support;
* SP metadata import;
* tenant profile simulation;
* automated test fixtures;
* Docker Compose examples.

---

## Name

**SaiID** stands for:

**SAML Assertion Issuer for Identity Development**

It means SaiID issues SAML assertions for identity and authentication development workflows.

In practice, SaiID behaves like a local SAML Identity Provider simulator that helps developers test authentication, identity claims, user attributes, groups, and SSO behavior before connecting their application to a real provider such as Microsoft Entra ID.

---

## Contributing

Contributions are welcome.

When opening an issue, please try to make it:

* reproducible: include clear steps to reproduce the problem;
* specific: include version, environment, configuration, and relevant logs;
* unique: avoid duplicating existing issues;
* scoped: report one issue per ticket.

For pull requests:

* keep changes focused;
* explain the problem being solved;
* include screenshots when changing UI behavior;
* include examples when changing SAML payloads, claims, or metadata behavior;
* avoid mixing refactors with feature changes.

---

## Community

Use GitHub Issues for:

* bug reports;
* feature requests;
* product ideas;
* contribution discussions.

Repository issues:

```txt
https://github.com/breder-dev/sai-id/issues
```

---

## Credits

SaiID is based on [`ory/mock-saml`](https://github.com/ory/mock-saml).

Mock SAML is a free SAML 2.0 Identity Provider for testing SAML SSO integrations. SaiID keeps that foundation, but changes the project direction toward Entra ID-like local testing, custom identity scenarios, richer assertion payloads, and development workflows closer to enterprise SAML integrations.

All original credits belong to the maintainers and contributors of `ory/mock-saml`.

---

## License

This project follows the license of the original fork unless changed explicitly.

Check the `LICENSE` file for details.
