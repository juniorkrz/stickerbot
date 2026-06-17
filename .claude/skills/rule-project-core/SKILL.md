---
name: rule-project-core
description: "StickerBot — leis always-on do sistema. TRIGGER ao mexer com: banco de dados / schema / migração (Drizzle + MySQL, sem framework de migração → ensureColumn), criar ou editar comando (auto-loader em src/handlers/text.ts, permissões admin-do-grupo vs admin-do-bot), handlers fire-and-forget / estado em memória / concorrência, config em runtime (Settings + cache), envio de mensagem/menção/mídia via Baileys, ou ao fazer operação destrutiva no banco em produção. Estas leis são a autoridade máxima sobre restrições do sistema."
---

# Rule: PROJECT_CORE — Leis fundamentais do StickerBot (always-on)

> StickerBot = bot de WhatsApp (Baileys v7 + TypeScript, Node 20) que cria figurinhas e tem monetização (VIP via MercadoPago PIX, anúncios). Persistência: **Drizzle ORM + MySQL** (`mysql2`). Webserver Express. Roda em Docker. Estas leis são inegociáveis.

---

## 🗄️ 1. Banco de dados & migrações

- **Drizzle ORM sobre MySQL (`mysql2`)**. Schema tipado em `src/db/schema.ts` (fonte da verdade — tipos via `typeof tabela.$inferSelect`). Acesso via `db` / `pool` exportados de `src/handlers/db.ts`.
- **NÃO existe framework de migração.** `initializeDB()` (em `src/handlers/db.ts`) só roda `CREATE TABLE IF NOT EXISTS` no boot. Isso **não altera tabela que já existe** em produção.
- **Adicionar coluna a tabela existente → migração idempotente obrigatória:** use o helper `ensureColumn(table, column, definition)` (checa `information_schema.COLUMNS` e só faz `ALTER TABLE ... ADD COLUMN` se faltar — funciona em MySQL **e** MariaDB, que é o motivo de não usar `ADD COLUMN IF NOT EXISTS`). Roda no boot, é seguro/instantâneo em tabela vazia ou pequena, e loga `[DB] Migration: added column X to Y`.
- Ao adicionar/alterar tabela ou coluna: **atualize `schema.ts` (Drizzle) E o `CREATE TABLE` em `db.ts`**, e adicione o `ensureColumn` se a tabela já existir em prod.
- **Upsert** = `db.insert(...).values(...).onDuplicateKeyUpdate({ set: {...} })`. Incremento atômico = `sql\`${col} + 1\``.
- Reserved words (ex.: coluna `key`) são quotadas pelo Drizzle automaticamente; em SQL cru, use crase.

## 🧩 2. Comandos & permissões

- Comandos ficam em `src/commands/*.ts`, cada um exportando `command: StickerBotCommand`. O **auto-loader** (`src/handlers/text.ts`) carrega todos automaticamente — não há registro manual. (Detalhe completo: skill `workflow-commands`.)
- **Sempre** chame `checkCommand(...)` no início do `run` e `return` se falhar.
- **Permissão (não confundir):**
  - `onlyAdmin: true` → exige **admin do GRUPO** (`isGroupAdmin`).
  - `onlyBotAdmin: true` → exige **operador do bot** (`isBotAdmin`, lista `SB_ADMINS`).
  - Features de comunidade/multi-grupo (ex.: lista de pelada) gateiam ações de gestão no **admin do grupo**, não no admin do bot.
  - Comando com subcomandos mistos (parte pública, parte admin): deixe o comando aberto (`onlyAdmin: false`) e gateie cada subcomando admin por dentro com `if (!isGroupAdmin) { reply; return }`.
- **Anúncios por comando:** todo comando que passa no `checkCommand` (legítimo: permissão/cooldown/escopo/manutenção ok) dispara `void maybeSendAd(jid)` no **success path do `checkCommand`** (`src/utils/commandValidator.ts`). Logo, **comando novo conta pro "1 a cada N" por padrão**; comando negado/rate-limited **não** conta (mata o vetor de abuso). Opt-out = `skipAds: true` no `StickerBotCommand`: use nos comandos de **figurinha** (já contam via `makeSticker`, senão contariam 2×) e no `ads`. Respeita `adsSystem` global + cooldown por chat.

