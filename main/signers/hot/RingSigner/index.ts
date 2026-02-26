import path from 'path'
import fs from 'fs'
import log from 'electron-log'
import { default as ethWallet } from 'ethereumjs-wallet'

const { fromPrivateKey, fromV1, fromV3 } = ethWallet

import HotSigner from '../HotSigner'

// In Vite bundle: __dirname is compiled/main/, workers are in compiled/main/workers/
// In source/tests: __dirname is the actual file directory, worker.js is adjacent
const bundledPath = path.resolve(__dirname, 'workers', 'ringSigner.js')
const WORKER_PATH = fs.existsSync(bundledPath) ? bundledPath : path.resolve(__dirname, 'worker.js')

interface RingSignerData {
  addresses?: string[]
  encryptedKeys?: string
  network?: string
}

class RingSigner extends HotSigner {
  constructor(signer?: RingSignerData) {
    super(signer, WORKER_PATH)
    this.type = 'ring'
    this.model = 'keyring'
    this.encryptedKeys = signer && signer.encryptedKeys
    if (this.encryptedKeys) this.update()
  }

  save(): void {
    super.save({ encryptedKeys: this.encryptedKeys })
  }

  unlock(password: string, cb: Callback<null>): void {
    super.unlock(password, { encryptedKeys: this.encryptedKeys }, cb)
  }

  addPrivateKey(key: string, password: string, cb: Callback<any>): void {
    // Validate private key
    let wallet: any
    try {
      wallet = fromPrivateKey(Buffer.from(key, 'hex'))
    } catch (e) {
      return cb(new Error('Invalid private key'))
    }
    const address: string = wallet.getAddressString()

    // Ensure private key hasn't already been added
    if (this.addresses.includes(address)) {
      return cb(new Error('Private key already added'))
    }

    // Call worker
    const params = { encryptedKeys: this.encryptedKeys, key, password }
    this._callWorker({ method: 'addKey', params }, (err: Error | null, encryptedKeys?: string) => {
      // Handle errors
      if (err) return cb(err)

      // Update addresses
      this.addresses = [...this.addresses, address]

      // Update encrypted keys
      this.encryptedKeys = encryptedKeys

      // Log and update signer
      log.info('Private key added to signer', this.id)
      this.update()

      // If signer was unlock -> update keys in worker
      this.unlock(password, cb)
    })
  }

  removePrivateKey(index: number, password: string, cb: Callback<any>): void {
    // Call worker
    const params = { encryptedKeys: this.encryptedKeys, index, password }
    this._callWorker({ method: 'removeKey', params }, (err: Error | null, encryptedKeys?: string) => {
      // Handle errors
      if (err) return cb(err)

      // Remove address at index
      this.addresses = this.addresses.filter((address: string) => address !== this.addresses[index])

      // Update encrypted keys
      this.encryptedKeys = encryptedKeys

      // Log and update signer
      log.info('Private key removed from signer', this.id)
      this.update()

      // If signer was unlock -> update keys in worker
      if (this.status === 'ok') this.lock(cb)
      else cb(null)
    })
  }

  // TODO: Encrypt all keys together so that they all get the same password
  async addKeystore(keystore: any, keystorePassword: string, password: string, cb: Callback<any>): Promise<void> {
    let wallet: any
    // Try to generate wallet from keystore
    try {
      if (keystore.version === 1) wallet = await fromV1(keystore, keystorePassword)
      else if (keystore.version === 3) wallet = await fromV3(keystore, keystorePassword)
      else return cb(new Error('Invalid keystore version'))
    } catch (e) {
      return cb(e as Error)
    }
    // Add private key
    this.addPrivateKey(wallet.privateKey.toString('hex'), password, cb)
  }
}

export default RingSigner
