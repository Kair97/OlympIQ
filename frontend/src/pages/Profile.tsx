import { useEffect, useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/authStore'
import { useStatsStore } from '../store/statsStore'
import {
  updateProfile, deleteProfile, connectAccount,
  disconnectAccount, syncAccounts, getAccounts,
  getSessions, revokeSession, revokeAllSessions,
  type SessionInfo,
} from '../api/profile'
import { changePassword } from '../api/auth'
import type { PlatformAccount } from '../types'

function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

// ── Flash message ─────────────────────────────────────────────────────────────

function Flash({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div className={type === 'ok' ? 'oq-flash-ok' : 'oq-flash-err'} style={{ marginBottom: 4 }}>
      {msg}
    </div>
  )
}

// ── Connect platform modal ────────────────────────────────────────────────────

function ConnectModal({ platformName, onClose, onConfirm }: {
  platformName: string
  onClose: () => void
  onConfirm: (handle: string) => void
}) {
  const [handle, setHandle] = useState('')
  return (
    <div className="oq-modal-backdrop" onClick={onClose}>
      <div className="oq-modal oq-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="oq-modal-head">
          <div>
            <div className="oq-page-eyebrow oq-mono">connect</div>
            <h3 className="oq-modal-title">Link your {platformName} account</h3>
          </div>
          <button className="oq-icon-btn" onClick={onClose}>×</button>
        </div>
        <p className="oq-dim" style={{ marginTop: 0, fontSize: 13 }}>
          Enter your public handle. We'll verify it by reading your profile — no
          password ever leaves your machine.
        </p>
        <label>
          <span className="oq-form-lbl">{platformName} handle</span>
          <input
            autoFocus
            className="oq-input"
            style={{ marginTop: 6 }}
            value={handle}
            onChange={e => setHandle(e.target.value)}
            placeholder={platformName === 'Codeforces' ? 'tourist' : 'leetcode_user'}
            onKeyDown={e => { if (e.key === 'Enter' && handle.trim()) onConfirm(handle.trim()) }}
          />
        </label>
        <div className="oq-modal-foot">
          <button className="oq-btn-ghost oq-btn-lg" onClick={onClose}>Cancel</button>
          <button
            className="oq-btn-primary oq-btn-lg"
            disabled={!handle.trim()}
            onClick={() => onConfirm(handle.trim())}
          >
            Connect →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Disconnect confirm modal ──────────────────────────────────────────────────

function DisconnectModal({ platformName, onClose, onConfirm }: {
  platformName: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="oq-modal-backdrop" onClick={onClose}>
      <div className="oq-modal oq-modal-sm" onClick={e => e.stopPropagation()}>
        <div className="oq-modal-head">
          <div>
            <div className="oq-page-eyebrow oq-mono">disconnect</div>
            <h3 className="oq-modal-title">Unlink {platformName}?</h3>
          </div>
          <button className="oq-icon-btn" onClick={onClose}>×</button>
        </div>
        <p className="oq-dim" style={{ marginTop: 0, fontSize: 13 }}>
          All cached stats for this account will be removed. Your analysis history and roadmaps are kept.
        </p>
        <div className="oq-modal-foot">
          <button className="oq-btn-ghost oq-btn-lg" onClick={onClose}>Cancel</button>
          <button className="oq-btn-primary oq-btn-lg oq-btn-danger" onClick={onConfirm}>
            Disconnect
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Platform config ───────────────────────────────────────────────────────────

const PLATFORM_CONFIG = [
  { id: 'codeforces' as const, name: 'Codeforces', color: '#a78bfa', letter: 'CF' },
  { id: 'leetcode'   as const, name: 'LeetCode',   color: '#f59e0b', letter: 'LC' },
]

// ── Main Profile ──────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const setGlobalAccounts = useStatsStore(s => s.setAccounts)
  const [accounts, setAccounts] = useState<PlatformAccount[]>([])
  const [flash, setFlash] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [twofa, setTwofa] = useState(false)

  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const [profileForm, setProfileForm] = useState({
    email: user?.email ?? '',
    username: user?.username ?? '',
  })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })

  useEffect(() => {
    getAccounts().then(a => {
      const list = a ?? []
      setAccounts(list)
      setGlobalAccounts(list)        // keep sidebar in sync on mount
    }).catch(() => {})
    getSessions().then(s => setSessions(s ?? [])).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function notify(msg: string, type: 'ok' | 'err' = 'ok') {
    setFlash({ msg, type })
    setTimeout(() => setFlash(null), 4000)
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    try {
      const updated = await updateProfile({ email: profileForm.email, username: profileForm.username })
      setUser(updated)
      notify('Profile updated')
    } catch { notify('Failed to update profile', 'err') }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { notify('Passwords do not match', 'err'); return }
    if (pwForm.next.length < 8) { notify('New password must be at least 8 characters', 'err'); return }
    try {
      await changePassword(pwForm.current, pwForm.next, pwForm.confirm)
      setPwForm({ current: '', next: '', confirm: '' })
      notify('Password changed successfully')
    } catch { notify('Incorrect current password', 'err') }
  }

  async function handleConnect(platform: string, handle: string) {
    setConnecting(null)
    try {
      const acc = await connectAccount(platform, handle)
      setAccounts(prev => {
        const updated = [...prev.filter(a => a.platform !== platform), acc]
        setGlobalAccounts(updated)   // update sidebar dot instantly
        return updated
      })
      notify(`${platform} connected — click Sync to load stats`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : `Failed to connect ${platform}`
      notify(msg, 'err')
    }
  }

  async function handleDisconnect(platform: string) {
    setDisconnecting(null)
    try {
      await disconnectAccount(platform)
      setAccounts(prev => {
        const updated = prev.filter(a => a.platform !== platform)
        setGlobalAccounts(updated)   // update sidebar dot instantly → turns red
        return updated
      })
      notify(`${platform} disconnected`)
    } catch { notify('Failed to disconnect', 'err') }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await syncAccounts()
      notify('Sync complete — check Dashboard for updated stats')
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Sync failed', 'err')
    } finally {
      setSyncing(false)
    }
  }

  async function handleRevokeSession(id: string) {
    setRevokingId(id)
    try {
      await revokeSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      notify('Session revoked')
    } catch { notify('Failed to revoke session', 'err') } finally { setRevokingId(null) }
  }

  async function handleRevokeAll() {
    try {
      await revokeAllSessions()
      setSessions([])
      notify('Signed out of all sessions')
    } catch { notify('Failed to sign out everywhere', 'err') }
  }

  async function handleDeleteAccount() {
    if (confirmDelete !== user?.username) { notify('Username does not match', 'err'); return }
    try {
      await deleteProfile()
      setUser(null)
      window.location.href = '/login'
    } catch { notify('Failed to delete account', 'err') }
  }

  const initials = user?.username?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="oq-page oq-prof">
      {/* Page header */}
      <header className="oq-page-head">
        <div>
          <div className="oq-page-eyebrow oq-mono">profile · settings</div>
          <h1 className="oq-page-title">Account</h1>
          <p className="oq-page-sub">
            Manage your identity, connected platforms, and notification rules.
            <span className="oq-dim"> Joined {new Date(user?.created_at ?? Date.now()).toLocaleDateString()}.</span>
          </p>
        </div>
      </header>

      {flash && <Flash msg={flash.msg} type={flash.type} />}

      <div className="oq-prof-grid">
        {/* ── Identity ─────────────────────────────────────────── */}
        <div className="oq-panel oq-prof-card">
          <div className="oq-panel-head">
            <h3>Identity</h3>
            <span className="oq-dim">visible to other users</span>
          </div>
          <div className="oq-prof-identity">
            <div className="oq-prof-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{user?.username}</div>
              <div className="oq-mono oq-dim" style={{ fontSize: 11, marginTop: 2 }}>{user?.email}</div>
            </div>
          </div>
          <form className="oq-form" onSubmit={saveProfile}>
            <label>
              <span className="oq-form-lbl">Username</span>
              <input
                className="oq-input"
                style={{ marginTop: 5 }}
                value={profileForm.username}
                onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))}
                minLength={3}
                maxLength={30}
              />
            </label>
            <label>
              <span className="oq-form-lbl">
                Email
                <span className="oq-pill oq-pill-ok" style={{ marginLeft: 8 }}>verified</span>
              </span>
              <input
                className="oq-input"
                style={{ marginTop: 5 }}
                type="email"
                value={profileForm.email}
                onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
              />
            </label>
            <div className="oq-form-foot">
              <button className="oq-btn-primary" type="submit">Save changes</button>
              <span className="oq-mono oq-dim">member since {new Date(user?.created_at ?? Date.now()).toLocaleDateString()}</span>
            </div>
          </form>
        </div>

        {/* ── Password & security ───────────────────────────────── */}
        <div className="oq-panel oq-prof-card">
          <div className="oq-panel-head">
            <h3>Password &amp; security</h3>
            <span className="oq-dim">private</span>
          </div>
          <form className="oq-form" onSubmit={savePassword}>
            <label>
              <span className="oq-form-lbl">Current password</span>
              <input
                type="password"
                className="oq-input"
                style={{ marginTop: 5 }}
                value={pwForm.current}
                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                placeholder="••••••••"
                required
              />
            </label>
            <label>
              <span className="oq-form-lbl">New password</span>
              <input
                type="password"
                className="oq-input"
                style={{ marginTop: 5 }}
                value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                placeholder="≥ 8 characters"
                required
                minLength={8}
              />
            </label>
            <label>
              <span className="oq-form-lbl">Confirm new password</span>
              <input
                type="password"
                className="oq-input"
                style={{ marginTop: 5 }}
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                required
              />
            </label>
            <button className="oq-btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>
              Change password
            </button>
          </form>
          <div className="oq-prof-divider" />
          <label className="oq-switch-row">
            <input type="checkbox" checked={twofa} onChange={() => setTwofa(v => !v)} />
            <div>
              <div className="oq-switch-title">Two-factor authentication</div>
              <div className="oq-dim" style={{ fontSize: 12, marginTop: 2 }}>
                TOTP via Authy, 1Password, or your password manager.
              </div>
            </div>
          </label>
        </div>

        {/* ── Connected platforms ───────────────────────────────── */}
        <div className="oq-panel oq-prof-card oq-prof-card-wide">
          <div className="oq-panel-head">
            <h3>Connected platforms</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="oq-dim" style={{ marginRight: 8 }}>stats pulled every hour</span>
              <button
                className="oq-btn-ghost"
                onClick={handleSync}
                disabled={syncing}
                style={{ fontSize: 11 }}
              >
                {syncing ? '↻ Syncing…' : '↻ Sync all'}
              </button>
            </div>
          </div>
          <ul className="oq-platforms">
            {PLATFORM_CONFIG.map(platform => {
              const acc = accounts.find(a => a.platform === platform.id)
              return (
                <li key={platform.id} className={cx('oq-platform', acc && 'is-connected')}>
                  <div
                    className="oq-platform-glyph"
                    style={{ background: platform.color }}
                  >
                    {platform.letter}
                  </div>
                  <div className="oq-platform-info">
                    <div className="oq-platform-name">{platform.name}</div>
                    {acc ? (
                      <div className="oq-mono oq-dim">
                        @{acc.handle} · synced {acc.last_synced_at
                          ? new Date(acc.last_synced_at).toLocaleString()
                          : 'never'}
                      </div>
                    ) : (
                      <div className="oq-mono oq-dim">
                        not connected — link to pull rating &amp; solved problems
                      </div>
                    )}
                  </div>
                  {acc ? (
                    <div className="oq-platform-actions">
                      <button className="oq-btn-ghost" onClick={handleSync} disabled={syncing} style={{ fontSize: 11 }}>
                        Sync now
                      </button>
                      <button
                        className="oq-btn-ghost oq-btn-danger"
                        onClick={() => setDisconnecting(platform.id)}
                        style={{ fontSize: 11 }}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      className="oq-btn-primary"
                      onClick={() => setConnecting(platform.id)}
                    >
                      Connect
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {/* ── Active sessions ──────────────────────────────────── */}
        <div className="oq-panel oq-prof-card oq-prof-card-wide">
          <div className="oq-panel-head">
            <h3>Active sessions</h3>
            <button className="oq-btn-ghost" style={{ fontSize: 11 }} onClick={handleRevokeAll}
              disabled={sessions.length === 0}>
              Sign out everywhere
            </button>
          </div>
          {sessions.length === 0 ? (
            <div className="oq-mono oq-dim" style={{ fontSize: 12 }}>no active sessions</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessions.map(s => (
                <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="oq-mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {s.id.slice(0, 8)}…
                    </div>
                    <div className="oq-mono oq-dim" style={{ fontSize: 10, marginTop: 2 }}>
                      created {new Date(s.created_at).toLocaleString()} ·
                      expires {new Date(s.expires_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    className="oq-btn-ghost oq-btn-danger"
                    style={{ fontSize: 11, flexShrink: 0 }}
                    disabled={revokingId === s.id}
                    onClick={() => handleRevokeSession(s.id)}
                  >
                    {revokingId === s.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Danger zone ───────────────────────────────────────── */}
        <div className="oq-panel oq-prof-card oq-prof-card-wide oq-danger-card">
          <div className="oq-panel-head">
            <h3>Danger zone</h3>
            <span className="oq-dim">cannot be undone</span>
          </div>
          <div className="oq-danger-row">
            <div>
              <div className="oq-danger-title">Export your data</div>
              <div className="oq-dim" style={{ fontSize: 13 }}>
                A zipped archive of every razbor, roadmap, and stat snapshot.
              </div>
            </div>
            <button className="oq-btn-ghost">Request export</button>
          </div>
          <div className="oq-danger-row">
            <div>
              <div className="oq-danger-title">Delete account</div>
              <div className="oq-dim" style={{ fontSize: 13 }}>
                All data wiped. Type your username to confirm.
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <input
                  className="oq-input"
                  style={{ maxWidth: 260 }}
                  placeholder={`Type "${user?.username}" to confirm`}
                  value={confirmDelete}
                  onChange={e => setConfirmDelete(e.target.value)}
                />
                <button
                  className="oq-btn-ghost oq-btn-danger"
                  onClick={handleDeleteAccount}
                  disabled={confirmDelete !== user?.username}
                >
                  Delete account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connect modal */}
      {connecting && (
        <ConnectModal
          platformName={PLATFORM_CONFIG.find(p => p.id === connecting)?.name ?? connecting}
          onClose={() => setConnecting(null)}
          onConfirm={handle => handleConnect(connecting, handle)}
        />
      )}

      {/* Disconnect confirm modal */}
      {disconnecting && (
        <DisconnectModal
          platformName={PLATFORM_CONFIG.find(p => p.id === disconnecting)?.name ?? disconnecting}
          onClose={() => setDisconnecting(null)}
          onConfirm={() => handleDisconnect(disconnecting)}
        />
      )}
    </div>
  )
}
