---
description: Fase 3 do spec-workflow — análise reflexiva pós-implementação. Decide se cabe criar workflow-<feature> skill, atualizar CLAUDE.md, cross-references em skills, ou aprendizados em rules.
---

Use a skill **`spec-workflow`** (em `.claude/skills/spec-workflow/SKILL.md`), especificamente a **Fase 3 — Reflect**.

Pré-requisitos: `design.md`/`impact.md`/`tasks.md` existem, tasks marcadas `[x]`. Idealmente `journal.md` mantido (se não, a reflexão é mais rasa mas ainda vale).

Workflow:

1. **Reler `journal.md` inteiro** procurando padrões: desvios recorrentes, erros caros, pedidos que viraram parte da feature, regras descobertas.
2. **Decision Tree (4 perguntas, uma por uma)**:
   - P1: criar `.claude/skills/workflow-<feature>/`? (regras vivas, gotchas, contratos)
   - P2: atualizar `CLAUDE.md`? (rota/entry-point novo, mudança macro, regra always-on nova)
   - P3: cross-reference em skills existentes? (ex.: `workflow-database`, `workflow-commands`, `workflow-deploy`)
   - P4: aprendizados pra `rule-project-core`/skills horizontais?
3. **Compile `reflect.md`** com diff específico (ANTES → DEPOIS) por item.
4. **Apresente item a item** e aplique só o aprovado.
5. **Final report** do que foi aplicado; marque a spec como `implemented`.

Importante: **não pule a Fase 3 nem em features pequenas.** A resposta pode ser "nada migra", mas a pergunta tem que ser feita — senão conhecimento evapora.

$ARGUMENTS
