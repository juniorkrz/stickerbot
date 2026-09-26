# Copa 2026 — tasks.md

> **Status: IMPLEMENTED + DEPLOYED** (2026-06-16). A–F feitas e em produção (build Docker ok, verificado ao vivo); G (config do fallback football-data) DEFERIDA junto com o fallback; H concluída (deploy + verificação); I registrada no `journal.md`. Detalhes do percurso no `journal.md`, reflexão no `reflect.md`.
> ⚠️ = alto risco / requer atenção extra.
> **Base do branch:** `junior/dev/copa-2026` (working tree com ads/db/lista); PR stacked em `feat/ads`.

## A. Dados estáticos
- [ ] **A1.** `src/data/copa2026.ts`: `TEAMS` — 48 seleções `{ code, name, flag }` (emoji de bandeira), + placeholder `TBD`.
- [ ] **A2.** ⚠️ `MATCHES` — fixture da **fase de grupos** (kickoff em ISO/UTC, `stage`, `home`/`away` por code, `venue`). Mata-mata como entradas `TBD` ("1º Grupo A × 2º Grupo B"). *Precisão revisada pelo usuário.*
- [ ] **A3.** `FIFA_RANKING` — mapa `code → posição/pontos` (base do palpite).

## B. Serviço de placar + cache (`src/handlers/copa.ts`)
- [ ] **B1.** Tipos: `Status`, `Team`, `Match`, `MatchScore`.
- [ ] **B2.** ⚠️ `fetchScoresMusa(phase)` — GET musa-soccer `idChampionship=1451&idPhase=<fase>&timezone=BR` (axios + User-Agent, padrão `brasileirao.ts`); parse → `Map<matchKey, MatchScore>`. `try/catch` + timeout; nunca lança.
- [ ] **B3.** `fetchScoresFootballData()` — fallback **opcional** (só se `copaFootballDataKey`): GET `/v4/competitions/WC/matches` header `X-Auth-Token`. Usado só se B2 falhar.
- [ ] **B4.** ⚠️ Cache em memória (`Map` + timestamp), TTL por status (`live` ~45s / `finished` ~6h / `scheduled` ~30min). `getScores()` orquestra cache → B2 → B3.
- [ ] **B5.** `getMatches()` — funde `MATCHES` estáticos + placares do `getScores()` + status derivado (kickoff/relógio + presença de placar).

## C. Apresentação (`src/handlers/copa.ts`)
- [ ] **C1.** `formatMatch(match, score)` — `🇧🇷 Brasil x 🇦🇷 Argentina`, horário em **BRT** (`toLocaleString('pt-BR', …)`), indicador de status (🔴 ao vivo / ✅ encerrado / 🕒 agendado) + placar quando houver.
- [ ] **C2.** `renderAll()` (resumido por dia), `renderNext()` (live + agendados futuros), `renderCurrent()` (ao vivo + próximo).

## D. Palpite
- [ ] **D1.** `buildPalpite(match)` — heurística por `FIFA_RANKING` (gap → gols esperados; bônus mando/sede), **seed determinística por confronto** (mesmo jogo → mesmo palpite), frase com `spintax`. Lida com `TBD` (sem palpite).

## E. Comando (`src/commands/copa.ts`)
- [ ] **E1.** `command` `StickerBotCommand`: `aliases: ['copa','mundial','worldcup','jogos','proximos','proximo','palpite']`, público (`runInPrivate/Groups: true`), `interval` p/ cooldown, `checkCommand` no início.
- [ ] **E2.** Roteamento: se `alias` for atalho (`jogos`/`proximos`/`proximo`/`palpite`) → subcomando direto; senão parse `argText` (padrão `lista.ts`). Despacha pra `renderAll/Next/Current/buildPalpite`.
- [ ] **E3.** Respostas via `sendMessage`/`react`; `try/catch` interno; "placar indisponível" no fallback de erro. (Sem `skipAds` → conta pra ads.)

## F. Gatilho de ads por comando (toca o core) ⚠️
- [ ] **F1.** `src/types/Command.ts`: `+ skipAds?: boolean` em `StickerBotCommand`.
- [ ] **F2.** ⚠️ `src/utils/commandValidator.ts`: no ramo em que `checkCommand` **retorna `true`**, `if (jid && !command.skipAds) void maybeSendAd(jid)` (import de `../handlers/ads`). Confirmar que é o único ponto de retorno-true.
- [ ] **F3.** ⚠️ `skipAds: true` nos 10 de figurinha (`attp, ttp, text, emojimix, giphy, tenor, ly, rename, rembg, trends`) — evita contar 2× (já contam via `makeSticker`).
- [ ] **F4.** `skipAds: true` em `commands/ads.ts`.
- [ ] **F5.** Build/verificar o **import cycle** `commandValidator → ads → bot → text → commandValidator` (lazy; tsc no Docker).

## G. Config / env
- [ ] **G1.** `src/config.ts`: `+ copaFootballDataKey: process.env.COPA_FOOTBALL_DATA_KEY || ''` (fallback opcional).
- [ ] **G2.** `.env.example`: documentar `COPA_FOOTBALL_DATA_KEY` (opcional — primário é keyless).

## H. Verificação & deploy
- [ ] **H1.** `npm run build` (tsc) no build Docker — type-check + sem erro de init do import cycle (skill `workflow-deploy`).
- [ ] **H2.** Comportamento: `!copa`, `!proximo`, `!palpite`; confirmar que um comando **não-figurinha** dispara o contador (log `[ADS]`) e que um comando de figurinha **não** conta 2×.
- [ ] **H3.** Deploy em produção + verificar (`workflow-deploy`). Key não é necessária (primário keyless); setar `COPA_FOOTBALL_DATA_KEY` no compose só se quiser o fallback.

## I. Débito técnico (registrar no journal, NÃO corrigir aqui)
- [ ] **I1.** `everyone.ts`: params `isVip`/`isBotAdmin` trocados no `run` — anotar no `journal.md` como débito (backlog próprio).
- [ ] **I2.** Semântica do contador (`stickerCounter`, log `[ADS]`, texto do `!ads` "1 a cada N figurinhas") fica imprecisa com comandos contando — anotar; renomear/redocumentar é opcional (baixo risco), pode virar sub-task ou backlog.
