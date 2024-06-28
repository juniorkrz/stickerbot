import { colors } from './colors'
import { getProjectHomepage, getProjectInfo, getProjectLocalVersion } from './misc'

const stickerBotArt: string = `
███████╗████████╗██╗ ██████╗██╗  ██╗███████╗██████╗ ██████╗  ██████╗ ████████╗
██╔════╝╚══██╔══╝██║██╔════╝██║ ██╔╝██╔════╝██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝
███████╗   ██║   ██║██║     █████╔╝ █████╗  ██████╔╝██████╔╝██║   ██║   ██║   
╚════██║   ██║   ██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗██╔══██╗██║   ██║   ██║   
███████║   ██║   ██║╚██████╗██║  ██╗███████╗██║  ██║██████╔╝╚██████╔╝   ██║   
╚══════╝   ╚═╝   ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝    ╚═╝   
`

const drawText = (
  text: string,
  alignment: 'left' | 'center' | 'right' = 'left',
  options: {
    padLeft?: number,
    padRight?: number,
    marginTop?: number,
    marginBottom?: number
  } = {}
) => {
  // Opções padrão
  const {
    padLeft = 0,
    padRight = 0,
    marginTop = 0,
    marginBottom = 0
  } = options

  const terminalWidth: number = process.stdout.columns
  const lines: string[] = text.split('\n')
  let alignedText: string = ''

  switch (alignment) {
  case 'center':
    lines.forEach((line, index) => {
      const padding = Math.max(0, Math.floor((terminalWidth - line.length) / 2))
      const marginRight = index === lines.length - 1 ? marginBottom : marginTop
      alignedText += `${colors.purpleLight}${' '.repeat(padLeft)}${' '.repeat(padding)}${line}` +
          `${' '.repeat(padding)}${' '.repeat(padRight)}${' '.repeat(marginRight)}${colors.reset}\n`
    })
    break
  case 'right':
    lines.forEach((line, index) => {
      const padding = Math.max(0, terminalWidth - line.length - padLeft - padRight)
      const marginRight = index === lines.length - 1 ? marginBottom : marginTop
      alignedText += `${colors.purpleLight}${' '.repeat(padLeft)}${' '.repeat(padding)}${line}` +
          `${' '.repeat(padRight)}${' '.repeat(marginRight)}${colors.reset}\n`
    })
    break
  case 'left':
  default:
    lines.forEach((line, index) => {
      const marginRight = index === lines.length - 1 ? marginBottom : marginTop
      alignedText += `${colors.purpleLight}${' '.repeat(padLeft)}${line}` +
          `${' '.repeat(padRight)}${' '.repeat(marginRight)}${colors.reset}\n`
    })
    break
  }

  // Remove extra newline at the end
  alignedText = alignedText.trimRight()

  console.log(alignedText)
}

const drawLogo = () => {
  const lines: string[] = stickerBotArt.split('\n')
  const terminalWidth: number = process.stdout.columns
  const centeredLines: string[] = lines.map(line => {
    const padding = Math.max(0, Math.floor((terminalWidth - line.length) / 2))
    return `${colors.purpleDark}${' '.repeat(padding)}${line}${colors.reset}`
  })
  console.log(centeredLines.join('\n'))
}

const drawLine = () => {
  const terminalWidth: number = process.stdout.columns
  const line: string = '━'.repeat(terminalWidth)
  console.log(`${colors.reset}${line}${colors.reset}`)
}

export const drawHeader = () => {
  const projectInfo = getProjectInfo()

  drawLine()
  drawLogo()
  drawLine()

  if(projectInfo?.description) {
    drawText(`${projectInfo.description}`, 'center')
  }

  drawText(`${getProjectHomepage()}`, 'center')
  drawText(`v${getProjectLocalVersion()}`, 'center')
  drawLine()
  drawText('Developed by Krz', 'right', { padRight: 5 })
}

