import { useEffect, useState, type FormEvent } from 'react'
import { useAuthStore } from '../store/authStore'
import { updateProfile, deleteProfile, connectAccount, disconnectAccount, syncAccounts } from '../api/profile'
import { changePassword } from '../api/auth'
import type { PlatformAccount } from '../types'
import { getStats } from '../api/profile'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="oq-panel">
      <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>{title}</h2>
      {children}
    </div>
  )
}

function Flash({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div style={{ background: type === 'ok' ? 'var(--ok)' : 'var(--err)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
      {msg}
    </div>
  )
}

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const [accounts, setAccounts] = useState<PlatformAccount[]>([])
  const [flash, setFlash] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [syncing, setSyncing] = useState(false)

  const [profileForm, setProfileForm] = useState({ email: user?.email ?? '', username: user?.username ?? '' })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [connectForm, setConnectForm] = useState<Record<string, string>>({ codeforces: '', leetcode: '' })

  useEffect(() => {
    getStats().then(() => {}).catch(() => {})
    // Load connected accounts from stats
    import('../api/profile').then(({ getStats: _ }) => {})
  }, [])

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
      notify('Password changed')
    } catch { notify('Incorrect current password', 'err') }
  }

  async function handleConnect(platform: string) {
    const handle = connectForm[platform]
    if (!handle.trim()) { notify('Enter a handle', 'err'); return }
    try {
      const acc = await connectAccount(platform, handle.trim())
      setAccounts(prev => [...prev.filter(a => a.platform !== platform), acc])
      setConnectForm(f => ({ ...f, [platform]: '' }))
      notify(`${platform} connected`)
    } catch { notify(`Failed to connect ${platform}`, 'err') }
  }

  async function handleDisconnect(platform: string) {
    if (!confirm(`Disconnect ${platform}? All cached data will be removed.`)) return
    try {
      await disconnectAccount(platform)
      setAccounts(prev => prev.filter(a => a.platform !== platform))
      notify(`${platform} disconnected`)
    } catch { notify('Failed to disconnect', 'err') }
  }

  async function handleSync() {
    setSyncing(true)
    try { await syncAccounts(); notify('Sync complete') }
    catch { notify('Sync failed', 'err') }
    finally { setSyncing(false) }
  }

  async function handleDeleteAccount() {
    if (confirmDelete !== user?.username) { notify('Username does not match', 'err'); return }
    try {
      await deleteProfile()
      setUser(null)
      window.location.href = '/login'
    } catch { notify('Failed to delete account', 'err') }
  }

  const platforms = ['codeforces', 'leetcode'] as const

  return (
    <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Profile</h1>

      {flash && <Flash msg={flash.msg} type={flash.type} />}

      {/* Identity */}
      <Section title="Identity">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.username}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>{user?.email}</div>
          </div>
        </div>
        <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label className="oq-label">Email</label>
            <input className="oq-input" type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="oq-label">Username</label>
            <input className="oq-input" type="text" value={profileForm.username} onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))} minLength={3} maxLength={30} />
          </div>
          <button className="oq-btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>Save changes</button>
        </form>
      </Section>

      {/* Password */}
      <Section title="Change Password">
        <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label className="oq-label">Current password</label>
            <input className="oq-input" type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} required />
          </div>
          <div>
            <label className="oq-label">New password</label>
            <input className="oq-input" type="password" value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} minLength={8} required />
          </div>
          <div>
            <label className="oq-label">Confirm new password</label>
            <input className="oq-input" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
          </div>
          <button className="oq-btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>Update password</button>
        </form>
      </Section>

      {/* Connected Platforms */}
      <Section title="Connected Platforms">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button onClick={handleSync} disabled={syncing} className="oq-btn-ghost" style={{ fontSize: '0.8125rem' }}>
            {syncing ? 'Syncing…' : '↺ Sync all'}
          </button>
        </div>
        {platforms.map(platform => {
          const connected = accounts.find(a => a.platform === platform)
          const label = platform === 'codeforces' ? 'Codeforces' : 'LeetCode'
          return (
            <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 100, fontWeight: 500, fontSize: '0.875rem' }}>{label}</span>
              {connected ? (
                <>
                  <span className="mono" style={{ flex: 1, color: 'var(--text-dim)', fontSize: '0.875rem' }}>{connected.handle}</span>
                  <button onClick={() => handleDisconnect(platform)} className="oq-btn-danger" style={{ fontSize: '0.8125rem', padding: '0.25rem 0.75rem' }}>Disconnect</button>
                </>
              ) : (
                <>
                  <input className="oq-input" type="text" value={connectForm[platform]} onChange={e => setConnectForm(f => ({ ...f, [platform]: e.target.value }))} placeholder={`Your ${label} handle`} style={{ flex: 1 }} />
                  <button onClick={() => handleConnect(platform)} className="oq-btn-primary" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.875rem', flexShrink: 0 }}>Connect</button>
                </>
              )}
            </div>
          )
        })}
      </Section>

      {/* Danger Zone */}
      <div className="oq-panel" style={{ border: '1px solid var(--err)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--err)' }}>Danger Zone</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-faint)', marginBottom: '1rem' }}>
          Permanently delete your account and all data. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            className="oq-input"
            type="text"
            placeholder={`Type "${user?.username}" to confirm`}
            value={confirmDelete}
            onChange={e => setConfirmDelete(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <button className="oq-btn-danger" onClick={handleDeleteAccount} disabled={confirmDelete !== user?.username}>
            Delete account
          </button>
        </div>
      </div>
    </div>
  )
}
