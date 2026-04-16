import '@testing-library/jest-dom'

// jsdom omits a few Web APIs we use in streaming tests (DIN-66).
// Fall back to Node's built-in implementations so components exercising
// TextEncoder/TextDecoder/ReadableStream work under the jsdom environment.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeUtil = require('util')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeStreamWeb = require('stream/web')

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = nodeUtil.TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = nodeUtil.TextDecoder
}
if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = nodeStreamWeb.ReadableStream
}
