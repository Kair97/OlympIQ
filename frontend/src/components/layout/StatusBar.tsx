import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import axios from 'axios'

export default function StatusBar() {
  const location = useLocation()
  const [time, setTime] = useState(() => new Date())
  const [apiOk,   setApiOk]   = useState<boolean | null>(null)
  const [dbOk,    setDbOk]    = useState<boolean | null>(null)
  const [redisOk, setRedisOk] = useState<boolean | null>(null)

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 30_000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    async function check() {
      try {
        const r = await axios.get('/ready')
        setApiOk(true)
        setDbOk(r.data?.data?.postgres === 'ok')
        setRedisOk(r.data?.data?.redis === 'ok')
      } catch {
        setApiOk(false)
        setDbOk(false)
        setRedisOk(false)
      }
    }
    void check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [])

  const page = location.pathname.replace('/', '').toUpperCase() || 'DASHBOARD'
  const t = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  function dot(ok: boolean | null) {
    if (ok === null) return 'oq-dot'
    return ok ? 'oq-dot oq-dot-ok' : 'oq-dot oq-dot-err'
  }

  return (
    <div className="oq-status">
      <span className="oq-mono"><span className={dot(apiOk)} />api</span>
      <span className="oq-dim">·</span>
      <span className="oq-mono"><span className={dot(dbOk)} />postgres</span>
      <span className="oq-dim">·</span>
      <span className="oq-mono"><span className={dot(redisOk)} />redis</span>
      <span className="oq-dim">·</span>
      <span className="oq-mono">{page}</span>

      <span className="oq-spacer" />

      <span className="oq-mono">OlympIQ</span>
      <span className="oq-dim">·</span>
      <span className="oq-mono">{t}</span>
    </div>
  )
}
