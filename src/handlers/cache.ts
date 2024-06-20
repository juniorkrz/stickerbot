import NodeCache from 'node-cache'

const cache = new NodeCache()

export const getCache = () => {
  return cache
}
