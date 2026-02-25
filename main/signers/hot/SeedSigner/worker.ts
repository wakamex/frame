import hdKey from 'hdkey'
import HotSignerWorker from '../HotSigner/worker'

type PseudoCallback = (error: string | null, result?: any) => void

class SeedSignerWorker extends HotSignerWorker {
  seed: string | null

  constructor() {
    super()
    this.seed = null
    process.on('message', (message: any) => this.handleMessage(message))
  }

  unlock({ encryptedSeed, password }: { encryptedSeed: string; password: string }, pseudoCallback: PseudoCallback): void {
    try {
      this.seed = this._decrypt(encryptedSeed, password)
      pseudoCallback(null)
    } catch (e) {
      pseudoCallback('Invalid password')
    }
  }

  lock(_: any, pseudoCallback: PseudoCallback): void {
    this.seed = null
    pseudoCallback(null)
  }

  encryptSeed({ seed, password }: { seed: string; password: string }, pseudoCallback: PseudoCallback): void {
    pseudoCallback(null, this._encrypt(seed.toString(), password))
  }

  signMessage({ index, message }: { index: number; message: string }, pseudoCallback: PseudoCallback): void {
    // Make sure signer is unlocked
    if (!this.seed) return pseudoCallback('Signer locked')
    // Derive private key
    const key = this._derivePrivateKey(index)
    // Sign message
    super.signMessage(key, message, pseudoCallback)
  }

  signTypedData({ index, typedMessage }: { index: number; typedMessage: any }, pseudoCallback: PseudoCallback): void {
    // Make sure signer is unlocked
    if (!this.seed) return pseudoCallback('Signer locked')
    // Derive private key
    const key = this._derivePrivateKey(index)
    // Sign message
    super.signTypedData(key, typedMessage, pseudoCallback)
  }

  signTransaction({ index, rawTx }: { index: number; rawTx: any }, pseudoCallback: PseudoCallback): void {
    // Make sure signer is unlocked
    if (!this.seed) return pseudoCallback('Signer locked')
    // Derive private key
    const key = this._derivePrivateKey(index)
    // Sign transaction
    super.signTransaction(key, rawTx, pseudoCallback)
  }

  _derivePrivateKey(index: number): Buffer {
    let key = hdKey.fromMasterSeed(Buffer.from(this.seed!, 'hex'))
    key = key.derive("m/44'/60'/0'/0/" + index)
    return key.privateKey
  }
}

const seedSignerWorker = new SeedSignerWorker() // eslint-disable-line
