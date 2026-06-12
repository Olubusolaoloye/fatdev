import { useStore } from '../../lib/store'
import { Toggle, FieldGroup } from '../ui-kit'

export function Step4Features() {
  const { cfg, setCfg } = useStore()

  return (
    <div className="step-panel">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <Toggle on={cfg.enableChangeTax}    onChange={v => setCfg({ enableChangeTax: v })}    name="Post-deploy tax edits"    desc="Owner can call completeCustoms() after deploy" />
        <Toggle on={cfg.enableKillBlock}    onChange={v => setCfg({ enableKillBlock: v })}    name={`Kill-block snipers (${cfg.kb} blocks)`} desc={`90% fee penalty in first ${cfg.kb} blocks — no permanent ban`} />
        <Toggle on={cfg.enableSwapLimit}    onChange={v => setCfg({ enableSwapLimit: v })}    name="Buy limit per tx"          desc="Enforce maxBuyAmount" />
        <Toggle on={cfg.enableWalletLimit}  onChange={v => setCfg({ enableWalletLimit: v })}  name="Wallet size cap"           desc="Enforce maxWalletAmount" />
        <Toggle on={cfg.enableOffTrade}     onChange={v => setCfg({ enableOffTrade: v })}     name="Trade gate"                desc="Require launch() before trading opens" />
        <Toggle on={cfg.enableKillBatchBots} onChange={v => setCfg({ enableKillBatchBots: v })} name="Kill batch bots"        desc="Block same-block multi-buy by same origin" />
        <Toggle on={cfg.antiSYNC}           onChange={v => setCfg({ antiSYNC: v })}           name="AntiSYNC"                  desc="Prevents pair reserve manipulation" />
        <Toggle on={cfg.currencyIsEth}      onChange={v => setCfg({ currencyIsEth: v })}      name="Native currency pair"      desc="Use WETH/WBNB as pair token" />
        <Toggle on={cfg.enableTransferFee}  onChange={v => setCfg({ enableTransferFee: v })}  name="Transfer fee"              desc="Apply sell-rate on wallet-to-wallet transfers" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <FieldGroup label="Kill blocks (kb)">
          <input className="field-input" type="number" min={0} max={10} value={cfg.kb}
            onChange={e => setCfg({ kb: +e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Batch-bot kill blocks">
          <input className="field-input" type="number" min={0} max={10} value={cfg.killBatchBlockNumber}
            onChange={e => setCfg({ killBatchBlockNumber: +e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Airdrop numbs (0–3)">
          <input className="field-input" type="number" min={0} max={3} value={cfg.airdropNumbs}
            onChange={e => setCfg({ airdropNumbs: Math.min(3, +e.target.value) })} />
        </FieldGroup>
      </div>
    </div>
  )
}
