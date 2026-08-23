/**
 * TokenPicker — chain rail + searchable token list, in FatDev's own chrome.
 *
 * Tokens the wallet actually holds are surfaced first with their balance; the
 * rest of the chain's list is there for search. Both are already in memory by
 * the time this opens, so there is no spinner on the common path.
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { formatUnits } from 'viem'
import Icon from '../../components/ui-kit/Icon'
import type { ExtendedChain, Token } from '../../lib/lifi'
import type { TokenRow } from './useBridge'

function fmtAmount(amount: bigint, decimals: number): string {
  const n = Number(formatUnits(amount, decimals))
  if (n === 0) return '0'
  if (n < 0.0001) return '<0.0001'
  if (n < 1) return n.toFixed(4)
  if (n < 1000) return n.toFixed(4).replace(/\.?0+$/, '')
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function fmtUsd(amount: bigint, decimals: number, priceUSD?: string): string | null {
  if (!priceUSD) return null
  const v = Number(formatUnits(amount, decimals)) * Number(priceUSD)
  if (!isFinite(v) || v < 0.01) return null
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export default function TokenPicker({
  open, onClose, chains, activeChain, onChainChange, tokens, onPick, title,
}: {
  open: boolean
  onClose: () => void
  chains: ExtendedChain[]
  activeChain: number
  onChainChange: (chainId: number) => void
  tokens: TokenRow[]
  onPick: (t: Token) => void
  title: string
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Uncapped when searching so an address paste always finds its token;
    // capped otherwise because a chain list runs to thousands of entries.
    if (!q) return tokens.slice(0, 80)

    const scored: { t: TokenRow; score: number }[] = []
    for (const t of tokens) {
      const sym = t.symbol?.toLowerCase() ?? ''
      const name = t.name?.toLowerCase() ?? ''
      let score = -1
      if (t.address?.toLowerCase() === q) score = 100
      else if (sym === q) score = 80
      else if (sym.startsWith(q)) score = 60
      else if (name === q) score = 50
      else if (name.startsWith(q)) score = 40
      else if (sym.includes(q)) score = 20
      else if (name.includes(q)) score = 10
      if (score < 0) continue
      // Held tokens win ties — it is almost always the one being looked for.
      if (t.amount && t.amount > 0n) score += 5
      scored.push({ t, score })
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 120)
      .map(s => s.t)
  }, [tokens, query])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'color-mix(in srgb, var(--fd-void) 78%, transparent)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={title}
        style={{
          width: '100%', maxWidth: 440, maxHeight: 'min(620px, 88vh)',
          background: 'var(--fd-surface)',
          border: '1px solid var(--fd-border)',
          borderRadius: 'var(--fd-radius-lg)',
          boxShadow: 'var(--fd-shadow)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px 12px', borderBottom: '1px solid var(--fd-border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 15, fontWeight: 700, color: 'var(--fd-white)',
            fontFamily: 'var(--fd-font-display)',
          }}>{title}</span>
          <button onClick={onClose} aria-label="Close"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--fd-ghost)', display: 'flex', padding: 4,
            }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Chain rail */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 18px',
          borderBottom: '1px solid var(--fd-border)',
          flexShrink: 0,
        }}>
          {chains.map(c => {
            const active = c.id === activeChain
            return (
              <button key={c.id} onClick={() => onChainChange(c.id)}
                title={c.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '6px 11px', borderRadius: 20, cursor: 'pointer',
                  background: active ? 'var(--fd-accent-ghost)' : 'var(--fd-fill)',
                  border: `1px solid ${active ? 'var(--fd-border-accent)' : 'transparent'}`,
                  color: active ? 'var(--fd-accent)' : 'var(--fd-ghost)',
                  fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--fd-font-display)',
                  whiteSpace: 'nowrap',
                }}>
                {c.logoURI && (
                  <img src={c.logoURI} alt="" width={15} height={15}
                    style={{ borderRadius: '50%' }} />
                )}
                {c.name}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div style={{ padding: '12px 18px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--fd-hint)', display: 'flex', pointerEvents: 'none',
            }}>
              <Icon name="search" size={15} />
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, symbol or paste an address"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px 10px 34px',
                background: 'var(--fd-fill)',
                border: '1px solid var(--fd-border)',
                borderRadius: 'var(--fd-radius)',
                color: 'var(--fd-white)', fontSize: 13,
                fontFamily: 'var(--fd-font-display)', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', padding: '0 10px 12px', flex: 1, minHeight: 0 }}>
          {filtered.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '36px 20px',
              color: 'var(--fd-ghost)', fontSize: 13,
            }}>
              {tokens.length === 0 ? 'Loading tokens…' : 'No token matches that search.'}
            </div>
          )}
          {filtered.map(t => {
            const bal = t.amount ?? 0n
            const usd = fmtUsd(bal, t.decimals, t.priceUSD)
            return (
              <button key={`${t.chainId}-${t.address}`}
                onClick={() => { onPick(t); onClose() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                  padding: '10px 12px', borderRadius: 'var(--fd-radius)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  textAlign: 'left', color: 'var(--fd-white)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--fd-fill)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                {t.logoURI
                  ? <img src={t.logoURI} alt="" width={30} height={30}
                      style={{ borderRadius: '50%', flexShrink: 0 }} />
                  : <span style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--fd-fill-strong)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'var(--fd-ghost)',
                    }}>{t.symbol?.slice(0, 2)}</span>}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: 13, fontWeight: 600,
                    fontFamily: 'var(--fd-font-display)',
                  }}>{t.symbol}</span>
                  <span style={{
                    display: 'block', fontSize: 11, color: 'var(--fd-ghost)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.name}</span>
                </span>
                {bal > 0n && (
                  <span style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{
                      display: 'block', fontSize: 12.5, fontWeight: 600,
                      fontFamily: 'var(--fd-font-mono)', color: 'var(--fd-white)',
                    }}>{fmtAmount(bal, t.decimals)}</span>
                    {usd && (
                      <span style={{
                        display: 'block', fontSize: 10.5, color: 'var(--fd-ghost)',
                        fontFamily: 'var(--fd-font-mono)',
                      }}>{usd}</span>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
