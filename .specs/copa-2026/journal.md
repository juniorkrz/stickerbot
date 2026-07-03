# Copa 2026 — journal.md (Fase 2 — Implement)

Diário vivo: desvios, erros+soluções, pedidos extras. Plano aprovado nos 3 gates.

## Setup
- Implementação no working tree de `junior/dev/anuncios` (já tem o código de ads/db do WIP). Branch/PR `feat/copa-2026` (stacked em `feat/ads`) montado no final, padrão da sessão.
- Decisões travadas: fixture estático (eu monto, user revisa); placar musa-soccer/Terra `idChampionship=1451` keyless ao vivo (football-data opcional); ads via hook no `checkCommand` (opt-out só funcional: 10 figurinha + `ads`); `!copa` + subcomandos + atalhos.

## Log de tasks
- (A) Dados estáticos — ✅ FEITO. Puxei o feed real da musa-soccer (id 1451, grupos 6770 + mata-mata 6771-6776) via Invoke-WebRequest (UA de browser; keyless 200 OK). Agente extraiu p/ `src/data/copa2026.ts`: **104 jogos** (72 grupos + 32 mata-mata TBD), **48 seleções** (code→nome→bandeira), `FIFA_RANKING`. Só agenda (placar é live). `tsc --strict` limpo. Spot-check ok vs o HTML. CHECKPOINT de precisão com o user (A2 ⚠️).
  - Caveats: FIFA_RANKING parte é aproximado (afeta só o palpite); ING/SCO usam bandeira de subdivisão (🏴 England/Scotland).
- (B/C/D/E) `handlers/copa.ts` + `commands/copa.ts` — ✅ FEITO. Placar ao vivo musa-soccer por fase (parse JSDOM, UA de browser, timeout 12s, nunca lança) + cache por fase; status por janela de horário (scheduled/live/finished); render (todos por dia / próximos / atual+próximo); `buildPalpite` (ranking FIFA + bônus de sede, seed determinística + spintax); `findMatchByQuery` (palpite por seleção pedida). Comando `!copa` + subcomandos + atalhos `!jogos/!proximos/!proximo/!palpite`. `tsc --noEmit` limpo nos arquivos novos (únicos erros = `wa-sticker-formatter` não instalado localmente, ambiente — some no Docker).
- CHECKPOINT antes da (F) ⚠️ core (hook ads no checkCommand). — aprovado.
- (F) ⚠️ Gatilho de ads no core — ✅ FEITO. `skipAds?: boolean` em `types/Command.ts`; hook `if (jid && !command.skipAds) void maybeSendAd(jid)` logo antes do `return true` final do `checkCommand` (único success path; todos os outros retornam false → comando negado/rate-limited NÃO conta). Import de `../handlers/ads` (ciclo lazy, igual `sticker.ts`). `skipAds: true` nos 10 de figurinha (attp, ttp, text, emojimix, giphy, tenor, ly, rename, rembg, trends — confirmados por grep `makeSticker`) + `ads`. As chamadas de `makeSticker` em `bot.ts` (mídia automática) não passam pelo checkCommand → contam 1×. `tsc --noEmit`: 0 erros (fora `wa-sticker-formatter` ambiental).
- (G) Config/env do fallback — DEFERIDA junto com o football-data (sem key no v1).
- (H) Verificação + deploy — ✅ FEITO. pscp dos 16 arquivos (backup do `src/` em `/root/copa_backup_*`; criado `src/data/`); LF normalizado; `docker compose build` (tsc limpo no Docker, ciclo de import compilou); `up -d` → RestartCount 0, `[COMMANDS] 65 loaded` (+1 copa), `[WA] ready`, zero erro. Verificação end-to-end via handler compilado no container: `renderCurrent` pegou jogo AO VIVO (Argentina 1x0 Argélia, placar real da musa-soccer), `renderNext` (bandeiras+BRT por dia), `palpite` (ARG 3x0 AGL determinístico). Script de check removido (container + /root).
- Nit de dados: `TEAMS.AST.name` = "Austria" (sem acento) → idealmente "Áustria"; cosmético, batch num próximo deploy.
- Falta (opcional): commit + PR stacked `feat/copa-2026`; Fase 3 (Reflect).

## Desvios / erros / pedidos extras
- **football-data.org fallback (B3) DEFERIDO.** Casar a fonte secundária (nomes em inglês) com o dataset (códigos da Terra) exigiria um mapa de 48 nomes e é frágil; o primário musa-soccer é keyless + ao vivo. Em falha de rede, degrada pra "agenda sem placar" (cache velho/vazio), nunca quebra. ⇒ config `copaFootballDataKey` (G1) + `.env.example` (G2) ficam moot no v1. Reativável depois se você quiser.
- **Mata-mata sem overlay ao vivo (v1).** Jogos de mata-mata ficam com times TBD (do estático); o placar ao vivo só sobrepõe a fase de grupos (casado por home+away+data). Popular times/placar do mata-mata exigiria overlay por data (follow-up). v1 cobre a fase atual (grupos) por completo.
- **Cache TTL único 60s** (em vez de por-status 45s/6h/30min do B4) — mais simples e suficiente; refinável.

## Débito técnico a registrar (não corrigir aqui)
- `everyone.ts`: params `isVip`/`isBotAdmin` trocados no `run`.
- Semântica do `stickerCounter`/log `[ADS]`/texto do `!ads` fica imprecisa com comandos contando.
