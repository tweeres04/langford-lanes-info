// Client-safe theme type. The cookie itself lives in theme.server.ts so the
// signing/serialization logic never ships to the browser.
export type Theme = 'light' | 'dark'
