# Copa 2026 — design.md

## Intent
Comandos de WhatsApp para acompanhar a Copa do Mundo 2026: listar jogos, ver os próximos / o atual, com **bandeiras**, **horários** (TZ Brasília) e **placar ao vivo**. Mais um comando **`palpite`** (bot chuta o placar). Esses comandos **acionam o contador de anúncios** do bot (hoje só disparado por figurinhas).

## Decisões travadas (quiz)
1. **Fixtures**: dataset **estático** mantido no repo (fase de grupos; mata-mata = TBD). Você revisa a precisão.
2. **Placar**: **musa-soccer/Terra (keyless, AO VIVO)** como primário (`idChampionship=1451`, mesma API do `brasileirao.ts`) + **football-data.org opcional** como fallback (só se key configurada; o free é atrasado). Cache agressivo. **Sem API key obrigatória.**
3. **Ads**: **contador unificado, comandos em geral disparam ads** (não só figurinhas). Gatilho central no **`checkCommand`** — dispara só quando o comando é legítimo (ver "Gatilho de ads"), com **opt-out** (`skipAds`) só pros casos funcionais. Figurinha + comando contam no mesmo "1 a cada N", respeitando o `adsSystem` global e o cooldown por chat.
4. **Estrutura**: um comando **`!copa`** com subcomandos + atalhos curtos.

## Arquitetura & componentes

```
src/
├─ data/copa2026.ts          # dataset estático: TEAMS (nome, code, 🏳 flag), MATCHES (fixture), FIFA_RANKING
├─ handlers/copa.ts          # lógica: getMatches(), getScores() (API+cache+fallback), buildPalpite(), formatters
└─ commands/copa.ts          # comando !copa + subcomandos (jogos/proximos/proximo/palpite)
```

### Dados estáticos (`src/data/copa2026.ts`)
- `TEAMS`: `{ code: 'BRA', name: 'Brasil', flag: '🇧🇷' }` para as 48 seleções + placeholders (host 🇺🇸🇨🇦🇲🇽). Mapa code→emoji de bandeira.
- `MATCHES`: array de `Match` com kickoff **ISO/UTC** (renderizado pra BRT na hora), grupo/fase, sede. Mata-mata com `home/away` = `TBD` até os grupos fecharem.
- `FIFA_RANKING`: mapa code→pontos/posição (base do `palpite`). Público e ~estático durante o torneio.

### Tipos (contratos)
```ts
type Status = 'scheduled' | 'live' | 'finished'
interface Team { code: string; name: string; flag: string }
interface Match {
  id: string
  stage: string            // 'Grupo A' | 'Oitavas' | ...
  home: string; away: string   // codes; 'TBD' permitido
  kickoff: string          // ISO UTC
  venue: string
}
interface MatchScore { status: Status; home: number | null; away: number | null }
```

### Serviço de placar (`handlers/copa.ts`) — keyless primário + cache + fallback
- **Primário (keyless, ao vivo)**: musa-soccer/Terra — `GET https://p1.trrsf.com/api/musa-soccer/ms-standings-games-light?idChampionship=1451&idPhase=<fase>&language=pt-BR&country=BR&nav=N&timezone=BR`. `idPhase`: grupos=6770, 16-avos=6771, oitavas=6772, quartas=6773, semi=6774, 3º/4º=6775. Mesmo padrão do `brasileirao.ts` (axios + User-Agent; parse). Já vem em **TZ-BR** com placar+status. Mapeia para `MatchScore` por jogo.
- **Fallback opcional**: football-data.org `GET /v4/competitions/WC/matches` (header `X-Auth-Token`) — **só se `COPA_FOOTBALL_DATA_KEY` estiver setada**; estruturado, mas free é **atrasado (não ao vivo)** e 10 req/min. Usado só se o primário falhar.
- **Cache em memória** (`Map`), TTL por status: `live` ~45s, `finished` ~6h, `scheduled` ~30min. Chave por fase/dia. Evita requisições repetidas.
- **Nunca quebra**: `try/catch` + timeout; se as fontes falharem, mostra fixture + horário com "placar indisponível". O placar é enriquecimento, não bloqueio.

### Comando (`commands/copa.ts`)
- `aliases: ['copa', 'mundial', 'worldcup']` + parsing de subcomando (padrão `lista.ts`):
  - `!copa` / `!copa jogos` / `!jogos` → todos os jogos (paginado/resumido por dia).
  - `!copa proximos` / `!proximos` → jogos de agora pra frente (live + scheduled futuros).
  - `!copa proximo` / `!proximo` → o jogo ao vivo (se houver) + o próximo agendado.
  - `!copa palpite [time]` / `!palpite` → palpite do placar do jogo atual/próximo (ou de um jogo informado).
- `runInPrivate: true`, `runInGroups: true`, público (sem `onlyAdmin`). `interval` p/ cooldown. Dispara ads pelo mecanismo global (não precisa de flag — opt-out é a exceção).
- Atalhos curtos (`!jogos` etc.): aliases no mesmo arquivo OU mini-arquivos que delegam — decido no impact (preferência: aliases no `copa.ts` interpretando o alias usado).

