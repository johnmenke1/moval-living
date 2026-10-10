// Workers stand-in for Node-only packages (playwright, resvg, satori).
// Callers already handle the failure path (e.g. submission-capture returns an empty capture).
export const chromium = { launch: async () => { throw new Error('Not available on Cloudflare Workers') } }
export class Resvg { constructor() { throw new Error('Not available on Cloudflare Workers') } }
export default {}
