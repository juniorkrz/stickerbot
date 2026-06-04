---
name: spec-workflow
description: Spec-Driven Development unificado em 3 fases + Modo Retroativo. Plan (design.md + impact.md + tasks.md em .specs/<feature>/ com gates de aprovação), Implement (executa tasks uma a uma com checkpoint + post-task verification + 3-Strike Error Protocol, mantém journal.md vivo registrando desvios, erros+soluções e pedidos extras), Reflect (análise pós-implementação visitando journal.md, propondo criar workflow-<feature> skill, atualizar CLAUDE.md, cross-references e aprendizados em rules). Modo Retroativo faz engenharia reversa de feature já implementada SEM spec. TRIGGER ao iniciar feature nova, planejar implementação complexa multi-arquivo, executar spec já planejado em .specs/, capturar desvios durante implementação, ou consolidar/documentar conhecimento de um módulo.
---

# Spec Workflow — Plan → Implement → Reflect (+ Retro)

> Use sempre que for implementar feature que envolva mais de 1-2 arquivos, mude schema, ou tenha risco de regressão — e pra documentar módulos existentes (Modo Retroativo).

## Princípios

1. **Filesystem é memória persistente.** Decisões, descobertas, erros e desvios vão pra arquivo. Context window é volátil.
2. **Gates de aprovação são inegociáveis.** Cada fase tem checkpoint humano. Não avance sem confirmação explícita.
3. **Plano vivo.** O spec não é fotografia — `journal.md` captura o delta entre plano e realidade.
4. **Reflexão fecha o ciclo.** Conhecimento adquirido vira skill/rule/CLAUDE.md update — senão evapora.

## Estrutura de artefatos

Toda feature mora em `.specs/<feature_name>/` (kebab-case):

| Arquivo | Fase | Obrigatório | Propósito |
|---|---|---|---|
| `requirements.md` | 1 | ❌ | User stories (use quando escopo é ambíguo ou stakeholder não-técnico) |
| `design.md` | 1 | ✅ | Arquitetura, modelos, contratos, snippets do core |
| `impact.md` | 1 | ✅ | Change surface, regression risk, integração segura |
| `tasks.md` | 1 | ✅ | Checklist numerado com risk levels (⚠️ = alto risco) |
| `journal.md` | 2 | ✅ ao iniciar Fase 2 | Diário vivo: desvios, erros+soluções, pedidos extras |
| `reflect.md` | 3 | ✅ | Decisões da reflexão + diff proposto pro `.claude/` |

---

## FASE 1 — Plan

### 1.1 Capture Intent (Socratic Gate)

Antes de criar arquivo:
1. Qual o nome da feature? (kebab-case)
2. Qual o problema que resolve? (1-2 frases — não a solução)
3. Há `.specs/<feature>/` parcial? Se sim → ler e estender, não recomeçar.
4. Quer começar com `requirements.md`? (escopo ambíguo / stakeholder não-técnico).

Crie `.specs/<feature_name>/`.

### 1.2 design.md
Arquitetura proposta, modelos/entidades tocados, contratos (comandos/handlers/tipos), snippets do core (não tudo). Mapeie concerns do `rule-project-core` que se aplicam (DB/migração, permissão, concorrência fire-and-forget, deploy).

### 1.3 impact.md
Arquivos afetados, dependências, possíveis quebras, riscos (dados/concorrência/permissão conforme o projeto). **Gate**: aprovação antes de tasks.

### 1.4 tasks.md
Checklist numerado, granular, com ⚠️ nas de alto risco (mudança de schema, DROP, deploy em produção). **Gate**: aprovação antes de implementar.

> Não implemente código na Fase 1. Implementação é a Fase 2 (`/spec-implement`).

---

## FASE 2 — Implement

Pré-requisitos: `design.md` + `impact.md` + `tasks.md` existem. Se faltar, pare e peça `/spec` primeiro.

