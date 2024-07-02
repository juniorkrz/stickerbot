import axios from 'axios'
import { FipeResponse } from 'types/Fipe'

import { externalEndpoints } from '../config'

const states: { [uf: string]: string } = {
  'AC': 'ACRE',
  'AL': 'ALAGOAS',
  'AP': 'AMAPÁ',
  'AM': 'AMAZONAS',
  'BA': 'BAHIA',
  'CE': 'CEARÁ',
  'DF': 'DISTRITO FEDERAL',
  'ES': 'ESPÍRITO SANTO',
  'GO': 'GOIÁS',
  'MA': 'MARANHÃO',
  'MT': 'MATO GROSSO',
  'MS': 'MATO GROSSO DO SUL',
  'MG': 'MINAS GERAIS',
  'PA': 'PARÁ',
  'PB': 'PARAÍBA',
  'PR': 'PARANÁ',
  'PE': 'PERNAMBUCO',
  'PI': 'PIAUÍ',
  'RJ': 'RIO DE JANEIRO',
  'RN': 'RIO GRANDE DO NORTE',
  'RS': 'RIO GRANDE DO SUL',
  'RO': 'RONDÔNIA',
  'RR': 'RORAIMA',
  'SC': 'SANTA CATARINA',
  'SP': 'SÃO PAULO',
  'SE': 'SERGIPE',
  'TO': 'TOCANTINS'
}

export const sanitizeInput = (inputText: string) => {
  const pattern = /[^a-zA-Z0-9]/g
  return inputText.replace(pattern, '')
}

export const fipeQuery = async (licensePlate: string) => {
  const response = await axios.get(`${externalEndpoints.placaFipe}/consulta/${encodeURIComponent(licensePlate)}`)
  if (response.data.status) {
    return response.data.result as FipeResponse
  }
}

export const isMercosul = (licensePlate: string) => {
  return licensePlate.charAt(4).match(/[a-zA-Z]/) || licensePlate.charAt(5).match(/[a-zA-Z]/)
}

export const getStateNameByUf = (uf: string) => {
  const state = states[uf.toUpperCase()]
  return state ? state : false
}

export const convertLicensePlate = (licensePlate: string) => {
  const p = licensePlate.toLowerCase()
  const ascii_lowercase = 'abcdefghijklmnopqrstuvwxyz'

  if (isMercosul(p)) {
    return `${licensePlate.slice(0, -3)}${ascii_lowercase.indexOf(p[4])}${licensePlate.slice(-2)}`.toUpperCase()
  } else {
    return `${licensePlate.slice(0, -3)}${ascii_lowercase[parseInt(p[4])]}${licensePlate.slice(-2)}`.toUpperCase()
  }
}
