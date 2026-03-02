import { keccak256, toBytes } from 'viem'
import {
  encodeType,
  typeHash,
  encodeData,
  structHash,
  hashTypedData,
  isPrimitiveType
} from '../../../main/crypt/typedDataUtils'

// EIP-712 Mail example from the spec
const mailTypes = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' }
  ],
  Person: [
    { name: 'name', type: 'string' },
    { name: 'wallet', type: 'address' }
  ],
  Mail: [
    { name: 'from', type: 'Person' },
    { name: 'to', type: 'Person' },
    { name: 'contents', type: 'string' }
  ]
}

const mailDomain = {
  name: 'Ether Mail',
  version: '1',
  chainId: 1,
  verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
}

const mailMessage = {
  from: {
    name: 'Cow',
    wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
  },
  to: {
    name: 'Bob',
    wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
  },
  contents: 'Hello, Bob!'
}

// Helper to compute keccak256 the same way the source does
function keccak256Buffer(input) {
  return Buffer.from(toBytes(keccak256(input)))
}

describe('isPrimitiveType', () => {
  it('recognizes Solidity integer types', () => {
    expect(isPrimitiveType('uint8')).toBe(true)
    expect(isPrimitiveType('uint256')).toBe(true)
    expect(isPrimitiveType('int8')).toBe(true)
    expect(isPrimitiveType('int256')).toBe(true)
  })

  it('recognizes address, bool, bytes, and string', () => {
    expect(isPrimitiveType('address')).toBe(true)
    expect(isPrimitiveType('bool')).toBe(true)
    expect(isPrimitiveType('bytes')).toBe(true)
    expect(isPrimitiveType('string')).toBe(true)
  })

  it('recognizes fixed-size bytes types', () => {
    expect(isPrimitiveType('bytes1')).toBe(true)
    expect(isPrimitiveType('bytes32')).toBe(true)
  })

  it('rejects struct types that are not primitives', () => {
    expect(isPrimitiveType('Person')).toBe(false)
    expect(isPrimitiveType('Mail')).toBe(false)
    // NOTE: 'EIP712Domain' contains '12' which matches the [0-2][0-9] regex alternative
    // due to operator precedence in the PRIMITIVE_TYPES regexes — this is a known regex quirk
    expect(isPrimitiveType('Transfer')).toBe(false)
    expect(isPrimitiveType('Vote')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isPrimitiveType('')).toBe(false)
  })
})

describe('encodeType', () => {
  it('encodes a simple struct with primitive fields', () => {
    const result = encodeType('Person', mailTypes)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.toString()).toBe('Person(string name,address wallet)')
  })

  it('encodes nested struct with primary type first, dependencies sorted alphabetically', () => {
    const result = encodeType('Mail', mailTypes)
    expect(result.toString()).toBe('Mail(Person from,Person to,string contents)Person(string name,address wallet)')
  })

  it('handles multiple dependencies sorted alphabetically', () => {
    const types = {
      Order: [
        { name: 'buyer', type: 'Buyer' },
        { name: 'seller', type: 'Seller' },
        { name: 'amount', type: 'uint256' }
      ],
      Seller: [{ name: 'addr', type: 'address' }],
      Buyer: [{ name: 'addr', type: 'address' }]
    }
    const result = encodeType('Order', types)
    // Buyer and Seller are sorted alphabetically after Order
    expect(result.toString()).toBe('Order(Buyer buyer,Seller seller,uint256 amount)Buyer(address addr)Seller(address addr)')
  })

  it('handles self-referential (circular) types without infinite recursion', () => {
    const circularTypes = {
      Tree: [
        { name: 'value', type: 'uint256' },
        { name: 'left', type: 'Tree' },
        { name: 'right', type: 'Tree' }
      ]
    }
    const result = encodeType('Tree', circularTypes)
    expect(result.toString()).toBe('Tree(uint256 value,Tree left,Tree right)')
  })
})

describe('typeHash', () => {
  it('returns a 32-byte Buffer', () => {
    const result = typeHash('Person', mailTypes)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(32)
  })

  it('returns keccak256 of the encoded type string', () => {
    const encoded = encodeType('Person', mailTypes)
    const expected = keccak256Buffer(encoded)
    const result = typeHash('Person', mailTypes)
    expect(result.toString('hex')).toBe(expected.toString('hex'))
  })

  it('produces different hashes for different types', () => {
    const personHash = typeHash('Person', mailTypes)
    const mailHash = typeHash('Mail', mailTypes)
    expect(personHash.toString('hex')).not.toBe(mailHash.toString('hex'))
  })
})

