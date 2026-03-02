declare module 'auto-launch' {
  interface AutoLaunchOptions {
    name: string
    path?: string
    isHidden?: boolean
    mac?: { useLaunchAgent?: boolean }
  }
  class AutoLaunch {
    constructor(options: AutoLaunchOptions)
    enable(): Promise<void>
    disable(): Promise<void>
    isEnabled(): Promise<boolean>
  }
  export default AutoLaunch
}

declare module 'zxcvbn' {
  interface ZxcvbnResult {
    score: number
    crack_times_display: Record<string, string>
    feedback: { warning: string; suggestions: string[] }
  }
  function zxcvbn(password: string, userInputs?: string[]): ZxcvbnResult
  export default zxcvbn
}

declare module 'semver' {
  export function gt(v1: string, v2: string): boolean
  export function lt(v1: string, v2: string): boolean
  export function gte(v1: string, v2: string): boolean
  export function lte(v1: string, v2: string): boolean
  export function valid(v: string | null): string | null
  export function satisfies(version: string, range: string): boolean
  export function coerce(v: string | number | null | undefined): { version: string } | null
}

declare module 'ethereumjs-abi' {
  export function rawEncode(types: string[], values: any[]): Buffer
  export function rawDecode(types: string[], data: Buffer): any[]
  export function solidityPack(types: string[], values: any[]): Buffer
  export function soliditySHA3(types: string[], values: any[]): Buffer
  export function methodID(name: string, types: string[]): Buffer
  export function simpleEncode(signature: string, ...args: any[]): Buffer
  export function simpleDecode(signature: string, data: Buffer): any[]
  const _default: {
    rawEncode: typeof rawEncode
    rawDecode: typeof rawDecode
    solidityPack: typeof solidityPack
    soliditySHA3: typeof soliditySHA3
    methodID: typeof methodID
    simpleEncode: typeof simpleEncode
    simpleDecode: typeof simpleDecode
  }
  export default _default
}

declare module 'content-hash' {
  export function decode(hash: string): string
  export function fromIpfs(hash: string): string
  export function fromSwarm(hash: string): string
  export function getCodec(hash: string): string
  export function encode(codec: string, value: string): string
}

declare module '@ledgerhq/hw-transport-node-hid-noevents' {
  import Transport from '@ledgerhq/hw-transport'
  export function getDevices(): any[]
  export default class TransportNodeHidNoEvents extends Transport {
    static open(path: string): Promise<TransportNodeHidNoEvents>
    static list(): Promise<string[]>
    static listen(observer: any): { unsubscribe: () => void }
  }
}
