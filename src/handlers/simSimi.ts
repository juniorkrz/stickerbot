import axios from 'axios'
import FormData from 'form-data'

import { getLogger } from './logger'

const logger = getLogger()

export const getSimSimiResponse = async (query: string): Promise<string | undefined> => {
  const data = new FormData()
  data.append('lc', 'pt')
  data.append('key', '')
  data.append('text', query)

  const config = {
    method: 'post',
    url: 'https://api.simsimi.vn/v1/simtalk',
    headers: {
      ...data.getHeaders(),
    },
    data: data,
  }

  try {
    const response = await axios.request(config)

    if (response.status !== 200) {
      logger.error(`[API]: SimSimi is down! Error: ${response.statusText}`)
      return
    }

    if (
      response.data &&
      response.data.message &&
      response.data.message !== ''
    ) {
      return response.data.message
    } else {
      logger.error('[API]: No valid response message found. (SimSimi)')
      return
    }
  } catch (error) {
    logger.error(`[API]: ${error} (SimSimi)`)
    return
  }
}
