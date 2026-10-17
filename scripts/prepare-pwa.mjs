import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Imported worker scripts participate in the browser's byte-for-byte update
// check. Fingerprint shipped code, not timestamps, so identical builds stay quiet.
async function sources(directory, include = /\.(?:tsx?|css)$/) {
  const entries = await readdir(resolve(directory), { withFileTypes: true })
  const files = await Promise.all(entries.map((entry) => entry.isDirectory() ? sources(`${directory}/${entry.name}`, include) : include.test(entry.name) && !entry.name.includes('.test.') ? [`${directory}/${entry.name}`] : []))
  return files.flat()
}
const hash = createHash('sha256')
const logos = (await readdir('.')).filter((name) => /^velvetia.*\.(?:png|ico|svg)$/.test(name))
for (const file of [...await sources('src'), ...await sources('public', /\.(?:png|ico|html)$/), ...await sources('fonts', /\.woff2$/), ...logos, 'package-lock.json', 'next.config.ts', 'public/sw.js'].sort()) {
  hash.update(file); hash.update(await readFile(resolve(file)))
}
await writeFile(resolve('public/pwa-build.js'), `// Velvetia build: ${hash.digest('hex')}\n`)
