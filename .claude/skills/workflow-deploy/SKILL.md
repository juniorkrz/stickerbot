---
name: workflow-deploy
description: Como buildar e fazer deploy do StickerBot em produção (Docker Compose) a partir de uma máquina Windows via PuTTY plink/pscp. TRIGGER ao fazer deploy, buildar a imagem, mexer no docker-compose.yml, rodar comandos no servidor de produção, fazer migração/backup de banco em prod, ou rodar um script Node dentro do container. Cobre o procedimento seguro de deploy, as armadilhas de quoting do PowerShell→plink e backups antes de operações destrutivas.
---

# Workflow: Build & Deploy (produção)

> **Nunca** coloque segredos (senha root, senha do banco, tokens) em arquivo commitado — este repo é público. Credenciais são fornecidas pelo operador na hora.

## Topologia de produção

- Roda em **Docker Compose** no servidor (`root@<PROD_HOST>`, projeto em `/root/stickerbot`). O serviço `stickerbot` usa `build: .` → Dockerfile faz `npm install` → `npm run build` (tsc) → `node dist/bot.js`.
- **As envs de produção ficam inline no `docker-compose.yml`** (bloco `environment:`), **não** há `.env` em prod. Quando pedirem "ajusta o .env", é o bloco do compose.
- Volume **`/data:/data`** guarda as credenciais da sessão WhatsApp → **recriar o container NÃO pede QR de novo**.
- O banco MySQL fica no mesmo host (acessível por `mysql`/`mysqldump` no servidor).

## Ferramentas no Windows (PowerShell + PuTTY)

Use **plink/pscp** via PowerShell (não há `sshpass`/`rsync`; OpenSSH não aceita senha por CLI):
```powershell
plink -batch -ssh -pw <senha> root@<PROD_HOST> "comando remoto"
pscp  -batch -pw <senha> "local\arquivo" root@<PROD_HOST>:/root/stickerbot/caminho
```

**Armadilhas de quoting (importantes):**
- **Não** use `cmd /c "plink ... \"...\""` — o aninhamento de aspas corrompe o comando (`root@` vira `oot@`).
- O parser do **PowerShell quebra** quando o comando remoto tem **aspas duplas, parênteses ou `*`** (ex.: `grep "(...)"`, `node -e` com `COUNT(*)`). Use **só aspas simples** nos padrões internos (grep/sed), e escape `$` remoto como `` `$ `` (ex.: `sed -i 's/\r`$//'`).
- Para qualquer coisa com aspas duplas/parênteses/`*` embutidos (awk, `node -e`, SQL com `COUNT(*)`), **escreva um arquivo `.sh`/`.js` local, `pscp` ele (transfere literal, sem mangling), normalize CRLF→LF (`sed -i 's/\r$//' script`) e rode.**

## Procedimento seguro de deploy

1. **Backup** dos arquivos a sobrescrever no servidor (ex.: `cp` pra `/root/stickerbot_backup_<ts>/`). Para mudança de banco, `mysqldump` das tabelas afetadas.
2. **`pscp`** só os arquivos alterados pros caminhos correspondentes em `/root/stickerbot/...`.
3. **Normalizar LF**: `for f in ...; do sed -i 's/\r$//' $f; done` (arquivos vindos do Windows podem ter CRLF).
4. **Validar compose** (se mexeu nele): `docker compose config -q`.
5. **Buildar**: `docker compose build stickerbot`. O `tsc` roda aqui — **se falhar, o build falha e o container atual continua no ar** (seguro). Erros de tipo de `wa-sticker-formatter` são artefato local; compilam no Docker.
6. **Subir**: `docker compose up -d stickerbot` (recria só esse serviço; `/data` preservado → sem QR novo).
7. **Verificar**: `docker compose ps stickerbot`, `docker inspect stickerbot --format '{{.RestartCount}}'` (espera 0), e `docker compose logs --tail=60 stickerbot` (procure `[COMMANDS] N loaded`, `ready`, e ausência de erros).

## Rodar um Node one-off dentro do container

`mysql2` e o `node_modules` vivem em `/usr/src/app` no container:
```powershell
pscp -batch -pw <senha> check.js root@<PROD_HOST>:/root/stickerbot/check.js
plink -batch -ssh -pw <senha> root@<PROD_HOST> "cd /root/stickerbot && docker compose cp check.js stickerbot:/usr/src/app/check.js && docker compose exec -T -w /usr/src/app stickerbot node check.js"
```
Use `-w /usr/src/app` (senão o Node não acha `mysql2`). Limpe os scripts auxiliares de `/root/stickerbot` depois — o `COPY . .` do build os arrastaria pra imagem.

## Banco em produção (destrutivo)

- **Antes de `DROP`/delete em massa: faça dump.** `mysqldump -h <host> -u <user> -p'<senha>' --no-tablespaces <db> Tabela1 Tabela2 > /root/dump_<ts>.sql`.
- Se for **dropar** tabelas que o `initializeDB` recria: primeiro faça **deploy do código** que removeu o `CREATE TABLE` (e o `ensureColumn`), depois dropе — senão o próximo boot recria as tabelas vazias.
- Verifique com um script Node (padrão acima) ou `mysql -e 'SHOW TABLES'`.

## Migração de schema no deploy

Mudou `schema.ts`/`db.ts` com coluna nova? O `ensureColumn` roda no boot e migra a tabela existente automaticamente — confirme no log `[DB] Migration: added column ... ` após o `up -d` (ver `workflow-database`).
