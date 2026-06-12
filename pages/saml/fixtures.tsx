import Head from 'next/head';
import type { KeyboardEvent } from 'react';
import { useEffect, useState } from 'react';
import type { FixtureUser, ImportResult, Group } from 'types';

type CustomClaimRow = { name: string; value: string };

const API = '/api/saml/fixtures';
const IMPORT_API = '/api/saml/import-xml';
const GROUPS_API = '/api/saml/groups';

// ── form state ────────────────────────────────────────────────────────────────

type FormState = {
  originalEmail: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  entraObjectId: string;
  tenantId: string;
  groups: string[];
  roles: string[];
  customClaims: CustomClaimRow[];
  groupInput: string;
  roleInput: string;
};

const emptyForm = (): FormState => ({
  originalEmail: '',
  id: crypto.randomUUID(),
  email: '',
  firstName: '',
  lastName: '',
  displayName: '',
  entraObjectId: crypto.randomUUID(),
  tenantId: '22222222-2222-2222-2222-222222222222',
  groups: [],
  roles: [],
  customClaims: [],
  groupInput: '',
  roleInput: '',
});

function userToForm(u: FixtureUser): FormState {
  const custom: CustomClaimRow[] = Object.entries(u.customClaims ?? {}).map(([name, value]) => ({
    name,
    value: Array.isArray(value) ? value.join('\n') : value,
  }));
  return {
    originalEmail: u.email,
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    displayName: u.displayName,
    entraObjectId: u.entraObjectId,
    tenantId: u.tenantId,
    groups: [...u.groups],
    roles: [...u.roles],
    customClaims: custom,
    groupInput: '',
    roleInput: '',
  };
}

function formToUser(f: FormState): FixtureUser & { originalEmail?: string } {
  const customClaims: Record<string, string | string[]> = {};
  for (const row of f.customClaims) {
    if (!row.name.trim()) continue;
    const lines = row.value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    customClaims[row.name.trim()] = lines.length === 1 ? lines[0] : lines;
  }
  return {
    originalEmail: f.originalEmail || undefined,
    id: f.id,
    email: f.email,
    firstName: f.firstName,
    lastName: f.lastName,
    displayName: f.displayName,
    entraObjectId: f.entraObjectId,
    tenantId: f.tenantId,
    groups: f.groups,
    roles: f.roles,
    ...(Object.keys(customClaims).length > 0 ? { customClaims } : {}),
  };
}

// ── import preview state ──────────────────────────────────────────────────────

type PreviewRow = ImportResult & { selected: boolean };

// ── page ──────────────────────────────────────────────────────────────────────

