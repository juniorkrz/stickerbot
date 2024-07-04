import axios from 'axios'
import FormData from 'form-data'

import { externalEndpoints } from '../config'
import { getLogger } from './logger'

const logger = getLogger()

export async function addCaptionOnImage(imageBuffer: Buffer, mimeType: string, phrases: string[]) {
  try {
    const formData = new FormData()
    // Append text fields
    if (phrases.length === 1) {
      formData.append('bottomText', phrases[0])
    } else if (phrases.length === 2) {
      formData.append('topText', phrases[0])
      formData.append('bottomText', phrases[1])
    } else {
      return imageBuffer
    }
    // Directly append the buffer to the form data
    formData.append('file', imageBuffer, {
      filename: 'image.png', // Provide a filename and MIME type
      contentType: mimeType,
    })

    const response = await axios.post(`${externalEndpoints.memeCaption}/addCaption`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      responseType: 'arraybuffer'
    })

    return response.data
  } catch (error: unknown) {
    if (error instanceof Error) {
      logger.error(`Error adding caption on image: ${error.message}`)
    } else {
      logger.error('Error adding caption on image: An unexpected error occurred')
    }
  }
}
