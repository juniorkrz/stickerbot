interface MunicipioUFGanhadores {
  ganhadores: number
  municipio: string
  nomeFatansiaUL: string
  posicao: number
  serie: string
  uf: string
}

interface RateioPremio {
  descricaoFaixa: string
  faixa: number
  numeroDeGanhadores: number
  valorPremio: number
}

export interface FederalResponse {
  acumulado: boolean
  dataApuracao: string
  dataProximoConcurso: string
  dezenasSorteadasOrdemSorteio: string[]
  exibirDetalhamentoPorCidade: boolean
  id: number | null
  indicadorConcursoEspecial: number
  listaDezenas: string[]
  listaDezenasSegundoSorteio: string | null
  listaMunicipioUFGanhadores: MunicipioUFGanhadores[]
  listaRateioPremio: RateioPremio[]
  listaResultadoEquipeEsportiva: string | null
  localSorteio: string
  nomeMunicipioUFSorteio: string
  nomeTimeCoracaoMesSorte: string | null
  numero: number
  numeroConcursoAnterior: number
  numeroConcursoFinal_0_5: number
  numeroConcursoProximo: number
  numeroJogo: number
  observacao: string | null
  premiacaoContingencia: string | null
  tipoJogo: string
  tipoPublicacao: number
  ultimoConcurso: boolean
  valorArrecadado: number
  valorAcumuladoConcurso_0_5: number
  valorAcumuladoConcursoEspecial: number
  valorAcumuladoProximoConcurso: number
  valorEstimadoProximoConcurso: number
  valorSaldoReservaGarantidora: number
  valorTotalPremioFaixaUm: number
}