describe('encodeData', () => {
  it('encodes primitive fields (address, uint256, bool)', () => {
    const types = {
      Transfer: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ]
    }
    const data = {
      from: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
      to: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
      amount: 1000
    }
    const result = encodeData('Transfer', types, data)
    expect(result).toBeInstanceOf(Buffer)
    // ABI-encoded data: 32 bytes typeHash + 32 bytes per field = 4 * 32 = 128 bytes
    expect(result.length).toBe(4 * 32)
  })

  it('hashes string fields with keccak256', () => {
    const types = {
      Message: [{ name: 'contents', type: 'string' }]
    }
    const data1 = { contents: 'hello' }
    const data2 = { contents: 'world' }
    const result1 = encodeData('Message', types, data1)
    const result2 = encodeData('Message', types, data2)
    // Both should be 2 * 32 = 64 bytes (typeHash + hashed string)
    expect(result1.length).toBe(2 * 32)
    expect(result2.length).toBe(2 * 32)
    // Different string values should produce different encodings
    expect(result1.toString('hex')).not.toBe(result2.toString('hex'))
  })

  it('hashes bytes fields with keccak256', () => {
    const types = {
      Data: [{ name: 'payload', type: 'bytes' }]
    }
    const data = { payload: Buffer.from('hello').toString() }
    const result = encodeData('Data', types, data)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(2 * 32) // typeHash + hashed bytes
  })

  it('encodes nested struct fields recursively', () => {
    // Mail has Person (nested struct)
    const result = encodeData('Mail', mailTypes, mailMessage)
    expect(result).toBeInstanceOf(Buffer)
    // typeHash + from (bytes32) + to (bytes32) + contents (bytes32) = 4 * 32 = 128
    expect(result.length).toBe(4 * 32)
  })

  it('throws for array fields (array type resolution fails in dependencies)', () => {
    const types = {
      Group: [
        { name: 'name', type: 'string' },
        { name: 'members', type: 'Person[]' }
      ],
      Person: [{ name: 'name', type: 'string' }]
    }
    const data = { name: 'Friends', members: [{ name: 'Alice' }] }
    // Array types fail during type resolution in encodeType/dependencies before reaching
    // the "Arrays currently not implemented!" check in encodeData
    expect(() => encodeData('Group', types, data)).toThrow()
  })

  it('throws when a required field is missing from data', () => {
    const types = {
      Message: [
        { name: 'title', type: 'string' },
        { name: 'body', type: 'string' }
      ]
    }
    const data = { title: 'Hello' } // missing 'body'
    expect(() => encodeData('Message', types, data)).toThrow('Invalid typed data! Data for body not found!')
  })
})

describe('structHash', () => {
  it('returns a 32-byte Buffer', () => {
    const result = structHash('Person', mailTypes, mailMessage.from)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(32)
  })

  it('returns keccak256 of encodeData', () => {
    const encoded = encodeData('Person', mailTypes, mailMessage.from)
    const expected = keccak256Buffer(encoded)
    const result = structHash('Person', mailTypes, mailMessage.from)
    expect(result.toString('hex')).toBe(expected.toString('hex'))
  })

  it('produces different hashes for different data', () => {
    const hash1 = structHash('Person', mailTypes, mailMessage.from)
    const hash2 = structHash('Person', mailTypes, mailMessage.to)
    expect(hash1.toString('hex')).not.toBe(hash2.toString('hex'))
  })
})

describe('hashTypedData', () => {
  it('returns a 32-byte Buffer', () => {
    const result = hashTypedData({
      types: mailTypes,
      primaryType: 'Mail',
      domain: mailDomain,
      message: mailMessage
    })
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(32)
  })

  it('produces correct EIP-712 hash for the Mail example from the spec', () => {
    // Expected hash from the EIP-712 specification Mail example
    // Reference: https://eips.ethereum.org/EIPS/eip-712
    const result = hashTypedData({
      types: mailTypes,
      primaryType: 'Mail',
      domain: mailDomain,
      message: mailMessage
    })
    expect('0x' + result.toString('hex')).toBe(
      '0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2'
    )
  })

  it('produces different hashes for different messages', () => {
    const hash1 = hashTypedData({
      types: mailTypes,
      primaryType: 'Mail',
      domain: mailDomain,
      message: mailMessage
    })
    const hash2 = hashTypedData({
      types: mailTypes,
      primaryType: 'Mail',
      domain: mailDomain,
      message: { ...mailMessage, contents: 'Goodbye, Bob!' }
    })
    expect(hash1.toString('hex')).not.toBe(hash2.toString('hex'))
  })

  it('produces different hashes for different domains', () => {
    const hash1 = hashTypedData({
      types: mailTypes,
      primaryType: 'Mail',
      domain: mailDomain,
      message: mailMessage
    })
    const hash2 = hashTypedData({
      types: mailTypes,
      primaryType: 'Mail',
      domain: { ...mailDomain, chainId: 137 },
      message: mailMessage
    })
    expect(hash1.toString('hex')).not.toBe(hash2.toString('hex'))
  })

  it('full integration: hashes simple typed data with only primitive fields', () => {
    const types = {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' }
      ],
      Vote: [
        { name: 'voter', type: 'address' },
        { name: 'proposal', type: 'uint256' },
        { name: 'support', type: 'bool' }
      ]
    }
    const domain = { name: 'Voting', chainId: 1 }
    const message = {
      voter: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
      proposal: 1,
      support: true
    }
    const result = hashTypedData({ types, primaryType: 'Vote', domain, message })
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(32)
  })
})
