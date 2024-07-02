import axios from 'axios'
import FormData from 'form-data'

import { externalEndpoints } from '../config'

export const removeBackground = async (imageBuffer: Buffer) => {
  try {
    const formData = new FormData()
    formData.append('file', imageBuffer, { filename: 'input.jpg' })

    const response = await axios.post(`${externalEndpoints.rembg}/api/remove`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      responseType: 'arraybuffer'
    })

    return response.data
  } catch (error) {
    return false
  }
}
