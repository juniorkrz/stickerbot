import opentype from 'opentype.js'
import path from 'path'
import sharp from 'sharp'

// Port do SadRealityGenerator da Loritta (comando +tristerealidade):
// grade 3x2 de avatares 128x128 num canvas 384x256, nome no topo (Pixolletta 10px, contorno de 1px)
// e o papel de cada um embaixo (Bebas Neue 22px, contorno de 2px), com a mesma quebra de linha e o
// mesmo cálculo de posição do java.awt. Tudo é desenhado em SCALE para a imagem não ficar borrada
// no WhatsApp (a da Loritta tem só 384x256).

const SCALE = 2
const WIDTH = 384
const HEIGHT = 256
const AVATAR = 128

const fontsDir = path.resolve(__dirname, '../../src/fonts')
const nameFont = opentype.loadSync(path.join(fontsDir, 'pixolletta-8px.ttf'))
const typeFont = opentype.loadSync(path.join(fontsDir, 'bebas-neue-regular.ttf'))

export interface SadRealityUser {
  text: string
  name?: string
  avatar?: Buffer
}

// Mesmos textos da Loritta, no caso padrão (sem gênero no perfil: "ela" e os outros homens)
export const sadRealitySlots = [
  'A MINA QUE VOCÊ GOSTA',
  'O PAI DELA',
  'IRMÃO DELA',
  'PRIMEIRO AMOR DELA',
  'MELHOR AMIGO DELA',
  'VOCÊ'
]

// Equivalente ao java.awt.FontMetrics (sun.font.FontDesignMetrics arredonda para cima com 0.95)
const metrics = (font: opentype.Font, size: number) => {
  const scale = size / font.unitsPerEm
  const hhea = font.tables.hhea
  const ascent = hhea.ascender * scale
  const descent = -hhea.descender * scale
  const leading = hhea.lineGap * scale
  const intAscent = Math.floor(ascent + 0.95)
  return {
    ascent: intAscent,
    height: intAscent + Math.floor(descent + leading + 0.95),
    stringWidth: (text: string) => Math.round(font.getAdvanceWidth(text, size, { kerning: false }))
  }
}

// Divisão inteira do Java (trunca em direção ao zero)
const idiv = (a: number, b: number) => Math.trunc(a / b)

// Tira caracteres que a fonte não tem (emojis etc.), que virariam quadradinhos
const onlySupported = (font: opentype.Font, text: string) =>
  Array.from(text).filter(c => c === ' ' || font.charToGlyphIndex(c) > 0).join('').replace(/\s+/g, ' ').trim()

const glyphPath = (font: opentype.Font, text: string, x: number, y: number, size: number) =>
  font.getPath(text, x, y, size, { kerning: false }).toPathData(2)

// Desenha o texto com contorno do mesmo jeito da Loritta: várias cópias pretas deslocadas e a branca por cima
const outlined = (d: string, stroke: number, id: string) => {
  const uses: string[] = []
  for (let dx = -stroke; dx <= stroke; dx++) {
    for (let dy = -stroke; dy <= stroke; dy++) {
      uses.push(`<use href="#${id}" x="${dx}" y="${dy}" fill="#000"/>`)
    }
  }
  return `<defs><path id="${id}" d="${d}"/></defs>${uses.join('')}<use href="#${id}" fill="#fff"/>`
}

// Quebra de linha idêntica à drawCentralizedTextOutlined da Loritta (inclusive o espaço extra no fim)
const wrapLines = (text: string, maxWidth: number, stringWidth: (s: string) => number) => {
  const lines: string[] = []
  let x = 0
  let currentLine = ''

  for (const word of text.split(' ')) {
    const newX = x + stringWidth(`${word} `)
    if (newX >= maxWidth) {
      const endResult = currentLine.trim()
      if (!endResult) {
        lines.push(word)
        x = 0
        continue
      }
      lines.push(endResult)
      currentLine = ` ${word}`
      x = stringWidth(`${word} `)
    } else {
      currentLine += ` ${word}`
      x = newX
    }
  }
  lines.push(currentLine.trim())
  return lines
}

const drawCentralizedTextOutlined = (text: string, rx: number, ry: number, rw: number, rh: number, id: string) => {
  const size = 22
  const m = metrics(typeFont, size)
  const lines = wrapLines(text, rw, m.stringWidth)
  const skipHeight = m.ascent
  let y = idiv(rh, 2) - ((skipHeight - 4) * (lines.length - 1))

  const parts: string[] = []
  lines.forEach((line, i) => {
    // ImageUtils.drawCenteredString com um retângulo de altura 24
    const x = rx + idiv(rw - m.stringWidth(line), 2)
    const baseline = ry + y + idiv(24 - m.height, 2) + m.ascent
    parts.push(outlined(glyphPath(typeFont, line, x, baseline, size), 2, `${id}l${i}`))
    y += skipHeight
  })
  return parts.join('')
}

const defaultAvatar = async () => {
  // Silhueta padrão do WhatsApp para quem não tem foto (ou esconde a foto)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${AVATAR}" height="${AVATAR}" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="#dfe5e7"/>
    <circle cx="64" cy="50" r="24" fill="#fff"/>
    <path d="M18 128c0-28 20-44 46-44s46 16 46 44z" fill="#fff"/>
  </svg>`
  return await sharp(Buffer.from(svg)).resize(AVATAR * SCALE, AVATAR * SCALE).png().toBuffer()
}

export const generateSadReality = async (users: SadRealityUser[]) => {
  if (users.length !== 6) throw new Error('A triste realidade precisa de 6 usuários')

  const composites: sharp.OverlayOptions[] = []
  const texts: string[] = []
  let fallback: Buffer | undefined

  let x = 0
  let y = 0
  for (const [i, user] of users.entries()) {
    let avatar: Buffer | undefined
    if (user.avatar) {
      avatar = await sharp(user.avatar)
        .resize(AVATAR * SCALE, AVATAR * SCALE, { fit: 'cover' })
        .png()
        .toBuffer()
        .catch(() => undefined)
    }
    if (!avatar) avatar = fallback ??= await defaultAvatar()
    composites.push({ input: avatar,
      left: x * SCALE,
      top: y * SCALE })

    // Na Loritta o avatar seguinte cobre o que passar do quadro (ex.: nome comprido), então recorta por quadro
    const name = user.name ? onlySupported(nameFont, user.name) : ''
    texts.push(`<clipPath id="c${i}"><rect x="${x}" y="${y}" width="${AVATAR}" height="${AVATAR}"/></clipPath>` +
      `<g clip-path="url(#c${i})">` +
      (name ? outlined(glyphPath(nameFont, name, x + 1, y + 10, 10), 1, `n${i}`) : '') +
      drawCentralizedTextOutlined(user.text, x, y + 80, AVATAR, 42, `t${i}`) +
      '</g>')

    x += AVATAR
    if (x > 256) {
      x = 0
      y = AVATAR
    }
  }

  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH * SCALE}" height="${HEIGHT * SCALE}">
    <g transform="scale(${SCALE})">${texts.join('')}</g>
  </svg>`
  composites.push({ input: Buffer.from(overlay),
    left: 0,
    top: 0 })

  return await sharp({
    create: { width: WIDTH * SCALE,
      height: HEIGHT * SCALE,
      channels: 4,
      background: { r: 0,
        g: 0,
        b: 0,
        alpha: 0 } }
  })
    .composite(composites)
    .png()
    .toBuffer()
}
