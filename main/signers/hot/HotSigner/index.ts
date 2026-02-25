import path from 'path'
import fs from 'fs'
import { ensureDirSync, removeSync } from 'fs-extra'
import { fork, ChildProcess } from 'child_process'
import { app } from 'electron'
import log from 'electron-log'
import { v4 as uuid } from 'uuid'

import Signer from '../../Signer'
import store from '../../../store'

// Mock user data dir during tests
const USER_DATA = app
  ? app.getPath('userData')
  : path.resolve(path.dirname(require.main!.filename!), '../.userData')
const SIGNERS_PATH = path.resolve(USER_DATA, 'signers')

interface SignerData {
  addresses?: string[]
  encryptedKeys?: string
  encryptedSeed?: string
  network?: string
}

interface WorkerPayload {
  method: string
  params?: any
}

interface WorkerResponse {
  type: string
  id?: string
  token?: string
  error?: string
  result?: any
}

class HotSigner extends Signer {
  _worker: ChildProcess
  _token: string | null = null
  ready: boolean
  encryptedKeys?: string
  encryptedSeed?: string
  network?: string

  constructor(signer: SignerData | undefined, workerPath: string) {
    super()
    this.status = 'locked'
    this.addresses = signer ? signer.addresses || [] : []
    this._worker = fork(workerPath)
    this._getToken()
    this.ready = false
  }

  save(data: Record<string, any>): void {
    // Construct signer
    const { id, addresses, type, network } = this
    const signer = { id, addresses, type, network, ...data }

    // Ensure signers directory exists
    ensureDirSync(SIGNERS_PATH)

    // Write signer to disk
    fs.writeFileSync(path.resolve(SIGNERS_PATH, `${id}.json`), JSON.stringify(signer), { mode: 0o600 })

    // Log
    log.debug('Signer saved to disk')
  }

  delete(): void {
    const signerPath = path.resolve(SIGNERS_PATH, `${this.id}.json`)

    // Overwrite file
    fs.writeFileSync(signerPath, '00000000000000000000000000000000000000000000000000000000000000000000', {
      mode: 0o600
    })

    // Remove file
    removeSync(signerPath)

    // Log
    log.info('Signer erased from disk')
  }

  lock(cb: Callback<null>): void {
    this._callWorker({ method: 'lock' }, () => {
      this.status = 'locked'
      this.update()
      log.info('Signer locked')
      cb(null)
    })
  }

  unlock(password: string, data: Record<string, any>, cb: Callback<null>): void {
    const params = { password, ...data }
    this._callWorker({ method: 'unlock', params }, (err: Error | null) => {
      if (err) return cb(err)
      this.status = 'ok'
      this.update()
      log.info('Signer unlocked')
      cb(null)
    })
  }

  close(): void {
    if (this.ready) this._worker.disconnect()
    else this.once('ready', () => this._worker.disconnect())
    ;(store as any).removeSigner(this.id)
    log.info('Signer closed')
  }

  update(): void {
    // Get derived ID
    const derivedId = this.fingerprint()

    // On new ID ->
    if (!this.id) {
      // Update id
      this.id = derivedId!
      // Write to disk
      this.save({ encryptedKeys: this.encryptedKeys, encryptedSeed: this.encryptedSeed })
    } else if (this.id !== derivedId) {
      // On changed ID
      // Erase from disk
      this.delete()
      // Remove from store
      ;(store as any).removeSigner(this.id)
      // Update id
      this.id = derivedId!
      // Write to disk
      this.save({ encryptedKeys: this.encryptedKeys, encryptedSeed: this.encryptedSeed })
    }

    ;(store as any).updateSigner(this.summary())
    log.info('Signer updated')
  }

  signMessage(index: number, message: string, cb: Callback<string>): void {
    const payload = { method: 'signMessage', params: { index, message } }
    this._callWorker(payload, cb)
  }

  signTypedData(index: number, typedMessage: any, cb: Callback<string>): void {
    const payload = { method: 'signTypedData', params: { index, typedMessage } }
    this._callWorker(payload, cb)
  }

  signTransaction(index: number, rawTx: any, cb: Callback<string>): void {
    const payload = { method: 'signTransaction', params: { index, rawTx } }
    this._callWorker(payload, cb)
  }

  verifyAddress(index: number, address: string, display: boolean, cb: Callback<boolean> = () => {}): void {
    const payload = { method: 'verifyAddress', params: { index, address } }
    this._callWorker(payload, (err: Error | null, verified?: boolean) => {
      if (err || !verified) {
        if (!err) {
          ;(store as any).notify('hotSignerMismatch')
          err = new Error('Unable to verify address')
        }
        this.lock(() => {
          if (err) {
            log.error('HotSigner verifyAddress: Unable to verify address')
          } else {
            log.error('HotSigner verifyAddress: Address mismatch')
          }
          log.error(err)
        })
        cb(err)
      } else {
        log.info('Hot signer verify address matched')
        cb(null, verified)
      }
    })
  }

  _getToken(): void {
    const listener = ({ type, token }: WorkerResponse) => {
      if (type === 'token') {
        this._token = token!
        this._worker.removeListener('message', listener)
        this.ready = true
        this.emit('ready')
      }
    }
    this._worker.addListener('message', listener)
  }

  _callWorker(payload: WorkerPayload, cb: (...args: any[]) => void): void {
    if (!this._worker) throw Error('Worker not running')
    // If token not yet received -> retry in 100 ms
    if (!this._token) return void setTimeout(() => this._callWorker(payload, cb), 100)
    // Generate message id
    const id = uuid()
    // Handle response
    const listener = (response: WorkerResponse) => {
      if (response.type === 'rpc' && response.id === id) {
        const error = response.error ? new Error(response.error) : null
        cb(error, response.result)
        this._worker.removeListener('message', listener)
      }
    }
    this._worker.addListener('message', listener)
    // Make RPC call
    this._worker.send({ id, token: this._token, ...payload })
  }
}

export default HotSigner
