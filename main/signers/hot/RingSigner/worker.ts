import HotSignerWorker from '../HotSigner/worker'

type PseudoCallback = (error: string | null, result?: any) => void

class RingSignerWorker extends HotSignerWorker {
  keys: Buffer[] | null

  constructor() {
    super()
    this.keys = null
    process.on('message', (message: any) => this.handleMessage(message))
  }

  unlock({ encryptedKeys, password }: { encryptedKeys: string; password: string }, pseudoCallback: PseudoCallback): void {
    try {
      this.keys = this._decrypt(encryptedKeys, password)
        .split(':')
        .map((key: string) => Buffer.from(key, 'hex'))
      pseudoCallback(null)
    } catch (e) {
      pseudoCallback('Invalid password')
    }
  }

  lock(_: any, pseudoCallback: PseudoCallback): void {
    this.keys = null
    pseudoCallback(null)
  }

  addKey({ encryptedKeys, key, password }: { encryptedKeys: string | null; key: string; password: string }, pseudoCallback: PseudoCallback): void {
    let keys: string[]
    // If signer already has encrypted keys -> decrypt them and add new key
    if (encryptedKeys) keys = [...this._decryptKeys(encryptedKeys, password)!, key]
    // Else -> generate new list of keys
    else keys = [key]
    // Encrypt and return list of keys
    const encrypted = this._encryptKeys(keys, password)
    pseudoCallback(null, encrypted)
  }

  removeKey({ encryptedKeys, index, password }: { encryptedKeys: string | null; index: number; password: string }, pseudoCallback: PseudoCallback): void {
    if (!encryptedKeys) return pseudoCallback('Signer does not have any keys')
    // Get list of decrypted keys
    let keys = this._decryptKeys(encryptedKeys, password)!
    // Remove key from list
    keys = keys.filter((key: string) => key !== keys[index])
    // Return encrypted list (or null if empty)
    const result = keys.length > 0 ? this._encryptKeys(keys, password) : null
    pseudoCallback(null, result)
  }

  signMessage({ index, message }: { index: number; message: string }, pseudoCallback: PseudoCallback): void {
    // Make sure signer is unlocked
    if (!this.keys) return pseudoCallback('Signer locked')
    // Sign message
    super.signMessage(this.keys[index], message, pseudoCallback)
  }

  signTypedData({ index, typedMessage }: { index: number; typedMessage: any }, pseudoCallback: PseudoCallback): void {
    // Make sure signer is unlocked
    if (!this.keys) return pseudoCallback('Signer locked')
    // Sign Typed Data
    super.signTypedData(this.keys[index], typedMessage, pseudoCallback)
  }

  signTransaction({ index, rawTx }: { index: number; rawTx: any }, pseudoCallback: PseudoCallback): void {
    // Make sure signer is unlocked
    if (!this.keys) return pseudoCallback('Signer locked')
    // Sign transaction
    super.signTransaction(this.keys[index], rawTx, pseudoCallback)
  }

  _decryptKeys(encryptedKeys: string, password: string): string[] | null {
    if (!encryptedKeys) return null
    const keyString = this._decrypt(encryptedKeys, password)
    return keyString.split(':')
  }

  _encryptKeys(keys: string[], password: string): string {
    const keyString = keys.join(':')
    return this._encrypt(keyString, password)
  }
}

const ringSignerWorker = new RingSignerWorker() // eslint-disable-line
