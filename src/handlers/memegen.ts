import { bot, externalEndpoints } from '../config'

export const specialCharsReplace = (text: string) => {
  return text.replaceAll('?', '~q')
    .replaceAll('&', '~a')
    .replaceAll('%', '~p')
    .replaceAll('#', '~h')
    .replaceAll('/', '~s')
    .replaceAll('\\', '~b')
    .replaceAll('<', '~l')
    .replaceAll('>', '~g')
    .replaceAll('"', "''")
    .replaceAll('-', '--')
    .replaceAll('_', '__')
    .replaceAll(' ', '_')
}

export const getCustomMemeUrl = (
  captions: string[],
  backgroundUrl: string,
  animated: boolean | undefined
) => {
  let topText = '_'
  let bottomText = '_'

  if (captions.length === 1) {
    bottomText = encodeURIComponent(specialCharsReplace(captions[0]))
  } else if (captions.length === 2) {
    topText = encodeURIComponent(specialCharsReplace(captions[0]))
    bottomText = encodeURIComponent(specialCharsReplace(captions[1]))
  }

  const url = `${externalEndpoints.memegen}` +
  '/images/custom/' +
  `${topText}/${bottomText}.` +
  `${animated ? 'webp' : 'png'}` +
  `?watermark=${bot.name}` +
  '&font=impact' +
  '&token=orgyyu0tuzir7n4ktwvc&' +
  `background=${backgroundUrl}`

  return url
}
