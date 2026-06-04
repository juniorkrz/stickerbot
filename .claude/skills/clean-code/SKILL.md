---
name: clean-code
description: Pragmatic coding standards - concise, direct, no over-engineering, no unnecessary comments. TRIGGER ao escrever ou revisar qualquer código no projeto.
allowed-tools: Read, Write, Edit
---

# Clean Code — Pragmatic Coding Standards

> Be **concise, direct, and solution-focused**.

---

## Core Principles

| Principle | Rule |
|-----------|------|
| **SRP** | Single Responsibility - cada função/classe faz UMA coisa |
| **DRY** | Don't Repeat Yourself - extraia duplicação, reutilize |
| **KISS** | Keep It Simple - a solução mais simples que funciona |
| **YAGNI** | You Aren't Gonna Need It - não construa o que não vai usar |
| **Boy Scout** | Deixe o código mais limpo do que encontrou |

---

## Naming

| Elemento | Convenção |
|---------|------------|
| **Variáveis** | Revelam intenção: `userCount` não `n` |
| **Funções** | Verbo + substantivo: `getUserById()` não `user()` |
| **Booleanos** | Forma de pergunta: `isActive`, `hasPermission`, `canEdit` |
| **Constantes** | SCREAMING_SNAKE: `MAX_RETRY_COUNT` |

> Se precisa de comentário pra explicar um nome, renomeie.

---

## Funções

| Regra | Descrição |
|------|-------------|
| **Pequenas** | Idealmente 5-20 linhas |
| **Uma coisa** | Faz uma coisa, bem feita |
| **Um nível** | Um nível de abstração por função |
| **Poucos args** | Máx 3, prefira 0-2 |
| **Sem efeito colateral** | Não mutar inputs inesperadamente |

Estrutura: guard clauses (early return), flat > nested (máx 2 níveis), composição de funções pequenas.

---

## Type discipline (TypeScript)

Propagar tipos frouxos (`any`) em interfaces públicas é débito que se espalha: refactor não pega erro em compilação e o bug vaza em runtime; autocompletar morre. **Defina tipos explícitos em fronteiras públicas.** Quando inevitável (lib sem tipos), isole o `any` numa única função wrapper. (No StickerBot, `typeof tabela.$inferSelect` do Drizzle dá os tipos do banco de graça — use.)

---

## Anti-Patterns (NÃO)

| ❌ | ✅ |
|-----------|-------|
| Comentar cada linha | Apague comentários óbvios |
| Helper pra one-liner | Inline |
| utils com 1 função | Coloque onde é usado |
| Deep nesting | Guard clauses |
| Magic numbers | Constantes nomeadas |
| God functions | Divida por responsabilidade |
| "Primeiro a gente importa..." | Só escreva o código |

---

## 🔴 Antes de editar QUALQUER arquivo

| Pergunta | Por quê |
|----------|-----|
| **O que importa este arquivo?** | Pode quebrar |
| **O que este arquivo importa?** | Mudança de interface |
| **É componente/helper compartilhado?** | Vários lugares afetados |

> Edite o arquivo + todos os dependentes na MESMA task. Nunca deixe import quebrado.

---

## 🔴 Self-Check antes de concluir

- ✅ Fiz exatamente o que foi pedido?
- ✅ Editei todos os arquivos necessários?
- ✅ Verifiquei que funciona (não só compila)?
- ✅ Lint/type-check limpo?

> O usuário quer código funcionando, não uma aula de programação.
