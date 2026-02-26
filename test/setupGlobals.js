// Polyfill TextEncoder/TextDecoder for jsdom environment
// Required by viem -> @noble/hashes and other crypto libraries
const { TextEncoder, TextDecoder } = require('util')

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder
}
