/* https://github.com/victorsouzaleal/brasileirao/blob/main/src/scrapper.js */

export interface TimeBrasileirao {
  nome: string;
  escudo: string;
  posicao: string;
  pontos: string;
  jogos: string;
  vitorias: string;
  empates: string;
  derrotas: string;
  gols_pro: string;
  gols_contra: string;
  saldo_gols: string;
  aproveitamento: string;
}

export interface PartidaBrasileirao {
  partida: string;
  data: string;
  local: string;
  time_casa: string;
  time_fora: string;
  gols_casa: string | null;
  gols_fora: string | null;
  resultado_texto: string;
}

export interface RodadaBrasileirao {
  rodada: string;
  inicio: string;
  rodada_atual: boolean;
  partidas: PartidaBrasileirao[];
}

export interface ResultadoBrasileirao {
  tabela: TimeBrasileirao[];
  rodadas?: RodadaBrasileirao[];
}
