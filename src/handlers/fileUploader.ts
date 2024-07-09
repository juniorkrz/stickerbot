import axios from 'axios'

import { externalEndpoints } from '../config'
import { getLogger } from './logger'

const logger = getLogger()

export const uploadFile = async (fileBuffer: Buffer, filename: string) => {
  try {
    const response = await axios.post(`${externalEndpoints.fileUploader}/upload`, fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
    /* logger.info(`File uploaded successfully: ${response.data.file_id}.${response.data.file_format}`) */
    return response.data
  } catch (error) {
    logger.error(`Error uploading file: ${error}`)
    throw error
  }
}

export const deleteUploadedFile = async (fileId: string): Promise<void> => {
  try {
    await axios.delete(`${externalEndpoints.fileUploader}/delete/${fileId}`)
    /* logger.info('File deleted!') */
  } catch (error) {
    logger.error(`Error deleting file with ID ${fileId}: ${error}`)
  }
}
