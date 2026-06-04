# .specs/ — Specs ativos (Spec-Driven Development)

Cada feature mora em `.specs/<feature-name>/` (kebab-case) e é gerenciada pela skill
[`spec-workflow`](../.claude/skills/spec-workflow/SKILL.md) via os comandos `/spec*`.

| Arquivo | Fase | Propósito |
|---|---|---|
| `requirements.md` | Plan | User stories (opcional, escopo ambíguo) |
| `design.md` | Plan | Arquitetura, modelos, contratos |
| `impact.md` | Plan | Arquivos afetados, riscos, regressão |
| `tasks.md` | Plan | Checklist numerado (⚠️ = alto risco) |
| `journal.md` | Implement | Diário vivo: desvios, erros+soluções, pedidos extras |
| `reflect.md` | Reflect | Decisões + diff aplicado no `.claude/` |

## Ciclo

- `/spec [feature]` → **Plan**: design + impact + tasks com gates de aprovação
- `/spec-implement [feature]` → **Implement**: executa tasks, mantém `journal.md` vivo
- `/spec-reflect [feature]` → **Reflect**: consolida aprendizado em skills/CLAUDE.md
- `/spec-retro [feature|path]` → **Retro**: documenta feature já implementada sem spec

> Antes de implementar feature relacionada a um spec existente, leia no mínimo
> `design.md` + `impact.md` + `tasks.md`.
