import { decodeFunctionData, type Abi, type Hex } from 'viem'

import { registrar as registrarAbi, registrarController as registrarControllerAbi } from './abi'
import store from '../../../store'

import type {
  ApproveAction as EnsApprovalAction,
  TransferAction as EnsTransferAction,
  RegisterAction as EnsRegistrationAction,
  RenewAction as EnsRenewalAction
} from '../../../transaction/actions/ens'

import type { DecodableContract } from '../../../transaction/actions'

// TODO: fix typing on contract types
type EnsContract = DecodableContract<unknown>

declare module ENS {
  export type Register = {
    name: string
    owner: string
    duration: bigint // seconds
    resolver?: string
  }

  export type Renew = {
    name: string
    duration: bigint // seconds
  }

  export type Transfer = {
    from: string
    to: string
    tokenId: bigint
  }

  export type Approval = {
    to: string
    tokenId: bigint
  }
}

type DeploymentLocation = {
  name?: string
  address: Address
  chainId: number
}

function decode(abi: Abi, calldata: string) {
  return decodeFunctionData({ abi, data: calldata as Hex })
}

function getNameForTokenId(account: string, tokenId: string) {
  const ensInventory: InventoryCollection = store('main.inventory', account, 'ens') || {}
  const items = ensInventory.items || {}

  const record = Object.values(items).find((ens) => ens.tokenId === tokenId) || { name: '' }

  return record.name
}

function ethName(name: string) {
  // assumes all names will be registered in the .eth domain, in the future this may not be the case
  return name.includes('.eth') ? name : `${name}.eth`
}

const registrar = ({ name = 'ENS Registrar', address, chainId }: DeploymentLocation): EnsContract => {
  return {
    name,
    chainId,
    address,
    decode: (calldata: string, { account } = {}) => {
      const { functionName, args } = decode(registrarAbi as Abi, calldata)

      if (['transferFrom', 'safeTransferFrom'].includes(functionName)) {
        const [from, to, tokenId] = args as unknown as [string, string, bigint]
        const token = tokenId.toString()
        const name = (account && getNameForTokenId(account, token)) || ''

        return {
          id: 'ens:transfer',
          data: {
            name: name,
            from,
            to,
            tokenId: token
          }
        } as EnsTransferAction
      }

      if (functionName === 'approve') {
        const [to, tokenId] = args as unknown as [string, bigint]
        const token = tokenId.toString()
        const name = (account && getNameForTokenId(account, token)) || ''

        return {
          id: 'ens:approve',
          data: { name, operator: to, tokenId: token }
        } as EnsApprovalAction
      }
    }
  }
}

const registarController = ({
  name = 'ENS Registrar Controller',
  address,
  chainId
}: DeploymentLocation): EnsContract => {
  return {
    name,
    chainId,
    address,
    decode: (calldata: string) => {
      const { functionName, args } = decode(registrarControllerAbi as Abi, calldata)

      if (functionName === 'commit') {
        return {
          id: 'ens:commit'
        }
      }

      if (['register', 'registerWithConfig'].includes(functionName)) {
        const [name, owner, duration] = args as readonly [string, string, bigint, ...unknown[]]

        return {
          id: 'ens:register',
          data: { address: owner, name: ethName(name), duration: Number(duration) }
        } as EnsRegistrationAction
      }

      if (functionName === 'renew') {
        const [name, duration] = args as readonly [string, bigint]

        return {
          id: 'ens:renew',
          data: { name: ethName(name), duration: Number(duration) }
        } as EnsRenewalAction
      }
    }
  }
}

const mainnetRegistrar = registrar({
  name: '.eth Permanent Registrar',
  address: '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85',
  chainId: 1
})

const mainnetRegistrarController = registarController({
  name: 'ETHRegistrarController',
  address: '0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5',
  chainId: 1
})

// TODO: in the future the addresses for these contracts can be discovered in real time
export default [mainnetRegistrar, mainnetRegistrarController]
