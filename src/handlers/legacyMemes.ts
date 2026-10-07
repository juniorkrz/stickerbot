import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { promisify } from 'util'

import { getTempFilePath } from '../utils/misc'

// Recursos portados do StickerBot legado (py-stickerbot): ttp temático, ndz e gdz

const execFileAsync = promisify(execFile)

// src/assets/legacy (funciona tanto em src/ com tsx quanto em dist/ compilado)
const assetsDir = path.resolve(__dirname, '../../src/assets/legacy')
const asset = (file: string) => path.join(assetsDir, file)

GlobalFonts.registerFromPath(asset('GROBOLD.ttf'), 'GROBOLD')
GlobalFonts.registerFromPath(asset('DollieScript.ttf'), 'DollieScript')

type RGB = string

export type TtpTheme = {
  background: string
  font: string
  // desenha a "sombra" (texto maior deslocado) quando há poucas linhas
  shadowMaxLines: number
  shadowOffset: [number, number]
  shadowColor: RGB
  strokeColor: RGB
  // caracteres que a fonte não tem e devem perder o acento
  stripAccents?: RegExp
}

export const ttpThemes: Record<'ben10' | 'barbieBlue' | 'barbiePink', TtpTheme> = {
  ben10: {
    background: 'background-ben10.png',
    font: 'GROBOLD',
    shadowMaxLines: 1,
    shadowOffset: [6, 9],
    shadowColor: '#000000',
    strokeColor: '#000000',
    // mesma lista do legado: a GROBOLD não tem esses acentos (mas tem é, ê, â, ç...)
    stripAccents: /[áãíìóòõöúüñÁÃÄÍÌÓÒÕÖÚÑ]/g
  },
  barbieBlue: {
    background: 'background-barbie-blue-sky.png',
    font: 'DollieScript',
    shadowMaxLines: 2,
    shadowOffset: [0, 9],
    shadowColor: '#e0228c',
    strokeColor: '#e0228c'
  },
  barbiePink: {
    background: 'background-barbie-pink-sky.png',
    font: 'DollieScript',
    shadowMaxLines: 2,
    shadowOffset: [0, 9],
    shadowColor: '#e0228c',
    strokeColor: '#e0228c'
  }
}

// Quebra o texto em linhas de até 10 caracteres (20 se tiver mais de 10 palavras)
const splitText = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean)
  const limit = words.length > 10 ? 20 : 10
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line && line.length + word.length > limit) {
      lines.push(line.trim())
      line = ''
    }
    line += word + ' '
  }
  if (line.trim()) lines.push(line.trim())
  return lines
}

/**
 * Gera a imagem 512x512 (PNG) de um ttp temático, no mesmo algoritmo do legado.
 * @param {string} text O texto da figurinha.
 * @param {TtpTheme} theme O tema (fundo, fonte e cores).
 * @returns {Promise<Buffer>} A imagem em PNG.
 */
export const renderThemedTtp = async (text: string, theme: TtpTheme): Promise<Buffer> => {
  const SIZE = 512
  const MAX_LINES = 4
  const MARGIN = 50

  if (theme.stripAccents) {
    text = text.replace(theme.stripAccents, (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, ''))
  }

  const lines = splitText(text)
  const background = await loadImage(asset(theme.background))
  const shadow = lines.length <= theme.shadowMaxLines

  let fontSize = shadow ? 160 : 100
  if (lines.length > MAX_LINES) fontSize = Math.floor(fontSize * (MAX_LINES / lines.length))

  const canvas = createCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  const font = (px: number) => `${Math.max(px, 1)}px ${theme.font}`
  const measure = (line: string) => {
    const m = ctx.measureText(line)
    return {
      width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
    }
  }

  // diminui a fonte até o bloco de texto caber na figurinha
  for (let i = 0; ; i++) {
    const lineHeight = fontSize - i * 1.2
    const totalHeight = lineHeight * (lines.length - 1)
    const x = SIZE / 2
    let y = x - totalHeight / 2
    let currentTotalHeight = 0

    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.drawImage(background, 0, 0, SIZE, SIZE)

    let textSize = fontSize - i - 5
    let shadowSize = fontSize - i

    for (const line of lines) {
      ctx.font = font(textSize)
      let { width, height } = measure(line)
      let lineFontSize = fontSize - i
      // se a linha não couber, reduz a fonte (e ela segue menor nas próximas linhas, como no legado)
      while ((width > SIZE - MARGIN || height > SIZE - MARGIN) && lineFontSize > 6) {
        lineFontSize--
        textSize = lineFontSize - 5
        shadowSize = lineFontSize
        ctx.font = font(textSize)
        ;({ width, height } = measure(line))
      }

      if (shadow) {
        ctx.font = font(shadowSize)
        ctx.lineWidth = 8
        ctx.strokeStyle = theme.shadowColor
        ctx.fillStyle = theme.shadowColor
        ctx.strokeText(line, x + theme.shadowOffset[0], y + theme.shadowOffset[1])
        ctx.fillText(line, x + theme.shadowOffset[0], y + theme.shadowOffset[1])
      }

      ctx.font = font(textSize)
      ctx.lineWidth = shadow ? 12 : 8
      ctx.strokeStyle = theme.strokeColor
      ctx.fillStyle = '#ffffff'
      ctx.strokeText(line, x, y)
      ctx.fillText(line, x, y)

      y += lineHeight
      currentTotalHeight += height
    }

    if (currentTotalHeight <= SIZE || fontSize - i <= 10) break
  }

  return canvas.toBuffer('image/png')
}