## ⚙️ 3. Concorrência & fire-and-forget

- Vários handlers são disparados em **fire-and-forget** (ex.: `void maybeSendAd(...)` após cada figurinha). Em **rajadas** (usuário manda 10 figurinhas), eles rodam concorrentes.
- **Check-then-act sobre estado em memória compartilhado** (contadores, flags) DEVE reservar/commitar de forma **síncrona, ANTES do primeiro `await`** (flag de in-flight + reset) — senão cada chamada concorrente cruza o limite e o efeito duplica. (Bug real: anúncio enviado em dobro numa rajada.)
- Em fire-and-forget, **nunca deixe exceção vazar** — `try/catch` interno; uma falha aqui não pode quebrar o fluxo principal (criação da figurinha).

## 💾 4. Integridade de dados & operações destrutivas

- O projeto usa **hard delete** (`db.delete(...)`) — não há soft-delete. Não invente `deletedAt`.
- **Operação destrutiva em produção (DROP, TRUNCATE, delete em massa) exige backup ANTES:** dump (`mysqldump`) das tabelas afetadas e/ou cópia dos arquivos de código tocados. Veja a skill `workflow-deploy` para o procedimento.
- Datas: o projeto usa `new Date()` direto (sem helper central). Atenção ao round-trip de `DATETIME` no mysql2 (depende do TZ do processo; o container roda em BRT/-03:00). Exibição em pt-BR via `toLocaleString('pt-BR', { ... })`.

## 🔧 5. Config & config em runtime

- Toda config vem do objeto `bot` em `src/config.ts` (env-driven, com defaults). As envs de produção ficam **inline no `docker-compose.yml`** (não há `.env` em prod).
- **Padrão de config editável em runtime** (sem redeploy): tabela genérica `Settings` (key/value) + cache em memória carregado no boot (`loadXConfig()` chamado em `bot.ts` após `initializeDB()`) + setters que gravam no banco E atualizam o cache. A ENV vira **seed/fallback**. Hot paths leem o cache, **nunca** o banco.

## 📨 6. WhatsApp / Baileys

- Reaproveite os helpers de `src/utils/baileysHelper.ts` (`sendMessage`, `react`, `getQuotedMessage`, `getPhoneFromJid`, `getMessageAuthor`, etc.) — **não reinvente**.
- Nome de exibição do remetente = `message.pushName`.
- **Menção**: monte `mentions: [jid, jidEncode(phone, 's.whatsapp.net')]` (com `phone = await getPhoneFromJid(jid)`) e cite `@${phone}` no texto. Padrão em `commands/raffle.ts`.
- Mensagem citada: `message.message?.extendedTextMessage?.contextInfo?.quotedMessage` — **trate o wrapper `ephemeralMessage`** (o bot pode ter modo desaparecer ligado via `SB_DEFAULT_DISAPPEARING_MODE`).
- `spintax('{a|b}')` (em `utils/misc`) para variar texto e parecer menos robótico.

## ⚠️ 7. Estilo de código & verificação

- **Sem ponto-e-vírgula**, aspas simples, indent 2 espaços, `object-property-newline` (uma propriedade por linha em objeto multilinha), `max-len` 124. Vírgula final nos objetos de `schema.ts`, **mas não** nos objetos de query (`.values()` / `.set()`). Config em `.eslintrc`.
- **Não há `node_modules`/`tsc`/eslint garantidos localmente.** O type-check confiável é o `npm run build` (= `tsc`) **dentro do build Docker**. Um `tsc` que falha lá faz o build falhar e **deixa o container atual no ar** (seguro). Erros de tipo do `wa-sticker-formatter` que aparecem localmente são artefato de dep github não instalada — compilam no Docker.
- Logger central: `getLogger()` (pino). Use `logger.info/error`.
- **Higiene:** analise o código existente antes de codar; mantenha a raiz limpa (sem scripts temporários soltos — eles entram no contexto do build Docker via `COPY . .`).

---

> Mantenha esta `description` sincronizada com as seções acima — é o que faz a skill carregar na hora certa. Detalhes profundos: `workflow-database`, `workflow-commands`, `workflow-deploy`.
