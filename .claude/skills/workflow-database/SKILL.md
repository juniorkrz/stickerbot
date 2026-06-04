---
name: workflow-database
description: Camada de persistência do StickerBot — Drizzle ORM sobre MySQL (mysql2). TRIGGER ao adicionar/alterar tabela ou coluna, escrever query, mexer em src/db/schema.ts ou src/handlers/db.ts, criar migração, ou padrão de config em runtime (Settings + cache). Cobre: schema tipado, CREATE TABLE IF NOT EXISTS no boot, migração idempotente via ensureColumn (sem framework de migração), padrões de query/upsert, e o script SQLite→MySQL.
---

# Workflow: Banco de Dados (Drizzle + MySQL)

## Onde vive

- **`src/db/schema.ts`** — schema Drizzle (`mysqlTable`). **Fonte da verdade dos tipos** (`type Row = typeof tabela.$inferSelect`).
- **`src/handlers/db.ts`** — `initializeDB()` (cria pool mysql2 + `db = drizzle(pool)` + `CREATE TABLE IF NOT EXISTS` de cada tabela + migrações `ensureColumn`), e os helpers de acesso (`getCount`, `getVips`, `ban`, `getSetting`/`setSetting`, etc.). Exporta `pool` e `db`.
- Config de conexão vem de `bot.dbHost/dbUser/dbPassword/dbName/dbPort` (`config.ts`, env-driven). `drizzle.config.ts` aponta pro schema (para `drizzle-kit`).

## ⚠️ NÃO há framework de migração

`initializeDB` só roda `CREATE TABLE IF NOT EXISTS`. Isso **cria** tabela nova, mas **não altera** tabela que já existe em produção. Logo:

### Adicionar uma TABELA nova
1. Definir em `schema.ts` (`export const x = mysqlTable('X', { ... })`).
2. Adicionar `CREATE TABLE IF NOT EXISTS \`X\` (...)` em `initializeDB`.
3. Pronto — o boot cria. (Importe a tabela em `db.ts` só se for usar o objeto Drizzle lá.)

### Adicionar uma COLUNA a tabela existente (migração idempotente obrigatória)
1. Adicionar a coluna em `schema.ts`.
2. Adicionar a coluna no `CREATE TABLE` (para instalações novas).
3. **Adicionar a migração** no fim de `initializeDB`:
   ```ts
   await ensureColumn('Tabela', 'coluna', 'TINYINT(1) NOT NULL DEFAULT 0')
   ```
   `ensureColumn(table, column, definition)` checa `information_schema.COLUMNS` e só faz `ALTER TABLE ... ADD COLUMN` se faltar — **funciona em MySQL e MariaDB** (por isso não usa `ADD COLUMN IF NOT EXISTS`, que é só MariaDB). É idempotente, seguro/instantâneo em tabela pequena, e loga `[DB] Migration: added column X to Y`.

> Verifique em produção que a migração rodou: o log de boot mostra a linha `[DB] Migration: ...` na primeira subida; `DESCRIBE <Tabela>` confirma a coluna. (Como rodar SQL/Node dentro do container: skill `workflow-deploy`.)

## Padrões de query

```ts
// select
const rows = await db.select().from(ads).where(eq(ads.active, 1)).limit(1)
// aleatório
.orderBy(sql`RAND()`)
// insert
await db.insert(ads).values({ content, createdAt: new Date(), updatedAt: new Date() })
// upsert
await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } })
// incremento atômico
await db.update(ads).set({ sentCount: sql`${ads.sentCount} + 1` }).where(eq(ads.id, id))
// delete (HARD delete — não há soft-delete no projeto)
await db.delete(ads).where(eq(ads.id, id))
```

- Imports drizzle: `eq, and, or, asc, desc, sql` de `'drizzle-orm'`.
- **Reserved words** (ex.: coluna `key`): o Drizzle quota com crase automaticamente; em SQL cru use crase manualmente.
- Para `insertId` ou pegar a linha recém-criada de forma portável, reconsulte (ex.: `getActiveList`) em vez de depender de `insertId`.

## Estilo nos objetos de query

`object-property-newline` vale, **mas** os objetos de `.values()`/`.set()` **não** levam vírgula final (≠ objetos de `schema.ts`, que levam). Sem `;`, aspas simples.

## Migração de dados (one-off)

`src/scripts/migrate-db.ts` (`npm run migrate-db`) migra o SQLite legado → MySQL (Usage/Vips/Banned). `drizzle-kit push` via `npm run db:push`. São ferramentas de dev; `sqlite`/`sqlite3` ficam em `devDependencies`.

## Config em runtime (padrão Settings)

Para tornar algo configurável sem redeploy: tabela `Settings` (key/value) + cache em memória + `loadXConfig()` no boot (chamado em `bot.ts` após `initializeDB()`) + setters que gravam no banco E atualizam o cache. ENV = seed/fallback. **Hot paths leem o cache, nunca o banco.**
