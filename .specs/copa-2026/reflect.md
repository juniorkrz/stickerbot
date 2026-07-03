# Copa 2026 — reflect.md (Fase 3)

Análise pós-implementação a partir do `journal.md`. Padrão dominante: a feature criou uma **lei always-on nova** (gatilho de anúncios por comando) que todo autor de comando futuro precisa conhecer — esse é o conhecimento que evaporaria sem reflexão.

## Padrões do journal
- O maior risco/insight não foi a Copa em si, foi o **hook de ads no `checkCommand`**: agora **qualquer comando legítimo conta pro "1 a cada N"**, com `skipAds` como opt-out. Verificação adversarial (Fase 1) evitou a versão insegura (no dispatcher → comando negado contaria).
- Diretório novo `src/data/` (datasets estáticos) — antes não existia.
- Desvios de escopo aprovados (fallback football-data deferido, mata-mata sem overlay ao vivo, cache TTL único) — ficam no journal, não viram regra.
- Débito técnico pré-existente confirmado: `everyone.ts` (params `isVip`/`isBotAdmin` trocados) e semântica do `stickerCounter`.

## Decision Tree

### P1 — criar `.claude/skills/workflow-copa/`? ❌ NÃO
Feature self-contained (3 arquivos + 1 hook). Gotchas (musa-soccer `idChampionship=1451`, ids de fase, overlay de mata-mata por data como follow-up) já estão documentados no código (`handlers/copa.ts`, header do `data/copa2026.ts`) e no journal. Skill dedicada seria peso morto.

### P2 — atualizar `CLAUDE.md`? ✅ SIM
- **Leis Always-On (resumo)**: + bullet sobre o gatilho de anúncios por comando.
  - ANTES: não menciona que comandos disparam ads.
  - DEPOIS: "Anúncios por comando: comando legítimo dispara `maybeSendAd` no success path do `checkCommand` → comando novo conta por padrão; `skipAds: true` é o opt-out (figurinhas + `ads`)."
- **Estrutura macro (árvore `src/`)**: + linha `data/`.
  - ANTES: árvore sem `data/`.
  - DEPOIS: `├─ data/   # datasets estáticos (ex.: copa2026.ts)`.

### P3 — cross-reference em skills existentes? ✅ SIM
- **`rule-project-core`** (autoridade das leis), seção 2 (Comandos & permissões): + bullet "Anúncios por comando" com o detalhe autoritativo (hook no success path, `skipAds`, anti-dupla-contagem das figurinhas).
- **`workflow-commands`**: + seção "Anúncios (ads)" (autor de comando precisa saber que conta por padrão e como optar fora) + menção do campo `skipAds` no esqueleto.

### P4 — aprendizados pra `rule-project-core`/horizontais? ✅ (= P3)
A lei do gatilho de ads é a única regra nova; entra no `rule-project-core`. Demais práticas (rede com try/catch+timeout+cache nunca quebra o comando; estado em memória síncrono) já estavam codificadas nas leis 3/6.

## Aplicado
- `CLAUDE.md`: bullet de ads nas Leis Always-On + `data/` na árvore.
- `rule-project-core/SKILL.md`: bullet "Anúncios por comando" na seção 2.
- `workflow-commands/SKILL.md`: seção "Anúncios (ads)" + `skipAds` no esqueleto.
- Spec marcada `implemented`.
