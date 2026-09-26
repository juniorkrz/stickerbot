# Copa 2026 — impact.md

> Baseado em discovery + verificação adversarial (workflow `copa-impact`, 6 agentes). Itens marcados ⚠️ = alto risco / mudança de rumo vs design.

## Change surface — arquivos

### Novos
- `src/data/copa2026.ts` — fixture estático, `TEAMS` (code→🏳), `FIFA_RANKING`.
- `src/handlers/copa.ts` — placar (cache + fallback), `buildPalpite()`, formatters.
- `src/commands/copa.ts` — comando `!copa` + subcomandos + atalhos. **`skipAds` não setado** (deve contar).

### Tocados (core)
- `src/types/Command.ts` — `+ skipAds?: boolean` no `StickerBotCommand` (linhas 27-44).
- `src/utils/commandValidator.ts` — **novo ponto do gatilho de ads** (ver ⚠️ abaixo). Hoje `checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)`; tem `jid` + `command`.
- `src/config.ts` — `+ copaFootballDataKey` (e `copaScoreApi` se mantivermos football-data) antes do fecho do `bot` (linha 77). Padrão `process.env.X || ''`.
- `.env.example` + `docker-compose.yml` (prod) — env da Copa (sem segredo no repo).
- **Opt-out** (`skipAds: true`) nos comandos de figurinha + `ads` (lista abaixo).

## ⚠️ MUDANÇA DE RUMO — mecanismo do gatilho de ads

O design dizia: disparar `maybeSendAd(jid)` no **dispatcher** (`text.ts`) após `command.run`. **A verificação adversarial reprovou isso:**

- **CRÍTICO — comando negado conta.** `checkCommand` roda **dentro** de `command.run` (ex.: `ping.ts:50`), não no dispatcher. Quando nega (permissão/rate-limit/manutenção) o comando faz `if (!check) return undefined`; o dispatcher não vê. Disparar após o `run` faria **não-admin spammando `!ban`** ou **usuário em cooldown** pumparem o `stickerCounter` → o oposto do throttle, e abre vetor de abuso.
- **ALTO — contagem dupla.** Os 10 comandos de figurinha (`attp, ttp, text, emojimix, giphy, tenor, ly, rename, rembg, trends`) já chamam `maybeSendAd` via `makeSticker` (`sticker.ts:120`). Hook no dispatcher contaria 2×.
- **ALTO — gating por retorno não serve.** Comandos retornam `sendMessage(<texto de erro>)` (truthy) no ramo de falha → "retorno truthy" ≠ "sucesso". Não dá pra distinguir no dispatcher.

### Solução adotada (mantém "comandos disparam ads", segura)
**Hook central no `checkCommand`** (`commandValidator.ts`): no ponto em que ele **vai retornar `true`** (comando é legítimo: permissão ok, não rate-limited, não em manutenção, escopo certo), disparar:
```ts
if (!command.skipAds) void maybeSendAd(jid)
```
Por quê é seguro:
- Só dispara em invocação **legítima** (negado/rate-limited → `checkCommand` retorna `false` → não dispara). Mata o vetor de abuso.
- **Central** (1 lugar), não precisa editar 60 comandos nem o dispatcher.
- `jid` no `text.ts` é `remoteJid || ''` (string vazia, nunca null) e `maybeSendAd` já guarda `!jid` — seguro; ainda assim só dispara com `jid` não-vazio.

### Opt-out (`skipAds: true`) — só o funcionalmente necessário (mantém amplo)
- **Obrigatório (contagem dupla):** `attp, ttp, text, emojimix, giphy, tenor, ly, rename, rembg, trends` (já contam via `makeSticker`).
- **Recomendado (UX):** `ads` (não anunciar enquanto administra anúncios).
- **Tudo o mais conta** (sua intenção: comandos em geral disparam). *Opção sua:* o agente sugeriu opt-out também de moderação/info/pagamento/utilitário (`ban/kick/help/menu/ping/pix/donate/...`) por UX — mas com o hook no `checkCommand` **não há vetor de abuso** (negado não conta), então deixo contar por padrão; você decide se quer essa lista maior de exceções (decisão no gate).

## Integração — placar (resolve open questions do design)
- **football-data.org**: free cobre a Copa (`competition WC`), `GET /v4/competitions/WC/matches`, header `X-Auth-Token`, **10 req/min**. **Porém o free é ATRASADO (não ao vivo)** — bom pra fixtures/encerrados, ruim pra ao vivo.
- **musa-soccer/Terra (keyless)**: **`idChampionship=1451`** = Copa 2026 (verificado ao vivo), `idPhase` por fase (grupos=6770, 16-avos=6771, oitavas=6772, quartas=6773, semi=6774, 3º/4º=6775). Mesmo padrão do `brasileirao.ts`, **ao vivo**, sem key.
- **⚠️ Recomendação revisada:** usar **musa-soccer como primário pro placar ao vivo** (keyless + ao vivo + padrão já provado no projeto) e football-data.org como secundário/estrutura (ou opcional). Isso pode **dispensar a API key**. — decisão no gate.

## Regression Sweep (risco → mitigação)
- **Todo comando passa a (talvez) disparar ad** → mitigação: hook em `checkCommand` (só sucesso), opt-out dos 10 de figurinha + `ads`; `adsSystem` global ainda manda (off = nada dispara); cooldown por chat limita frequência.
- **Import cycle** `commandValidator → ads → bot → text → commandValidator` → é **lazy** (uso em runtime, não no load), igual ao já existente `bot → sticker → ads → bot`. Verificar no build Docker (tsc). Se quebrar, mover o disparo pro retorno do dispatcher com flag explícita por comando.
- **Chamada de rede no `!copa`** → `try/catch` + timeout + cache + fallback; placar é enriquecimento, nunca quebra o comando.
- **Sem mudança de DB** → zero risco de schema/migração.
- **Segredo** → key só via env; `.env.example` documenta, nada commitado.

## Débito técnico descoberto (registrar, NÃO corrigir nesta feature)
- **`everyone.ts` (`!todos`)**: assinatura do `run` tem `isVip`/`isBotAdmin` **trocados** (posições 7/8) vs `CommandRunFunction`, e repassa trocado pro `checkCommand`. Não quebra `!todos` (que usa `onlyAdmin`/`isGroupAdmin`), mas é landmine se um dia gatear ads por VIP/admin. → backlog próprio.
- **Semântica do contador**: `stickerCounter` + log `[ADS]` + texto do `!ads` ("1 a cada N figurinhas") ficam imprecisos quando comandos também contam. → renomear/redocumentar (sub-tarefa nas tasks).

## Open questions (pro gate)
1. **Fonte primária do placar**: musa-soccer (keyless, ao vivo) primário vs football-data.org (precisa key, atrasado no free)? (recomendo musa-soccer primário.)
2. **Amplitude do opt-out**: só funcional (10 figurinha + ads) [recomendado, mantém amplo] vs incluir a lista UX (moderação/info/pagamento)?
3. Mata-mata "1º Grupo A × 2º Grupo B" até definir — confirmado no design.

## Dependências / base do branch
- Depende da feature de **ads** (`handlers/ads.ts`, `maybeSendAd`) — PR #78 aberta. Branch de implementação sai de `feat/ads` (ou de `main` após #78 mergear).
- DB (drizzle) já está na `main` (#77 mergeada). Esta feature **não** mexe em DB.
