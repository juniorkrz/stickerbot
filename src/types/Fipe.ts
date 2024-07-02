export interface FipeResponse {
  detalhes: {
    marca: string
    tipo_veiculo: string
    generico: string
    modelo: string
    ano: number
    ano_modelo: number
    cor: string
    cilindrada: string
    potencia: string
    combustivel: string
    chassi: string
    motor: string
    passageiros: string
    municipio: string
    importado: boolean
    uf: string
  }
  orgao_emissor: string
  tabela_fipe: {
    descricao: string
    valores: {modelo: string, valor: string }[]
    valores_ipva?: { [key: string]: { valor_venal: string, taxa: string, valor_ipva: string } }
  }
  veiculos_registrados: number | null
}
