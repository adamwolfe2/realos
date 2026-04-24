// No-op replacement for Next.js `server-only`. The real package throws at
// bundle time if a module is shipped to the client; in vitest we only ever
// run in Node, so this stub lets us import otherwise-pure server helpers.
export {};
