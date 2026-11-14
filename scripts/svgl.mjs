// Refreshes the bundled copy of SVGL's logo list (src/data/svgl.json), used until the app
// fetches a newer one. Run with: npx tsx scripts/svgl.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSvgl } from '../src/lib/svglParse.ts'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const res = await fetch('https://cdn.jsdelivr.net/gh/pheralb/svgl@main/src/data/svgs.ts')
if (!res.ok) throw new Error(`SVGL list: HTTP ${res.status}`)
const logos = parseSvgl(await res.text())
if (logos.length < 300) throw new Error(`only ${logos.length} logos parsed`)
fs.writeFileSync(path.join(root, 'src/data/svgl.json'), JSON.stringify(logos))
console.log(`${logos.length} logos`)
