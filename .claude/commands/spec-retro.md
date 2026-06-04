---
description: Análise retroativa — engenharia reversa de função/comando/feature já implementada SEM spec. Gera spec retroativa em .specs/<feature>/ e oferece dois modos: doc-only (apenas documenta) ou full (doc + Reflect que atualiza workflow skills/CLAUDE.md/rules).
---

Use a skill **`spec-workflow`** (em `.claude/skills/spec-workflow/SKILL.md`), no **Modo Retroativo** (seção dedicada na skill).

## Quando usar

- Existe feature/comando/função implementada **sem spec**.
- Você quer **documentar como funciona** pra referência viva de outros devs (humanos ou agentes).
- E/ou **consolidar o conhecimento** no `.claude/` (criar `workflow-<feature>` skill, atualizar CLAUDE.md, cross-references).

## Workflow

### Step 1 — Capture do alvo (Socratic Gate)
1. Nome da feature (kebab-case).
2. Escopo: lista de arquivos/pastas ou domínio descrito.
3. Objetivo: **Modo A (Doc-only)** = só `.specs/<feature>/`; **Modo B (Full)** = doc + Reflect.

### Step 2 — Engenharia reversa
Crie `.specs/{feature}/` com `design.md`, `impact.md` (com Open Questions), `tasks.md` (tudo `[x]` + gaps), `journal.md` (nota retroativa + achados que viraram débito técnico). Detalhe na skill, Modo Retroativo.

### Step 3 — Apresentar e decidir modo
Mostre o spec retro e confirme. Modo A → para aqui. Modo B → segue pra Fase 3 (Reflect): Decision Tree de 4 perguntas → `reflect.md` → aplicar aprovados.

## Regras críticas

1. **Nunca invente comportamento.** Ambíguo → "Open Question", pergunte ao usuário.
2. **Não modifique código durante `/spec-retro`.** Diagnóstico — só lê código e escreve markdown.
3. **Modo B é o caminho recomendado** quando a feature é grande/importante — sem Reflect, o spec fica órfão.
4. **Registre anti-patterns descobertos** como débito técnico no `journal.md` — input pro Reflect, não correção silenciosa.

$ARGUMENTS
