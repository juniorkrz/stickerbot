---
name: quality-assurance
description: Checklists de entrega — verificações antes de fechar feature/PR/commit: type-check (npm run build no Docker), comportamento verificado (não só compila), leis do projeto respeitadas (migração via ensureColumn, permissão grupo vs bot, concorrência fire-and-forget, backup antes de destrutivo). TRIGGER antes de commit/PR de feature, ao finalizar implementação, na verification phase do spec-implement, ou quando o usuário pede "está pronto?" / "revisa antes de mergear".
---

# Quality Assurance — QA & verificação de entrega (StickerBot)

## 📝 Pré-implementação

- [ ] Entendi exatamente o que foi pedido (sem suposição)?
- [ ] Verifiquei `rule-project-core` + a `workflow-*` da área (`workflow-database`/`workflow-commands`/`workflow-deploy`)?
- [ ] Sei quais arquivos/dependências a mudança vai tocar?

## 🛠️ Verificação final (antes de "pronto")

- **Type-check**: `npm run build` (tsc) passa? No StickerBot o confiável é **dentro do build Docker** (não há tsc local garantido). Build que falha lá não derruba o container atual.
- **Comportamento real**: a feature *funciona* (rodei/testei o caminho feliz + edge), não só compila?
- **Logs limpos**: sem erro novo nos `docker compose logs`; `[COMMANDS] N loaded` e `ready` aparecem no boot.
- **Sem regressão**: o que mudei não quebrou o fluxo de criar figurinha nem os comandos vizinhos.

## 🛡️ Leis transversais (StickerBot)

- **Banco/migração:** mexeu em schema? Atualizei `schema.ts` **+** `CREATE TABLE` em `db.ts` **+** `ensureColumn` se a tabela já existe em prod? O log `[DB] Migration: ...` confirmou no deploy?
- **Permissão:** comando admin gateado no nível certo — **admin do grupo** (`isGroupAdmin`) vs **operador do bot** (`isBotAdmin`)?
- **Concorrência:** handler fire-and-forget reserva o estado em memória de forma **síncrona antes do `await`**? Tem `try/catch` interno (não vaza exceção)?
- **Destrutivo em prod:** `DROP`/delete em massa tem **dump de backup antes**? Se dropei tabela do `initializeDB`, o código já parou de recriá-la?
- **Config:** hot path lê o cache em memória (não o banco a cada chamada)?

## 🧹 Higiene final

- [ ] Sem código morto, sem `console.log`/TODO órfão?
- [ ] Sem scripts temporários soltos na raiz (o `COPY . .` do Docker os arrastaria pro build)?
- [ ] Diff revisado — só o que era pra mudar mudou? Sem segredo commitado (repo público)?
