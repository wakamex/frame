// Translated to TypeScript from https://github.com/dicether/eip712/blob/master/src/eip712.ts
import abi from 'ethereumjs-abi'
import { keccak256, toBytes, toHex } from 'viem'

interface TypeField {
  name: string
  type: string
}

type TypeDefinitions = Record<string, TypeField[]>

const PRIMITIVE_TYPES = [
  /^bytes[0-9]|[0-2][0-9]|3[0-2]$/,
  /^(?:uint)8|16|32|64|128|256$/,
  /^(?:int)8|16|32|64|128|256$/,
  /^address$/,
  /^bool$/,
  /^bytes$/,
  /^string$/
]

export function isPrimitiveType(type: string) {
  return PRIMITIVE_TYPES.some((regex) => regex.test(type))
}

// Recursively finds all the dependencies of a type
function dependencies(primaryType: string, types: TypeDefinitions, found: string[] = []): string[] {
  if (found.includes(primaryType)) {
    return found
  }
  if (types[primaryType] === undefined) {
    if (!isPrimitiveType(primaryType)) {
      throw Error(`${primaryType} is not a primitive type!`)
    }
    return found
  }
  found.push(primaryType)
  for (const field of types[primaryType]) {
    for (const dep of dependencies(field.type, types, found)) {
      if (!found.includes(dep)) {
        found.push(dep)
      }
    }
  }
  return found
}

export function encodeType(primaryType: string, types: TypeDefinitions) {
  // Get dependencies primary first, then alphabetical
  let deps = dependencies(primaryType, types)
  deps = deps.filter((t) => t !== primaryType)
  deps = [primaryType].concat(deps.sort())

  // Format as a string with fields
  let result = ''
  for (const depType of deps) {
    result += `${depType}(${types[depType].map(({ name, type }) => `${type} ${name}`).join(',')})`
  }

  return Buffer.from(result)
}

function keccak256Buffer(input: Buffer): Buffer {
  return Buffer.from(toBytes(keccak256(input)))
}

export function typeHash(primaryType: string, types: TypeDefinitions) {
  return keccak256Buffer(encodeType(primaryType, types))
}

export function encodeData(primaryType: string, types: TypeDefinitions, data: Record<string, any>): Buffer {
  const encTypes: string[] = []
  const encValues: any[] = []

  // Add typehash
  encTypes.push('bytes32')
  encValues.push(typeHash(primaryType, types))

  // Add field contents
  for (const field of types[primaryType]) {
    const value = data[field.name]
    if (value === undefined) {
      throw Error(`Invalid typed data! Data for ${field.name} not found!`)
    }

    if (field.type === 'string' || field.type === 'bytes') {
      encTypes.push('bytes32')
      const valueHash = keccak256Buffer(Buffer.from(value))
      encValues.push(valueHash)
    } else if (types[field.type] !== undefined) {
      encTypes.push('bytes32')
      const valueHash = keccak256Buffer(encodeData(field.type, types, value))
      encValues.push(valueHash)
    } else if (field.type.lastIndexOf(']') === field.type.length - 1) {
      throw new Error('Arrays currently not implemented!')
    } else {
      if (!isPrimitiveType(field.type)) {
        throw Error(`Invalid primitive type ${field.type}`)
      }

      encTypes.push(field.type)
      encValues.push(value)
    }
  }

  return abi.rawEncode(encTypes, encValues)
}

export function structHash(primaryType: string, types: TypeDefinitions, data: Record<string, any>) {
  return keccak256Buffer(encodeData(primaryType, types, data))
}

interface TypedData {
  types: TypeDefinitions
  primaryType: string
  domain: Record<string, any>
  message: Record<string, any>
}

export function hashTypedData(typedData: TypedData) {
  return keccak256Buffer(
    Buffer.concat([
      Buffer.from('1901', 'hex'),
      structHash('EIP712Domain', typedData.types, typedData.domain),
      structHash(typedData.primaryType, typedData.types, typedData.message)
    ])
  )
}
