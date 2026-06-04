# StickerBot — Guia de Projeto (Claude Code)

Bot de WhatsApp (Baileys v7 + TypeScript) que cria figurinhas e oferece monetização (VIP via MercadoPago PIX, anúncios) e utilidades de grupo (ex.: lista de pelada).

- **Stack:** Node.js 20 + TypeScript; WhatsApp via `@whiskeysockets/baileys` v7; webserver Express.
- **Persistência:** Drizzle ORM + MySQL (`mysql2`). Schema tipado em `src/db/schema.ts`.
- **Frontend:** N/A (bot de chat + webhook).
- **Como roda:** `npm start` (dev: `npm run dev`); build `npm run build` (tsc). Em produção roda em **Docker Compose** (ver skill `workflow-deploy`).

---

## 📚 Fonte canônica de conhecimento — `.claude/`

| Pasta | Conteúdo | Como ativa |
|---|---|---|
| `.claude/skills/` | Skills passivas: horizontais (`clean-code`, `safe-refactoring`, `quality-assurance`) + always-on (`rule-project-core`) + por módulo (`workflow-database`, `workflow-commands`, `workflow-deploy`) + `spec-workflow` | Carregadas automaticamente quando a `description` matcha o contexto |
| `.claude/agents/` | Personas: `orchestrator`, `architect`, `backend-specialist` | Subagentes via tool `Agent` (`subagent_type`) |
| `.claude/commands/` | Slash commands: `/spec`, `/spec-implement`, `/spec-reflect`, `/spec-retro` | Digitando `/spec*` |
| `.specs/` | Specs ativos (design/impact/tasks/journal/reflect) | Gerenciado pela skill `spec-workflow` |

---

## ⭐ Regra de Ouro — Roteamento

Antes de tocar código, identifique o domínio e use a skill/persona certa:

| Tarefa envolve | Use subagent | Skills principais |
|---|---|---|
| Decisão estrutural / prevenir monólito | `architect` | `safe-refactoring`, `rule-project-core` |
| Comando novo, handler, lógica, persistência | `backend-specialist` | `workflow-commands`, `workflow-database`, `clean-code` |
| Banco / schema / migração | `backend-specialist` | `workflow-database`, `rule-project-core` |
| Deploy / produção / Docker | `backend-specialist` | `workflow-deploy` |
| Multi-domínio / planejamento | `orchestrator` | `spec-workflow`, `quality-assurance` |

Para tarefas complexas/ambíguas: **pare e pergunte** — mínimo 3 perguntas estratégicas antes de codificar (Socratic Gate).

---

## ⚖️ Leis Always-On (resumo)

> Detalhes completos na skill [`rule-project-core`](.claude/skills/rule-project-core/SKILL.md), que carrega quando o assunto surge.

- **Banco/migração:** Drizzle + MySQL, **sem framework de migração** — `initializeDB` só faz `CREATE TABLE IF NOT EXISTS`. Coluna nova em tabela existente → helper idempotente `ensureColumn` (via `information_schema`). Atualize sempre `schema.ts` + o `CREATE TABLE` em `db.ts`.
- **Comandos/permissão:** auto-loader (`handlers/text.ts`); `checkCommand` no início. `onlyAdmin` = admin do **grupo**; `onlyBotAdmin` = operador do bot. Multi-grupo → gateie no admin do grupo.
- **Concorrência:** handlers fire-and-forget (`void ...`) rodam concorrentes em rajadas — reserve estado em memória de forma **síncrona antes do `await`**; nunca deixe exceção vazar.
- **Destrutivo em prod:** `DROP`/delete em massa → **backup antes** (`mysqldump`).
- **Config em runtime:** tabela `Settings` + cache em memória (seed = ENV); hot path lê o cache, não o banco.
- **Estilo:** sem `;`, aspas simples, max-len 124. Type-check confiável = `npm run build` (tsc) no build Docker (não há tsc local garantido).

---

## 🗄️ Estrutura macro

```
src/
├─ bot.ts            # entry-point: conexão WA, webserver Express, dispatch de mensagens
├─ config.ts         # objeto `bot` (config env-driven) + endpoints externos
├─ commands/         # 1 arquivo = 1 comando (auto-loaded por handlers/text.ts)
├─ handlers/         # db (Drizzle), text (dispatcher), sticker, ads, lists, community,
│                    #   reaction, senderUsage, logger, emojiMix, fileUploader, memegen...
├─ db/schema.ts      # schema Drizzle (fonte da verdade dos tipos)
├─ scripts/          # migrate-db (SQLite → MySQL, one-off)
├─ utils/            # baileysHelper, misc (spintax/getRandomItemFromArray), commandValidator,
│                    #   emojis, colors, store
└─ types/            # Command, Message, etc.
```

### Modelos/entidades (tabelas)
- **Core:** `Usage` (contadores), `Vips` (assinaturas), `Banned` (banidos).
- **Features:** `Ads` (anúncios) + `Settings` (config runtime key/value), `Lists` + `ListEntries` (listas/pelada).

### Entry-points
- **Comandos** via prefixos `! / @ # .` — arquivos em `src/commands/`, carregados automaticamente.
- **Webserver Express** (porta interna 3000) — webhooks (ex.: MercadoPago).
- **Eventos Baileys** em `bot.ts` (`messages.upsert`, `call`, `connection.update`).

---

## 🧭 Skills de referência profunda

| Domínio | Skill |
|---|---|
| Leis fundamentais do projeto | `rule-project-core` |
| Banco: Drizzle, schema, migração idempotente | `workflow-database` |
| Criar/editar comando (auto-loader, permissões, helpers) | `workflow-commands` |
| Deploy: Docker Compose + pscp/plink em produção | `workflow-deploy` |
| Código limpo | `clean-code` |
| Refatoração / quebra de monólito | `safe-refactoring` |
| Quality gates / checklist de entrega | `quality-assurance` |
| Spec-Driven Development (Plan/Implement/Reflect/Retro) | `spec-workflow` |

---

## 📋 Specs em andamento

Specs ativos em `.specs/<feature>/` (até 5 arquivos). **Antes de implementar feature relacionada, leia design+impact+tasks.** Ciclo:
- `/spec` → Plan · `/spec-implement` → Implement · `/spec-reflect` → Reflect · `/spec-retro` → documentar feature existente

---

## ✅ Checklist de entrega

**Antes de implementar:** verifiquei `rule-project-core` + a `workflow-*` da área? Roteei pro especialista? Apliquei o Socratic Gate se ambíguo?

**Durante:**
- [ ] Mudou schema? Atualizei `schema.ts` + `CREATE TABLE` em `db.ts` + `ensureColumn` se a tabela já existe em prod?
- [ ] Comando admin gateado no nível certo (grupo vs bot)?
- [ ] Handler fire-and-forget: estado em memória reservado de forma síncrona? `try/catch` interno?
- [ ] Operação destrutiva em prod tem backup antes?

**Entrega:**
- [ ] `npm run build` (tsc) passa no Docker? Lint ok?
- [ ] Verifiquei o comportamento (não só compila)?
- [ ] Sem código morto / scripts temporários soltos na raiz?

---

## 🧹 Convenções de trabalho

- **Analisar o código existente antes de codificar** — trocar cego quebra fluxo.
- **Raiz limpa**: scripts de debug/temp não ficam soltos na raiz (o `COPY . .` do Docker os arrastaria pro build).
- **Reaproveitar helpers** de `utils/baileysHelper.ts` e `utils/misc.ts` em vez de reinventar.
- Time fala **pt-BR**; mensagens ao usuário final em português.