1. **Crie `journal.md`** no início. Mantenha vivo a cada desvio/erro/pedido extra.
2. **Uma task por vez** com checkpoint humano. Exceção: usuário disse "implemente tudo"; mesmo assim pause antes de tasks ⚠️.
3. **3-Strike Error Protocol**: após 3 tentativas distintas pra mesma classe de erro, escale pro usuário. Nunca repita ação que falhou.
4. **2-Action Rule**: após 2 operações pesadas de leitura/pesquisa, escreva descobertas em `journal.md` antes que evaporem do contexto.
5. **Atualize `tasks.md` task a task** (`- [x]`), não no final.
6. **Pedidos extras** do usuário → registrar em `journal.md` e decidir: incorporar / sub-spec / backlog.
7. **Final verification**: cross-task consistency + Regression Sweep (cada risco do impact.md → mitigação) + test summary. No StickerBot o type-check confiável é o `npm run build` (tsc) dentro do build Docker — não há `node_modules`/`tsc` local garantido (ver `workflow-deploy`).
8. Ao terminar, **sugira `/spec-reflect`**.

---

## FASE 3 — Reflect

Pré-requisitos: tasks concluídas. Idealmente `journal.md` mantido.

1. **Reler `journal.md`** procurando padrões: desvios recorrentes, erros caros, pedidos que viraram parte da feature, regras descobertas.
2. **Decision Tree (4 perguntas, uma por uma)**:
   - **P1**: criar `.claude/skills/workflow-<feature>/`? Sim se há regras vivas, gotchas, contratos que outros precisam saber.
   - **P2**: atualizar `CLAUDE.md`? Sim se comando/entry-point novo, mudança arquitetural macro, ou regra always-on nova.
   - **P3**: cross-reference em skills existentes? Pra cada skill que toca a área (`workflow-database`, `workflow-commands`, `workflow-deploy`), um dev lendo descobriria a feature?
   - **P4**: aprendizados pra `rule-project-core`/horizontais? (ex: bug recorrente de concorrência → reforçar a lei).
3. **Compile `reflect.md`** com diff específico (ANTES → DEPOIS) por item.
4. **Apresente item a item** e aplique só o aprovado.
5. **Final report** do que foi aplicado.

> Não pule a Fase 3 nem em features pequenas. A resposta pode ser "nada migra", mas a pergunta tem que ser feita.

---

## MODO RETROATIVO — engenharia reversa (usado pelo /spec-retro)

Pra documentar feature/módulo **já implementado SEM spec**.

### R.1 Capture do alvo
1. Nome da feature (kebab-case).
2. Escopo: lista de arquivos/pastas ou domínio descrito.
3. Objetivo: **Modo A (Doc-only)** = só gerar `.specs/<feature>/`; **Modo B (Full)** = doc + Reflect.

### R.2 Engenharia reversa (Reverse Plan)
Crie `.specs/<feature>/` a partir do código existente:
- **`design.md`**: overview (inferido), componentes/responsabilidades, data models/contratos, snippets do core, testing strategy (ou ausência).
- **`impact.md`**: codebase mapping (arquivos que formam a feature), dependências, risco implícito (acoplamentos, falta de validação/testes), **Open Questions** (o que ficou ambíguo).
- **`tasks.md`**: checklist retroativa, tudo `[x]`; ao final, seção "Tasks que deveriam existir e não foram feitas" (gaps: falta teste, audit, etc.).
- **`journal.md`**: nota de que foi gerado retroativamente; "Achados que viraram débito técnico" (anti-patterns descobertos).

### R.3 Apresentar e decidir modo
Mostre o spec retro, confirme correção. Modo A → para aqui. Modo B → segue pra Fase 3 (Reflect).

### Regras críticas do Modo Retroativo
1. **Nunca invente comportamento.** Ambíguo → "Open Question", não suposição.
2. **Não modifique código.** Diagnóstico apenas — só lê código e escreve markdown.
3. **Registre débito técnico** descoberto no `journal.md` (vira input pro Reflect, não correção silenciosa).