export default function FixturesPage() {
  const [users, setUsers] = useState<FixtureUser[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // groups master list
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<Group>({ id: '', displayName: '', description: '' });
  const [savingGroup, setSavingGroup] = useState(false);

  // import flow
  const [importStep, setImportStep] = useState<'idle' | 'loading' | 'preview' | 'confirming'>('idle');
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importDone, setImportDone] = useState<{ imported: number } | null>(null);

  useEffect(() => {
    fetch(API)
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
    fetch(GROUPS_API)
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => {});
  }, []);

  // ── form helpers ──

  const set = (field: keyof FormState, value: unknown) => setForm((f) => f && { ...f, [field]: value });

  const addChip = (field: 'groups' | 'roles', inputField: 'groupInput' | 'roleInput') => {
    if (!form) return;
    const val = form[inputField].trim();
    if (!val || form[field].includes(val)) return;
    setForm({ ...form, [field]: [...form[field], val], [inputField]: '' });
  };

  const removeChip = (field: 'groups' | 'roles', idx: number) => {
    if (!form) return;
    setForm({ ...form, [field]: form[field].filter((_, i) => i !== idx) });
  };

  const onChipKey = (
    e: KeyboardEvent<HTMLInputElement>,
    field: 'groups' | 'roles',
    inputField: 'groupInput' | 'roleInput'
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChip(field, inputField);
    }
  };

  const addCustomRow = () =>
    form && setForm({ ...form, customClaims: [...form.customClaims, { name: '', value: '' }] });

  const setCustomRow = (idx: number, key: keyof CustomClaimRow, val: string) => {
    if (!form) return;
    setForm({
      ...form,
      customClaims: form.customClaims.map((r, i) => (i === idx ? { ...r, [key]: val } : r)),
    });
  };

  const removeCustomRow = (idx: number) =>
    form && setForm({ ...form, customClaims: form.customClaims.filter((_, i) => i !== idx) });

  // ── group registration ──

  const openGroupPanel = (id: string) => {
    if (activeGroupId === id) {
      setActiveGroupId(null);
      return;
    }
    const existing = groups.find((g) => g.id === id);
    setGroupForm(existing ?? { id, displayName: '', description: '' });
    setActiveGroupId(id);
  };

  const saveGroup = async () => {
    if (!groupForm.id) return;
    setSavingGroup(true);
    try {
      const res = await fetch(GROUPS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupForm),
      });
      setGroups(await res.json());
      setActiveGroupId(null);
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroupEntry = async (id: string) => {
    const res = await fetch(`${GROUPS_API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      setGroups(await res.json());
      setActiveGroupId(null);
    }
  };

  // ── CRUD ──

  const save = async () => {
    if (!form) return;
    setError('');
    setSaving(true);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToUser(form)),
      });
      if (!res.ok) throw new Error(await res.text());
      setUsers(await res.json());
      setForm(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (email: string) => {
    if (!confirm(`Remove ${email}?`)) return;
    const res = await fetch(`${API}?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers(await res.json());
      if (form?.originalEmail === email) setForm(null);
    }
  };

  // ── import flow ──

  const startImport = async () => {
    setImportStep('loading');
    setImportDone(null);
    setForm(null);
    try {
      const { results }: { results: ImportResult[] } = await fetch(IMPORT_API).then((r) => r.json());
      setPreview(results.map((r) => ({ ...r, selected: r.status === 'imported' })));
      setImportStep('preview');
    } catch {
      setError('Failed to read XML files from server');
      setImportStep('idle');
    }
  };

  const toggleAll = (val: boolean) =>
    setPreview((rows) => rows.map((r) => (r.status === 'imported' ? { ...r, selected: val } : r)));

  const toggleRow = (email: string) =>
    setPreview((rows) => rows.map((r) => (r.email === email ? { ...r, selected: !r.selected } : r)));

  const confirmImport = async () => {
    const selected = preview.filter((r) => r.selected && r.user).map((r) => r.user!);
    if (selected.length === 0) return;
    setImportStep('confirming');
    try {
      await fetch(IMPORT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: selected }),
      });
      const updated = await fetch(API).then((r) => r.json());
      setUsers(updated);
      setImportDone({ imported: selected.length });
      setImportStep('idle');
    } catch {
      setError('Failed to save imported users');
      setImportStep('preview');
    }
  };

  const cancelImport = () => {
    setImportStep('idle');
    setPreview([]);
  };

  const selectedCount = preview.filter((r) => r.selected).length;
  const importableRows = preview.filter((r) => r.status === 'imported');

  return (
    <>
      <Head>
        <title>Fixture Users — Mock SAML</title>
      </Head>

      <div className='flex min-h-screen bg-gray-50'>
        {/* ── Sidebar ── */}
        <aside className='w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col'>
          <div className='px-4 py-3 border-b border-gray-200 space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-semibold text-gray-700'>Fixture Users</span>
              <button
                onClick={() => {
                  setForm(emptyForm());
                  cancelImport();
                }}
                className='rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary-hover'>
                + New
              </button>
            </div>
            <button
              onClick={startImport}
              disabled={importStep === 'loading' || importStep === 'confirming'}
              title='Reads fixtures/xml/*.xml and shows a preview for selection'
              className='w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50'>
              {importStep === 'loading' ? 'Reading XMLs…' : '↓ Import XMLs'}
            </button>
            {importDone && (
              <p className='text-xs text-green-700 font-medium'>✓ {importDone.imported} user(s) imported</p>
            )}
          </div>

          <ul className='flex-1 overflow-y-auto divide-y divide-gray-100'>
            {users.map((u) => (
              <li key={u.email}>
                <button
                  onClick={() => {
                    setForm(userToForm(u));
                    cancelImport();
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${form?.originalEmail === u.email ? 'bg-blue-50' : ''}`}>
                  <p className='text-sm font-medium text-gray-800 truncate'>{u.email}</p>
                  <p className='text-xs text-gray-400 truncate'>
                    {u.groups.length > 0 ? u.groups.join(', ') : 'no groups'}
                  </p>
                </button>
              </li>
            ))}
            {users.length === 0 && <li className='px-4 py-6 text-xs text-gray-400 text-center'>No users</li>}
          </ul>

          <div className='px-4 py-3 border-t border-gray-100'>
            <a href='/saml/login' className='text-xs text-blue-600 hover:underline'>
              ← Back to login
            </a>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className='flex-1 p-6 overflow-y-auto'>
          {error && (
            <div className='mb-4 max-w-2xl mx-auto rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700'>
              {error}
              <button onClick={() => setError('')} className='ml-2 underline'>
                dismiss
              </button>
            </div>
          )}

          {/* ── Import preview panel ── */}
          {importStep === 'preview' || importStep === 'confirming' ? (
            <div className='max-w-2xl mx-auto space-y-4'>
              <div className='flex items-center justify-between'>
                <h1 className='text-lg font-semibold text-gray-900'>
                  XMLs found — select which ones to import
                </h1>
                <button onClick={cancelImport} className='text-xs text-gray-400 hover:text-gray-600'>
                  Cancel
                </button>
              </div>

              {preview.length === 0 ? (
                <div className='rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400'>
                  No .xml files found in <code>fixtures/xml/</code>
                </div>
              ) : (
                <>
                  {/* select-all bar */}
                  {importableRows.length > 0 && (
                    <div className='flex gap-3 text-xs'>
                      <button onClick={() => toggleAll(true)} className='text-blue-600 hover:underline'>
                        Select all
                      </button>
                      <button onClick={() => toggleAll(false)} className='text-gray-400 hover:underline'>
                        Deselect all
                      </button>
                    </div>
                  )}

                  <div className='rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden'>
                    {preview.map((row) => (
                      <label
                        key={row.file}
                        className={`flex items-start gap-3 px-4 py-3 ${row.status === 'imported' ? 'cursor-pointer hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}>
                        <input
                          type='checkbox'
                          checked={row.selected}
                          disabled={row.status !== 'imported'}
                          onChange={() => toggleRow(row.email)}
                          className='mt-0.5 h-4 w-4 rounded border-gray-300 text-primary'
                        />
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2'>
                            <span className='text-sm font-medium text-gray-800 truncate'>
                              {row.email || '—'}
                            </span>
                            <span className='text-xs text-gray-400'>{row.file}</span>
                          </div>
                          {row.status === 'imported' && row.user && (
                            <div className='mt-0.5 text-xs text-gray-500 space-x-3'>
                              <span>{row.user.displayName}</span>
                              {row.user.groups.length > 0 && (
                                <span>groups: {row.user.groups.join(', ')}</span>
                              )}
                              {row.user.roles.length > 0 && <span>roles: {row.user.roles.join(', ')}</span>}
                              {row.user.customClaims && Object.keys(row.user.customClaims).length > 0 && (
                                <span className='text-gray-400'>
                                  +{Object.keys(row.user.customClaims).length} extra claim(s)
                                </span>
                              )}
                            </div>
                          )}
                          {row.status === 'skipped' && (
                            <p className='mt-0.5 text-xs text-red-500'>{row.reason}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className='flex gap-3 pt-1'>
                    <button
                      onClick={confirmImport}
                      disabled={selectedCount === 0 || importStep === 'confirming'}
                      className='rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50'>
                      {importStep === 'confirming' ? 'Importing…' : `Import selected (${selectedCount})`}
                    </button>
                    <button
                      onClick={cancelImport}
                      className='rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50'>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : !form ? (
            <div className='flex h-full items-center justify-center text-sm text-gray-400'>
              Select a user or click &ldquo;+ New&rdquo;
            </div>
          ) : (
            /* ── Edit form ── */
            <div className='max-w-2xl mx-auto space-y-6'>
              <div className='flex items-center justify-between'>
                <h1 className='text-lg font-semibold text-gray-900'>
                  {form.originalEmail ? 'Edit user' : 'New user'}
                </h1>
                {form.originalEmail && (
                  <button
                    onClick={() => remove(form.originalEmail)}
                    className='text-xs text-red-500 hover:text-red-700'>
                    Remove
                  </button>
                )}
              </div>

              <Section title='Basic fields'>
                <Field label='Email'>
                  <input
                    type='email'
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    className={inputCls}
                    placeholder='user@example.com'
                  />
                </Field>
                <div className='grid grid-cols-2 gap-3'>
                  <Field label='First Name'>
                    <input
                      type='text'
                      value={form.firstName}
                      onChange={(e) => set('firstName', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label='Last Name'>
                    <input
                      type='text'
                      value={form.lastName}
                      onChange={(e) => set('lastName', e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label='Display Name'>
                  <input
                    type='text'
                    value={form.displayName}
                    onChange={(e) => set('displayName', e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </Section>

              <Section title='Entra ID / Azure AD'>
                <Field label='Object ID (entraObjectId)'>
                  <input
                    type='text'
                    value={form.entraObjectId}
                    onChange={(e) => set('entraObjectId', e.target.value)}
                    className={inputCls}
                    placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                  />
                </Field>
                <Field label='Tenant ID'>
                  <input
                    type='text'
                    value={form.tenantId}
                    onChange={(e) => set('tenantId', e.target.value)}
                    className={inputCls}
                    placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                  />
                </Field>
                <Field label='Internal ID'>
                  <input
                    type='text'
                    value={form.id}
                    onChange={(e) => set('id', e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </Section>

              <Section title='Groups'>
                <GroupChipInput
                  chips={form.groups}
                  inputValue={form.groupInput}
                  registeredGroups={groups}
                  activeGroupId={activeGroupId}
                  onInputChange={(v) => set('groupInput', v)}
                  onAdd={() => addChip('groups', 'groupInput')}
                  onKey={(e) => onChipKey(e, 'groups', 'groupInput')}
                  onRemove={(i) => removeChip('groups', i)}
                  onChipClick={openGroupPanel}
                  placeholder='group1 — Enter to add (click existing groups to edit)'
                />
                {/* Inline group registration panel */}
                {activeGroupId && form.groups.includes(activeGroupId) && (
                  <div className='mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2'>
                    <p className='text-xs font-semibold text-amber-800'>
                      Register group: <code className='font-mono'>{activeGroupId}</code>
                    </p>
                    <div className='grid grid-cols-2 gap-2'>
                      <div>
                        <label className='block mb-0.5 text-xs text-gray-600'>Display name</label>
                        <input
                          type='text'
                          value={groupForm.displayName}
                          onChange={(e) => setGroupForm({ ...groupForm, displayName: e.target.value })}
                          className={inputCls}
                          placeholder='Ex: Admin'
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className='block mb-0.5 text-xs text-gray-600'>Description (optional)</label>
                        <input
                          type='text'
                          value={groupForm.description ?? ''}
                          onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                          className={inputCls}
                          placeholder='Ex: Total access to system'
                        />
                      </div>
                    </div>
                    <div className='flex gap-2 items-center'>
                      <button
                        type='button'
                        onClick={saveGroup}
                        disabled={savingGroup || !groupForm.displayName}
                        className='rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50'>
                        {savingGroup ? 'Saving…' : 'Save group'}
                      </button>
                      {groups.find((g) => g.id === activeGroupId) && (
                        <button
                          type='button'
                          onClick={() => deleteGroupEntry(activeGroupId)}
                          className='text-xs text-red-500 hover:text-red-700'>
                          Remove from master list
                        </button>
                      )}
                      <button
                        type='button'
                        onClick={() => setActiveGroupId(null)}
                        className='ml-auto text-xs text-gray-400 hover:text-gray-600'>
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </Section>

              <Section title='Roles'>
                <ChipInput
                  chips={form.roles}
                  inputValue={form.roleInput}
                  onInputChange={(v) => set('roleInput', v)}
                  onAdd={() => addChip('roles', 'roleInput')}
                  onKey={(e) => onChipKey(e, 'roles', 'roleInput')}
                  onRemove={(i) => removeChip('roles', i)}
                  placeholder='ADMIN — Enter to add'
                />
              </Section>

              <Section title='Custom claims'>
                <p className='text-xs text-gray-400 mb-2'>
                  Multiple values: one per line (generates multiple AttributeValue nodes in SAML).
                </p>
                <div className='space-y-2'>
                  {form.customClaims.map((row, i) => (
                    <div key={i} className='flex gap-2 items-start'>
                      <input
                        type='text'
                        value={row.name}
                        onChange={(e) => setCustomRow(i, 'name', e.target.value)}
                        className={`${inputCls} flex-1 shrink-0`}
                        placeholder='Claim name'
                      />
                      <textarea
                        value={row.value}
                        onChange={(e) => setCustomRow(i, 'value', e.target.value)}
                        className={`${inputCls} flex-1 h-14 resize-none`}
                        placeholder='Value (one line per value) — supports multiple values'
                      />
                      <button
                        type='button'
                        onClick={() => removeCustomRow(i)}
                        className='mt-1 text-xs text-red-400 hover:text-red-600'>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type='button'
                  onClick={addCustomRow}
                  className='mt-2 text-xs text-blue-600 hover:underline'>
                  + Add custom claim
                </button>
              </Section>

              <div className='flex gap-3 pt-2'>
                <button
                  onClick={save}
                  disabled={saving}
                  className='rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50'>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setForm(null)}
                  className='rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50'>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='rounded-lg border border-gray-200 bg-white p-4 space-y-3'>
      <h2 className='text-xs font-semibold uppercase tracking-wide text-gray-500'>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className='block mb-1 text-xs font-medium text-gray-600'>{label}</label>
      {children}
    </div>
  );
}

function ChipInput({
  chips,
  inputValue,
  onInputChange,
  onAdd,
  onKey,
  onRemove,
  placeholder,
}: {
  chips: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onKey: (e: KeyboardEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void;
  placeholder: string;
}) {
  return (
    <div className='flex flex-wrap gap-1.5 rounded-md border border-gray-300 px-3 py-2 min-h-[40px] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30'>
      {chips.map((chip, i) => (
        <span
          key={i}
          className='flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800'>
          {chip}
          <button type='button' onClick={() => onRemove(i)} className='text-blue-400 hover:text-blue-700'>
            ✕
          </button>
        </span>
      ))}
      <input
        type='text'
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKey}
        onBlur={onAdd}
        placeholder={chips.length === 0 ? placeholder : ''}
        className='flex-1 min-w-24 text-sm outline-none bg-transparent'
      />
    </div>
  );
}

function GroupChipInput({
  chips,
  inputValue,
  registeredGroups,
  activeGroupId,
  onInputChange,
  onAdd,
  onKey,
  onRemove,
  onChipClick,
  placeholder,
}: {
  chips: string[];
  inputValue: string;
  registeredGroups: Group[];
  activeGroupId: string | null;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onKey: (e: KeyboardEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void;
  onChipClick: (id: string) => void;
  placeholder: string;
}) {
  const registeredIds = new Set(registeredGroups.map((g) => g.id));

  return (
    <div className='flex flex-wrap gap-1.5 rounded-md border border-gray-300 px-3 py-2 min-h-[40px] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30'>
      {chips.map((chip, i) => {
        const registered = registeredIds.has(chip);
        const isActive = activeGroupId === chip;
        const label = registeredGroups.find((g) => g.id === chip)?.displayName;
        return (
          <span
            key={i}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs cursor-pointer ring-1 transition-colors
              ${
                isActive
                  ? 'bg-amber-100 text-amber-800 ring-amber-400'
                  : registered
                    ? 'bg-blue-100 text-blue-800 ring-blue-200 hover:bg-blue-200'
                    : 'bg-yellow-50 text-yellow-800 ring-yellow-300 hover:bg-yellow-100'
              }`}>
            <button
              type='button'
              onClick={() => onChipClick(chip)}
              title={registered ? `Registered: ${label}` : 'Click to register in the master list'}
              className='max-w-[180px] truncate'>
              {registered && label ? `${label}` : chip}
              {!registered && <span className='ml-1 opacity-50'>+</span>}
            </button>
            <button type='button' onClick={() => onRemove(i)} className='opacity-40 hover:opacity-80 ml-0.5'>
              ✕
            </button>
          </span>
        );
      })}
      <input
        type='text'
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKey}
        onBlur={onAdd}
        placeholder={chips.length === 0 ? placeholder : ''}
        className='flex-1 min-w-24 text-sm outline-none bg-transparent'
      />
    </div>
  );
}
