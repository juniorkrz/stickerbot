import axios from 'axios'
import { GCategory, GChannelInfo } from 'types/GloboProgramming'

import { externalEndpoints } from '../config'

export const channelMap: { [key: string]: string } = {
  // Internacional
  'americas': 'am',
  'globo-on': 'on',
  'portugal': 'pt',
  'africa': 'af',

  // Regionais
  'globo-brasilia': 'bsb',
  'globo-minas': 'mg',
  'globo-nordeste': 'ne',
  'rio': 'rj',
  'sao-paulo': 'sp',

  // Rede Amazônica
  'acre': 'ac',
  'amapa': 'ap',
  'amazonas': 'amz',
  'rondonia': 'ro',
  'roraima': 'rr',

  // TV Liberal
  'tv-liberal': 'lib',

  // TV Tapajós
  'tv-tapajos': 'tap',

  // TV Anhanguera
  'goias': 'go',
  'tocantins': 'to',

  // TV Centro América
  'tv-centro-america': 'ca',

  // TV Morena
  'tv-morena': 'mor',
  'corumba': 'cor',
  'ponta-pora': 'pp',

  // Inter TV RN
  'costa-branca': 'cb',
  'natal': 'nt',

  // TV Verdes Mares
  'tv-verdes-mares': 'vm',
  'tv-cariri': 'cr',

  // Rede Bahia
  'rede-bahia': 'bah',

  // Rede Clube
  'rede-clube': 'clb',

  // TV Asa Branca
  'tv-asa-branca': 'ab',

  // TV Cabo Branco
  'tv-cabo-branco': 'cbbr',

  // TV Gazeta AL
  'tv-gazeta-al': 'gz',

  // TV Grande Rio
  'tv-grande-rio': 'gr',

  // TV Mirante
  'tv-mirante': 'mir',

  // TV Paraíba
  'tv-paraiba': 'pb',

  // TV Sergipe
  'tv-sergipe': 'se',

  // EPTV
  'campinas-e-regiao': 'cp',
  'ribeirao-preto-e-franca': 'rp',
  'sul-de-minas': 'sm',
  'sao-carlos-e-regiao': 'sc',

  // TV TEM
  'bauru': 'ba',
  'itapetininga': 'it',
  'sorocaba-e-regiao': 'so',
  'sao-jose-do-rio-preto': 'sjrp',

  // Inter TV MG
  'inter-tv-mg': 'mgit',

  // Inter TV RJ
  'inter-tv-rj': 'rjit',

  // TV Diário
  'tv-diario': 'di',

  // TV Fronteira
  'tv-fronteira': 'fr',

  // TV Gazeta ES
  'tv-gazeta-es': 'gzes',

  // TV Integração
  'tv-integracao': 'intg',
  'araxa': 'ax',
  'ituiutaba': 'itb',
  'juiz-de-fora': 'jf',
  'uberaba': 'ub',

  // TV Rio Sul
  'tv-rio-sul': 'rs',

  // TV Tribuna
  'tv-tribuna': 'tb',

  // TV Vanguarda
  'tv-vanguarda': 'vg',

  // NSC TV
  'nsc-tv': 'nsc',

  // RBS TV
  'rbs-tv': 'rbs',

  // RPC
  'rpc': 'rpc',
}

export const getChannelCodeBySimpleCode = (simpleCode: string) => {
  const entry = Object.entries(channelMap).find(([, val]) => val === simpleCode)
  return entry ? entry[0] : undefined
}

export const getChannels = async () => {
  const response = await axios.get(`${externalEndpoints.globoProgamming}/channels`)
  if (response.data.status) {
    return response.data.result as GCategory[]
  }
}

export const getChannelPrograms = async (channelCode: string) => {
  const response = await axios.get(`
    ${externalEndpoints.globoProgamming}/channelPrograms/${encodeURIComponent(channelCode)}
    `)
  if (response.data.status) {
    return response.data.result as GChannelInfo
  }
}
