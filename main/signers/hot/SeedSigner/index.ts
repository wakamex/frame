import path from 'path'
import HotSigner from '../HotSigner'
import bip39 from 'bip39'
import hdKey from 'hdkey'
import { publicKeyToAddress } from 'viem/accounts'

const WORKER_PATH = path.resolve(__dirname, 'worker.js')

interface SeedSignerData {
  addresses?: string[]
  encryptedSeed?: string
  network?: string
}

class SeedSigner extends HotSigner {
  constructor(signer?: SeedSignerData) {
    super(signer, WORKER_PATH)
    this.encryptedSeed = signer && signer.encryptedSeed
    this.type = 'seed'
    this.model = 'phrase'
    if (this.encryptedSeed) this.update()
  }

  addSeed(seed: string, password: string, cb: Callback<any>): void {
    if (this.encryptedSeed) return cb(new Error('This signer already has a seed'))

    this._callWorker({ method: 'encryptSeed', params: { seed, password } }, (err: Error | null, encryptedSeed?: string) => {
      if (err) return cb(err)

      // Derive addresses
      const wallet = hdKey.fromMasterSeed(Buffer.from(seed, 'hex'))

      const addresses: string[] = []
      for (let i = 0; i < 100; i++) {
        const publicKey = wallet.derive("m/44'/60'/0'/0/" + i).publicKey
        const address = publicKeyToAddress(('0x' + publicKey.toString('hex')) as `0x${string}`)
        addresses.push(address)
      }

      // Update signer
      this.encryptedSeed = encryptedSeed
      this.addresses = addresses
      this.update()
      this.unlock(password, cb)
    })
  }

  async addPhrase(phrase: string, password: string, cb: Callback<any>): Promise<void> {
    // Validate phrase
    if (!bip39.validateMnemonic(phrase)) return cb(new Error('Invalid mnemonic phrase'))
    // Get seed
    const seed = await bip39.mnemonicToSeed(phrase)
    // Add seed to signer
    this.addSeed(seed.toString('hex'), password, cb)
  }

  save(): void {
    super.save({ encryptedSeed: this.encryptedSeed })
  }

  unlock(password: string, cb: Callback<null>): void {
    super.unlock(password, { encryptedSeed: this.encryptedSeed }, cb)
  }
}

export default SeedSigner
