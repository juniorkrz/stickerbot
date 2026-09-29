import { execFile } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import sharp from 'sharp'
import Sticker from 'wa-sticker-formatter'
import Exif from 'wa-sticker-formatter/dist/internal/Metadata/Exif'

import { getLogger } from './logger'

const logger = getLogger()

// O WhatsApp recusa figurinhas animadas acima de ~500 KB (e as estáticas acima de ~100 KB ficam lentas)
export const MAX_ANIMATED_BYTES = 490 * 1024
export const MAX_STATIC_BYTES = 490 * 1024
const SIZE = 512
const MAX_SECONDS = 10

export interface StickerMeta {
  author?: string
  pack?: string
}

type Kind = 'video' | 'gif' | 'animated-webp' | 'image'

// Detecta o tipo pelo começo do arquivo (sem depender de extensão/mimetype)
export const detectKind = (buffer: Buffer): Kind => {
  const head = buffer.subarray(0, 64)
  if (head.subarray(0, 4).toString('ascii') === 'GIF8') return 'gif'
  if (head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP') {
    // WebP animado tem o chunk VP8X com a flag de animação (bit 1)
    const isVp8x = head.subarray(12, 16).toString('ascii') === 'VP8X'
    return isVp8x && (head[20] & 0x02) ? 'animated-webp' : 'image'
  }
  if (head.subarray(4, 8).toString('ascii') === 'ftyp') return 'video' // mp4 / mov / 3gp
  if (head.readUInt32BE(0) === 0x1a45dfa3) return 'video' // webm / mkv
  return 'image'
}

const run = (cmd: string, args: string[], timeoutMs = 90_000) => new Promise<void>((resolve, reject) => {
  execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, _stdout, stderr) => {
    if (error) reject(new Error(`${cmd} falhou: ${String(stderr).split('\n').slice(-4).join(' ')}`))
    else resolve()
  })
})

// Tentativas da mais bonita para a mais leve; para na primeira que couber no limite
const ATTEMPTS = [
  { quality: 75, fps: 15, size: 512 },
  { quality: 60, fps: 15, size: 512 },
  { quality: 50, fps: 12, size: 512 },
  { quality: 40, fps: 10, size: 448 },
  { quality: 30, fps: 10, size: 384 },
  { quality: 25, fps: 8, size: 320 },
  { quality: 15, fps: 6, size: 256 }
]

// Vídeo / GIF -> WebP animado 512x512 (conteúdo centralizado, fundo transparente) com ffmpeg
const encodeWithFfmpeg = async (input: Buffer): Promise<Buffer> => {
  const base = path.join(os.tmpdir(), `sticker-${crypto.randomBytes(6).toString('hex')}`)
  const inFile = `${base}.in`
  await fs.promises.writeFile(inFile, input)
  let best: Buffer | undefined
  try {
    for (const a of ATTEMPTS) {
      const outFile = `${base}-${a.quality}-${a.fps}-${a.size}.webp`
      const filter = `fps=${a.fps},scale=${a.size}:${a.size}:force_original_aspect_ratio=decrease:flags=lanczos,` +
        `format=rgba,pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`
      await run('ffmpeg', [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', inFile,
        '-t', String(MAX_SECONDS),
        '-an',
        '-vf', filter,
        '-c:v', 'libwebp',
        '-lossless', '0',
        '-q:v', String(a.quality),
        '-compression_level', '6',
        '-preset', 'picture',
        '-loop', '0',
        '-vsync', '0',
        outFile
      ])
      const out = await fs.promises.readFile(outFile)
      await fs.promises.unlink(outFile).catch(() => undefined)
      if (!best || out.length < best.length) best = out
      if (out.length <= MAX_ANIMATED_BYTES) return out
    }
  } finally {
    await fs.promises.unlink(inFile).catch(() => undefined)
  }
  return best!
}

// WebP animado (o ffmpeg não decodifica) -> reencode com sharp, reduzindo qualidade/tamanho
const encodeAnimatedWebp = async (input: Buffer): Promise<Buffer> => {
  let best: Buffer | undefined
  for (const a of ATTEMPTS) {
    const pad = Math.floor((SIZE - a.size) / 2)
    const out = await sharp(input, { animated: true })
      .resize(a.size, a.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: pad, bottom: SIZE - a.size - pad, left: pad, right: SIZE - a.size - pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: a.quality, effort: 6, loop: 0 })
      .toBuffer()
    if (!best || out.length < best.length) best = out
    if (out.length <= MAX_ANIMATED_BYTES) return out
  }
  return best!
}

const addExif = async (webp: Buffer, meta: StickerMeta): Promise<Buffer> =>
  await new Exif({ pack: meta.pack || '', author: meta.author || '' }).add(webp)

const loadData = async (data: string | Buffer): Promise<Buffer> => {
  if (Buffer.isBuffer(data)) return data
  const res = await fetch(data)
  if (!res.ok) throw new Error(`Falha ao baixar ${data}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Gera a mensagem de figurinha garantindo que ela caiba no limite do WhatsApp.
 * Animadas (vídeo, GIF, WebP animado) passam pelo encoder próprio; estáticas usam a lib
 * e só são reprocessadas se ficarem grandes demais.
 */
export const buildStickerMessage = async (data: string | Buffer, meta: StickerMeta): Promise<{ sticker: Buffer }> => {
  const input = await loadData(data)
  const kind = detectKind(input)
  const started = Date.now()

  if (kind === 'video' || kind === 'gif' || kind === 'animated-webp') {
    const webp = kind === 'animated-webp' ? await encodeAnimatedWebp(input) : await encodeWithFfmpeg(input)
    logger.info(`[STICKER] ${kind} ${Math.round(input.length / 1024)} KB -> ${Math.round(webp.length / 1024)} KB ` +
      `em ${Date.now() - started} ms`)
    if (webp.length > MAX_ANIMATED_BYTES) {
      logger.warn(`[STICKER] Figurinha animada ficou com ${Math.round(webp.length / 1024)} KB mesmo na menor qualidade`)
    }
    return { sticker: await addExif(webp, meta) }
  }

  // estática: comportamento original da lib
  const message = await new Sticker(input, meta).toMessage() as { sticker: Buffer }
  if (message.sticker.length <= MAX_STATIC_BYTES) return message

  // imagem enorme (ex.: foto em alta resolução): reduz para 512px
  const webp = await sharp(input)
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80 })
    .toBuffer()
  logger.info(`[STICKER] estática reduzida de ${Math.round(message.sticker.length / 1024)} KB para ${Math.round(webp.length / 1024)} KB`)
  return { sticker: await addExif(webp, meta) }
}
