import { useState, useEffect } from 'react'
import axios from 'axios'

interface ServiceStatus { name: string; ok: boolean }

export default function StatusBar() {
  const [services, setServices] = useState<ServiceStatus[]>([])

  useEffect(() => {
    async function check() {
      const results: ServiceStatus[] = []
      try {
        const r = await axios.get('/ready')
        results.push({ name: 'API', ok: r.status === 200 })
        results.push({ name: 'DB', ok: r.data?.data?.postgres === 'ok' })
        results.push({ name: 'Redis', ok: r.data?.data?.redis === 'ok' })
      } catch {
        results.push({ name: 'API', ok: false })
        results.push({ name: 'DB', ok: false })
        results.push({ name: 'Redis', ok: false })
      }
      setServices(results)
    }
    void check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <footer style={{
      height: 32,
      background: 'var(--bg-sunken)',
      borderTop: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      padding: '0 1.25rem',
      fontSize: '0.75rem',
      color: 'var(--text-faint)',
      flexShrink: 0,
    }}>
      {services.map(({ name, ok }) => (
        <span key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span className={`status-dot ${ok ? 'ok' : 'err'}`} />
          {name}
        </span>
      ))}
      <span style={{ marginLeft: 'auto' }}>OlympIQ v1.0</span>
    </footer>
  )
}
