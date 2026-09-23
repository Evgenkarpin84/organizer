// Генератор иконок PWA без внешних зависимостей: рисует пиксели и пакует их в PNG.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const BACKGROUND = [37, 99, 235] // blue-600
const FOREGROUND = [255, 255, 255]

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // бит на канал
  header[9] = 6 // RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function mix(from, to, amount) {
  return Math.round(from + (to - from) * amount)
}

/** Скруглённый квадрат с галочкой; maskable — во всю площадь, галочка меньше. */
function drawIcon(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4)
  const radius = maskable ? 0 : size * 0.22
  const scale = maskable ? 0.62 : 0.78
  const center = size / 2
  const thickness = size * 0.085 * scale
  const points = [
    [0.28, 0.52],
    [0.44, 0.68],
    [0.74, 0.33],
  ].map(([x, y]) => [center + (x - 0.5) * size * scale, center + (y - 0.5) * size * scale])

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5
      const py = y + 0.5
      const dx = Math.max(radius - px, px - (size - radius), 0)
      const dy = Math.max(radius - py, py - (size - radius), 0)
      const outside = Math.hypot(dx, dy) - radius
      const alpha = Math.max(0, Math.min(1, 0.5 - outside))

      const check = Math.min(
        distanceToSegment(px, py, points[0][0], points[0][1], points[1][0], points[1][1]),
        distanceToSegment(px, py, points[1][0], points[1][1], points[2][0], points[2][1]),
      )
      const checkAlpha = Math.max(0, Math.min(1, thickness / 2 - check + 0.5))

      const offset = (y * size + x) * 4
      pixels[offset] = mix(BACKGROUND[0], FOREGROUND[0], checkAlpha)
      pixels[offset + 1] = mix(BACKGROUND[1], FOREGROUND[1], checkAlpha)
      pixels[offset + 2] = mix(BACKGROUND[2], FOREGROUND[2], checkAlpha)
      pixels[offset + 3] = Math.round(alpha * 255)
    }
  }
  return pixels
}

mkdirSync(OUT_DIR, { recursive: true })

const icons = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-512-maskable.png', size: 512, maskable: true },
]

for (const icon of icons) {
  const png = encodePng(icon.size, drawIcon(icon.size, icon.maskable))
  writeFileSync(resolve(OUT_DIR, icon.file), png)
  console.log(`${icon.file}: ${png.length} байт`)
}
