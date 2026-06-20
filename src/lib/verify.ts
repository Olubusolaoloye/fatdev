import SOURCE from '../contracts/FatTokenV6.sol?raw'

// Etherscan API V2 — single endpoint, chainId param selects the chain
const VERIFY_API = 'https://api.etherscan.io/v2/api'
const API_KEY    = 'BHPP1DMU8YABI4Y9MV7PUGATK49IKR8D3F'

const COMPILER_VERSION = 'v0.8.4+commit.c7e474f2'

export async function verifyContract(
  contractAddress: string,
  constructorArgs: string, // hex-encoded ABI args, no 0x prefix
  chainId: number,
  onStatus: (s: string) => void
): Promise<{ success: boolean; message: string }> {
  onStatus('Submitting source code for verification…')

  const body = new URLSearchParams({
    apikey:              API_KEY,
    module:              'contract',
    action:              'verifysourcecode',
    contractaddress:     contractAddress,
    sourceCode:          SOURCE,
    codeformat:          'solidity-single-file',
    contractname:        'FatTokenV6',
    compilerversion:     COMPILER_VERSION,
    optimizationUsed:    '1',
    runs:                '200',
    constructorArguements: constructorArgs, // note: Etherscan typo is intentional
    licenseType:         '1', // MIT
  })

  let guid: string
  try {
    const res  = await fetch(`${VERIFY_API}?chainid=${chainId}`, { method: 'POST', body })
    const json = await res.json()

    if (json.status !== '1') {
      if (json.result?.includes('Already Verified') || json.result?.includes('already verified')) {
        return { success: true, message: 'Contract already verified.' }
      }
      return { success: false, message: `Submission failed: ${json.result ?? json.message}` }
    }
    guid = json.result as string
  } catch (e: any) {
    return { success: false, message: `Network error during submission: ${e.message}` }
  }

  // Poll for result — Etherscan takes 20–60 s to verify
  onStatus('Waiting for verification result…')
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(6000)
    try {
      const poll = await fetch(
        `${VERIFY_API}?chainid=${chainId}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${API_KEY}`
      )
      const json = await poll.json()
      const result: string = json.result ?? ''

      if (result === 'Pass - Verified') {
        return { success: true, message: 'Contract verified successfully!' }
      }
      if (result.startsWith('Fail')) {
        return { success: false, message: `Verification failed: ${result}` }
      }
      if (result.includes('Already Verified')) {
        return { success: true, message: 'Contract already verified.' }
      }
      onStatus(`Verification pending… (${result || 'checking'})`)
    } catch {
      // transient — keep polling
    }
  }

  return { success: false, message: 'Verification timed out. Check the block explorer manually.' }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
