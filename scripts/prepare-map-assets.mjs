import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const directory = resolve('public/maplibre')
await mkdir(directory, { recursive: true })
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) await copyFile(resolve('node_modules/maplibre-gl/dist', file), resolve(directory, file))
await copyFile(resolve('node_modules/maplibre-gl/LICENSE.txt'), resolve(directory, 'LICENSE.txt'))
