import Head from 'next/head';
import { useRouter } from 'next/router';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { FixtureUser } from 'types';

export default function Login() {
  const router = useRouter();
  const { id, audience, acsUrl, providerName, relayState, namespace } = router.query;

  const authUrl = namespace ? `/api/namespace/${namespace}/saml/auth` : '/api/saml/auth';
  const fixturesUrl = namespace ? `/api/namespace/${namespace}/saml/fixtures` : '/api/saml/fixtures';

  const [state, setState] = useState({
    username: 'jackson',
    domain: 'example.com',
    acsUrl: 'https://sso.eu.boxyhq.com/api/oauth/saml',
    audience: 'https://saml.boxyhq.com',
  });

  const [fixtures, setFixtures] = useState<FixtureUser[]>([]);
  const [matchedFixture, setMatchedFixture] = useState<FixtureUser | null>(null);

  const acsUrlInp = useRef<HTMLInputElement>(null);
  const emailInp = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(fixturesUrl)
      .then((r) => r.json())
      .then(setFixtures)
      .catch(() => {});
  }, [fixturesUrl]);

  useEffect(() => {
    const email = `${state.username}@${state.domain}`;
    setMatchedFixture(fixtures.find((u) => u.email === email) ?? null);
  }, [state.username, state.domain, fixtures]);

  useEffect(() => {
    if (acsUrl && emailInp.current) {
      emailInp.current.focus();
      emailInp.current.select();
    } else if (acsUrlInp.current) {
      acsUrlInp.current.focus();
      acsUrlInp.current.select();
    }
  }, [acsUrl]);

  const handleChange = (e: FormEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.currentTarget;
    setState({ ...state, [name]: value });
  };

  const fillFixture = (user: FixtureUser) => {
    const [username, domain] = user.email.split('@');
    setState((s) => ({ ...s, username, domain }));
  };

  const submitSamlForm = (html: string) => {
    // Parse the SAML POST form returned by the server and submit it
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const form = doc.querySelector('form');
    if (!form) return;
    const adopted = document.adoptNode(form);
    document.body.replaceChildren(adopted);
    (document.querySelector('form') as HTMLFormElement).submit();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { username, domain } = state;

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${username}@${domain}`,
        id,
        audience: audience || state.audience,
        acsUrl: acsUrl || state.acsUrl,
        providerName,
        relayState,
      }),
    });

    if (response.ok) {
      submitSamlForm(await response.text());
    } else {
      document.body.textContent = 'Error in getting SAML response';
    }
  };

  return (
    <>
      <Head>
        <title>Mock SAML Identity Provider - Login</title>
      </Head>

      <div className='flex min-h-screen justify-center bg-white pt-12'>
        <div className='w-full max-w-xl px-3 space-y-4'>
          {/* Card */}
          <div className='rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
            <h2 className='mb-6 text-center text-2xl font-semibold text-gray-900'>
              {!acsUrl ? 'SAML IdP Login' : 'SAML SSO Login'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className='grid grid-cols-2 gap-x-5 gap-y-3'>
                {!acsUrl && (
                  <div className='col-span-2 space-y-3'>
                    <div>
                      <label className='block mb-1 text-sm font-medium text-gray-700'>ACS URL</label>
                      <input
                        ref={acsUrlInp}
                        name='acsUrl'
                        id='acsUrl'
                        type='text'
                        autoComplete='off'
                        value={state.acsUrl}
                        onChange={handleChange}
                        placeholder='https://sso.eu.boxyhq.com/api/oauth/saml'
                        className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30'
                      />
                      <p className='mt-1 text-xs text-gray-500'>
                        This is where we will post the SAML Response
                      </p>
                    </div>

                    <div>
                      <label className='block mb-1 text-sm font-medium text-gray-700'>Audience</label>
                      <input
                        name='audience'
                        id='audience'
                        type='text'
                        autoComplete='off'
                        value={state.audience}
                        onChange={handleChange}
                        placeholder='https://saml.boxyhq.com'
                        className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30'
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className='block mb-1 text-sm font-medium text-gray-700'>Email</label>
                  <input
                    ref={emailInp}
                    name='username'
                    id='username'
                    type='text'
                    autoComplete='off'
                    value={state.username}
                    onChange={handleChange}
                    placeholder='jackson'
                    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30'
                  />
                </div>

                <div>
                  <label className='block mb-1 text-sm font-medium text-gray-700'>Domain</label>
                  <input
                    name='domain'
                    id='domain'
                    type='text'
                    list='domain-options'
                    autoComplete='off'
                    value={state.domain}
                    onChange={handleChange}
                    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30'
                  />
                  <datalist id='domain-options'>
                    <option value='example.com' />
                    <option value='example.org' />
                  </datalist>
                </div>

                {/* Fixture match preview */}
                {matchedFixture && (
                  <div className='col-span-2 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-900'>
                    <p className='font-semibold mb-1'>Fixture matched: {matchedFixture.displayName}</p>
                    {matchedFixture.groups.length > 0 && (
                      <p>
                        <span className='font-medium'>Groups:</span>{' '}
                        {matchedFixture.groups.join(', ')}
                      </p>
                    )}
                    {matchedFixture.roles.length > 0 && (
                      <p>
                        <span className='font-medium'>Roles:</span>{' '}
                        {matchedFixture.roles.join(', ')}
                      </p>
                    )}
                    {matchedFixture.groups.length === 0 && matchedFixture.roles.length === 0 && (
                      <p className='text-gray-500'>No groups or roles</p>
                    )}
                  </div>
                )}

                <div className='col-span-2'>
                  <label className='block mb-1 text-sm font-medium text-gray-700'>Password</label>
                  <input
                    id='password'
                    type='password'
                    autoComplete='off'
                    defaultValue='samlstrongpassword'
                    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30'
                  />
                  <p className='mt-1 text-xs text-gray-500'>Any password works</p>
                </div>

                <button
                  type='submit'
                  className='col-span-2 mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40'>
                  Sign In
                </button>
              </div>
            </form>
          </div>

          {/* Info box */}
          <div className='rounded-md border border-blue-200 bg-blue-50 p-4'>
            <p className='text-sm text-blue-900'>
              This is a simulated login screen. Default domains{' '}
              <code className='font-mono'>example.com</code> and{' '}
              <code className='font-mono'>example.org</code> are always accepted. Emails registered
              in <code className='font-mono'>fixtures/users.json</code> are accepted regardless of
              domain.
            </p>
          </div>

          {/* Fixture users quick-fill */}
          {fixtures.length > 0 && (
            <div className='rounded-lg border border-gray-200 bg-white p-4 shadow-sm'>
              <div className='flex items-center justify-between mb-3'>
                <p className='text-sm font-semibold text-gray-700'>Available fixture users</p>
                <a href='/saml/fixtures' className='text-xs text-blue-600 hover:underline'>
                  Manage →
                </a>
              </div>
              <div className='space-y-2'>
                {fixtures.map((u) => (
                  <button
                    key={u.email}
                    type='button'
                    onClick={() => fillFixture(u)}
                    className='w-full rounded-md border border-gray-200 px-3 py-2 text-left text-xs hover:bg-gray-50'>
                    <span className='font-medium text-gray-800'>{u.email}</span>
                    <span className='ml-2 text-gray-400'>
                      {u.groups.length > 0 ? u.groups.join(', ') : 'no groups'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