### Palpite (`buildPalpite`)
"Baseado em algo real" = **ranking FIFA**: gap de ranking → gols esperados (heurística simples, ex. favorito ~1.3–2.4, azarão ~0.4–1.2) + bônus de mando/sede, **seed determinística por confronto** (mesmo jogo → mesmo palpite, não aleatório a cada chamada) + frase com spintax. (Odds via API = possível fase 2.)

### Gatilho de ads (o ponto que toca o sistema existente) — hook no `checkCommand`, opt-out por exceção
**Política:** comandos **em geral** disparam ads, não só figurinhas. Mas disparar no **dispatcher** após `command.run` é **inseguro** (a verificação adversarial reprovou): `checkCommand` roda *dentro* do `run`, então comando **negado/rate-limited** retornaria `undefined` e o dispatcher não saberia — faria comando negado **contar** (vetor de abuso). Por isso o gatilho fica **dentro do `checkCommand`**, no ponto em que ele aprova a execução.

1. `src/types/Command.ts`: adicionar campo opcional `skipAds?: boolean` em `StickerBotCommand` (default = conta).
2. `src/utils/commandValidator.ts` (`checkCommand`): no ramo em que **vai retornar `true`** (comando legítimo: permissão ok, sem rate-limit, sem manutenção, escopo certo), disparar:
   ```ts
   if (jid && !command.skipAds) void maybeSendAd(jid)
   ```
   `maybeSendAd` (de `handlers/ads.ts`) já incrementa o contador, respeita lock/cooldown/`adsSystem` e **nunca lança** (fire-and-forget `void`). Como só roda quando `checkCommand` aprova, **comando negado não conta** (sem vetor de abuso) e não precisa tocar o dispatcher nem 60 comandos.
3. **Opt-out (`skipAds: true`)** — só o funcionalmente necessário (mantém amplo):
   - **Os 10 comandos de figurinha** (`attp, ttp, text, emojimix, giphy, tenor, ly, rename, rembg, trends`) — já chamam `maybeSendAd` via `makeSticker` (`sticker.ts:120`); sem opt-out, contariam 2×.
   - **`ads`** (gestão de anúncios) — evita anunciar enquanto se administra anúncios.
   - Todo o resto conta (incl. `copa`, `!todos`, moderação, info...).
4. **Stickers continuam disparando** via `sticker.ts` (inalterado): caminhos automáticos (mídia → `makeSticker`) não passam pelo `checkCommand`, então contam 1× via `sticker.ts`; comandos de figurinha contam 1× (opt-out no hook + `makeSticker`).
5. Import cycle `commandValidator → ads → bot → text → commandValidator` é **lazy** (uso em runtime), igual ao já existente `bot → sticker → ads → bot`. Validar no build.

## Concerns do `rule-project-core`
- **Concorrência**: `maybeSendAd` é fire-and-forget (`void`) e já tem reserva síncrona + lock (da feature de ads) — seguro chamar do `checkCommand`.
- **Rede**: toda chamada externa com `try/catch` + timeout + cache + fallback; falha de API nunca quebra o comando.
- **Sem segredo commitado**: API key **não é obrigatória** (primário keyless); `COPA_FOOTBALL_DATA_KEY` (fallback opcional) só via env; `.env.example` documenta.
- **Permissão**: `!copa` é público; o hook de ads roda só quando `checkCommand` aprova, respeitando a permissão de cada comando.
- **DB**: **não há mudança de schema** — fixtures estáticos + cache em memória. Logo, sem `ensureColumn`/tabela nova.

## Dependências
- Depende da feature de **ads** (`handlers/ads.ts` → `maybeSendAd`) e da interface `StickerBotCommand`. Branch de implementação sai de `feat/ads` (PR #78) ou de `main` após o merge de #78.
- Sem dependência de DB novo (a PR #77 já está na main).

## Testing strategy
- Manual: rodar `!copa`/`!proximo`/`!palpite` e verificar formatação/horário/placar; confirmar que o contador de ads dispara (log `[ADS]`).
- Type-check confiável = `npm run build` (tsc) no build Docker.
- API: testar com cache quente; simular falha (key inválida) pra validar fallback + "placar indisponível".

## Open questions / notas (resolvidas no impact)
- ✅ **Placar**: musa-soccer/Terra `idChampionship=1451` (keyless, ao vivo) primário; football-data.org `WC` opcional como fallback (free é atrasado). — resolvido.
- ✅ **Mecanismo de ads**: hook no `checkCommand` (não no dispatcher) — resolvido após verificação adversarial.
- **everyone.ts (`!todos`)**: ordem dos params `isVip`/`isBotAdmin` no `run` trocada vs `CommandRunFunction` — **débito técnico pré-existente**, registrado no `impact.md`, **não corrigir** nesta feature.
- **Mata-mata (TBD)**: mostrar como "1º Grupo A × 2º Grupo B" até os grupos fecharem (confirmado).
- **Precisão do fixture estático**: você revisa as datas/horários/sedes que eu montar.
