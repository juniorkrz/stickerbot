---
description: Inicia o workflow Spec-Driven Development — Fase 1 (Plan): design + impact + tasks com gates de aprovação. Use a skill spec-workflow.
---

Use a skill **`spec-workflow`** (em `.claude/skills/spec-workflow/SKILL.md`) para conduzir a feature solicitada, especificamente a **Fase 1 — Plan**.

Regras inegociáveis:

1. Crie o diretório `.specs/{feature_name}/` (kebab-case) na raiz do projeto.
2. Siga os passos da Fase 1: capture intent → requirements (opcional) → design → impact → tasks.
3. **Sempre peça aprovação explícita antes de avançar de fase** (Design Gate, Impact Gate, Tasks Gate).
4. Antes de `tasks.md`, faça `impact.md` analisando arquivos afetados, dependências, possíveis quebras e riscos (segurança/dados/concorrência conforme `rule-project-core`).
5. **Não implemente código.** Implementação é `/spec-implement` (Fase 2).
6. Se houver `.specs/{feature_name}/` parcial, leia e estenda — não recomece.

Socratic Gate (mín. 3 perguntas): nome da feature, problema que resolve, requirements.md ou direto pro design, spec parcial existente.

$ARGUMENTS
