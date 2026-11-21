// Minimal namespace shim. Firefox provides the promise-based `browser`
// namespace; Chrome provides `chrome`, which returns promises in Manifest V3.
// The shared code calls `ext.*` and works with either.
globalThis.ext = globalThis.browser ?? globalThis.chrome;