/**
 * Coloca a imagem no "Negão do Zap" (a imagem ocupa o meio da montagem; a prévia do
 * WhatsApp mostra só o meio e o resto aparece ao abrir).
 * @param {Buffer} image A imagem enviada pelo usuário.
 * @returns {Promise<Buffer>} A montagem em PNG.
 */
export const makeNdz = async (image: Buffer): Promise<Buffer> => {
  const foreground = await sharp(image, { animated: false })
    .resize(319, 448, { fit: 'fill' })
    .png()
    .toBuffer()

  return await sharp(asset('ndz.png'))
    .composite([{ input: foreground,
      left: 0,
      top: 234 }])
    .png()
    .toBuffer()
}

export const gdzConfig = {
  originalAudioVolume: 0.1, // volume do áudio original antes do gemidão
  originalAudioTime: 3, // segundos de áudio original antes do gemidão
  watermarkTime: 4, // a marca d'água aparece a partir desse segundo (duração mínima do vídeo)
  maxVideoTime: 10 // o vídeo é cortado nesse tempo
}

const probeVideo = async (file: string) => {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', file
  ])
  const info = JSON.parse(stdout)
  return {
    duration: Number(info.format?.duration) || 0,
    hasAudio: (info.streams || []).some((s: { codec_type?: string }) => s.codec_type === 'audio')
  }
}

/**
 * Coloca o gemidão do zap no vídeo: 3s do áudio original baixinho, depois o gemidão,
 * e a marca d'água do bot no centro a partir dos 4s.
 * @param {Buffer} video O vídeo enviado pelo usuário.
 * @returns {Promise<Buffer>} O vídeo resultante em MP4.
 */
export const makeGdz = async (video: Buffer): Promise<Buffer> => {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const input = getTempFilePath(`gdz_${id}_in.mp4`)
  const output = getTempFilePath(`gdz_${id}_out.mp4`)
  const { originalAudioVolume, originalAudioTime, watermarkTime, maxVideoTime } = gdzConfig

  await fs.promises.writeFile(input, video)
  try {
    const { duration, hasAudio: withAudio } = await probeVideo(input)
    // o -shortest não é confiável com filter_complex (ffmpeg 5.x): limita a saída pela duração do vídeo
    const outputTime = duration > 0 ? Math.min(duration, maxVideoTime) : maxVideoTime

    // [0] vídeo, [1] gemidão, [2] marca d'água, [3] silêncio (se o vídeo não tiver áudio)
    const args = ['-y', '-t', `${maxVideoTime}`, '-i', input, '-i', asset('gdz.mp3'), '-i', asset('watermark.png')]
    if (!withAudio) args.push('-f', 'lavfi', '-t', `${originalAudioTime}`, '-i', 'anullsrc=r=44100:cl=stereo')

    const intro = withAudio
      ? `[0:a]atrim=0:${originalAudioTime},asetpts=PTS-STARTPTS,volume=${originalAudioVolume},` +
        'aformat=sample_rates=44100:channel_layouts=stereo[intro]'
      : '[3:a]aformat=sample_rates=44100:channel_layouts=stereo[intro]'

    const filter = [
      intro,
      '[1:a]aformat=sample_rates=44100:channel_layouts=stereo[gdz]',
      '[intro][gdz]concat=n=2:v=0:a=1[a]',
      // marca d'água no máximo 90% da largura do vídeo
      '[2:v][0:v]scale2ref=w=\'min(iw,main_w*0.9)\':h=\'ow/mdar\'[wm][base]',
      `[base][wm]overlay=(W-w)/2:(H-h)/2:enable='gte(t,${watermarkTime})',` +
        'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[v]'
    ].join(';')

    args.push(
      '-filter_complex', filter,
      '-map', '[v]', '-map', '[a]',
      '-t', outputTime.toFixed(3),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      output
    )

    await execFileAsync('ffmpeg', args, { timeout: 120_000 })
    return await fs.promises.readFile(output)
  } finally {
    await fs.promises.rm(input, { force: true })
    await fs.promises.rm(output, { force: true })
  }
}
