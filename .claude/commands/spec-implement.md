---
description: Fase 2 do spec-workflow — executa tasks de um spec já planejado em .specs/<feature>/, mantém journal.md vivo com desvios/erros/pedidos extras.
---

Use a skill **`spec-workflow`** (em `.claude/skills/spec-workflow/SKILL.md`), especificamente a **Fase 2 — Implement**.

Pré-requisitos (aborta se faltar): `.specs/{feature_name}/design.md`, `impact.md`, `tasks.md`. Se faltar, pare e peça `/spec` primeiro.

Regras inegociáveis:

1. **Crie `journal.md`** no início. Mantenha vivo a cada desvio, erro ou pedido extra.
2. **Uma task por vez** com checkpoint humano. Exceção: usuário disse "implemente tudo"; mesmo assim pause antes de tasks ⚠️.
3. **3-Strike Error Protocol** — após 3 tentativas distintas pra mesma classe de erro, escale. Nunca repita ação que falhou.
4. **2-Action Rule** — após 2 operações pesadas de leitura, escreva descobertas em `journal.md` antes que evaporem.
5. **Atualize `tasks.md` task a task** (`- [x]`), não no final.
6. **Pedidos extras** → registrar em `journal.md` e decidir: incorporar / sub-spec / backlog.
7. **Final verification**: cross-task consistency + Regression Sweep (cada risco do impact.md → mitigação) + test summary. No StickerBot, o type-check real roda no build Docker (`npm run build`/`tsc`) — veja a skill `workflow-deploy`.
8. Ao terminar, **sugira `/spec-reflect`**.

$ARGUMENTS
