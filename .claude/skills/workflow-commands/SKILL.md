---
name: workflow-commands
description: Como criar e editar comandos do StickerBot. TRIGGER ao adicionar um comando novo em src/commands/, editar um comando existente, mexer com permissões (admin do grupo vs admin do bot), parsing de argumentos, respostas/reações, menções ou subcomandos. Cobre o auto-loader, a interface StickerBotCommand, checkCommand, os helpers de baileysHelper e os padrões de permissão.
---

# Workflow: Comandos do StickerBot

## Auto-loader (não há registro manual)

Cada arquivo em `src/commands/*.ts` exporta `command: StickerBotCommand`. O dispatcher `src/handlers/text.ts` carrega **todos** automaticamente no boot e roteia por alias. Para adicionar um comando, **basta criar o arquivo** — nada de registrar.

- Nome do arquivo = alias principal (`ping.ts`, `ads.ts`, `lista.ts`).
- Tipos em `src/types/Command.ts` (`StickerBotCommand`, assinatura do `run`) e `src/types/Message.ts` (`WAMessageExtended`).

## Esqueleto

```ts
import { GroupMetadata } from '@whiskeysockets/baileys'
import path from 'path'

import { StickerBotCommand } from '../types/Command'
import { WAMessageExtended } from '../types/Message'
import { react, sendMessage } from '../utils/baileysHelper'
import { checkCommand } from '../utils/commandValidator'
import { emojis } from '../utils/emojis'
import { getLogger } from '../handlers/logger'
import { capitalize, getRandomItemFromArray } from '../utils/misc'

const logger = getLogger()
const extension = __filename.endsWith('.js') ? '.js' : '.ts'
const commandName = capitalize(path.basename(__filename, extension))

export const command: StickerBotCommand = {
  name: commandName,
  aliases: ['meucomando', 'alias2'],
  desc: 'O que o comando faz.',
  example: 'meucomando <param>',
  needsPrefix: true,        // exige prefixo (! / @ # .)
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,      // operador do bot (SB_ADMINS)
  onlyAdmin: false,         // admin do GRUPO
  onlyVip: false,
  botMustBeAdmin: false,    // o bot precisa ser admin do grupo?
  interval: 5,              // cooldown (s)
  limiter: {},              // não mexer
  // skipAds: true,         // opcional: NÃO conta pro contador de anúncios (ex.: figurinhas)
  run: async (
    jid, sender, message: WAMessageExtended, alias, body,
    group: GroupMetadata | undefined,
    isBotAdmin, isVip, isGroupAdmin, amAdmin
  ) => {
    const check = await checkCommand(jid, message, alias, group, isBotAdmin, isVip, isGroupAdmin, amAdmin, command)
    if (!check) return

    try {
      // argumentos = tudo depois do prefixo + alias
      const params = body.slice(command.needsPrefix ? 1 : 0).replace(new RegExp(`^${alias}\\s*`, 'i'), '').trim()
      return await sendMessage({ text: 'ok!' }, message)
    } catch (error) {
      logger.error(`Error in ${commandName}: ${error}`)
      return await react(message, emojis.error)
    }
  }
}
```

**Sempre** rode `checkCommand(...)` primeiro e `return` se falhar (ele valida prefixo, escopo, permissão, cooldown, manutenção).

## Permissões (não confundir — lei do projeto)

- `onlyAdmin: true` → exige **admin do GRUPO** (`isGroupAdmin`).
- `onlyBotAdmin: true` → exige **operador do bot** (`isBotAdmin`).
- Features multi-grupo (comunidade) → gateie a gestão no **admin do grupo**, não no admin do bot.
- **Comando com subcomandos mistos** (parte pública, parte admin): deixe `onlyAdmin: false` e gateie cada subcomando admin por dentro:
  ```ts
  const requireAdmin = async () => {
    if (!isGroupAdmin) { await sendMessage({ text: '⚠ Só admins do grupo.' }, message); return false }
    return true
  }
  // ...
  if (sub === 'criar') { if (!await requireAdmin()) return; /* ... */ }
  ```

## Parsing de subcomandos

```ts
const parsed = params.match(/^(\S+)\s*([\s\S]*)$/)
const sub = (parsed?.[1] || '').toLowerCase()
const argText = (parsed?.[2] || '').trim()   // preserva quebras de linha (útil pra conteúdo multilinha)
```
Convenção útil: **com nome no argumento = age sobre aquela pessoa/valor; sem argumento = age sobre o remetente** (ver `lista.ts`).

## Helpers (reaproveitar — não reinventar) — `src/utils/baileysHelper.ts`

- `sendMessage(content, message)` — responde (texto/imagem/etc.), citando a mensagem.
- `react(message, emoji)` — reage. `emojis.success` é array (`getRandomItemFromArray`), `emojis.error` é string.
- `getQuotedMessage(message)` / contextInfo — mensagem citada (**trate `ephemeralMessage`**, pois o bot pode ter modo desaparecer ligado).
- `getPhoneFromJid(jid)` (async) — telefone correto (evita bug de LID/DDI do Baileys v7).
- **Menção**: `mentions: [jid, jidEncode(phone, 's.whatsapp.net')]` + `@${phone}` no texto (padrão em `raffle.ts`).
- Nome do remetente: `message.pushName`.
- `compareJids`, `isJidAdminOfGroup`, `amAdminOfGroup` — comparação/checagem robusta de jids.

## Anúncios (ads)

Comando que passa no `checkCommand` dispara o contador de anúncios automaticamente (hook no **success path do `checkCommand`**). Ou seja: **comando novo conta pro "1 a cada N" por padrão — não precisa fazer nada.** Para NÃO contar, adicione `skipAds: true` ao objeto do comando:
- comandos de **figurinha** (já contam via `makeSticker` → senão contariam 2×);
- gestão de anúncios (`ads`).

Comando negado/rate-limited **não** conta (o hook só roda quando `checkCommand` aprova). Detalhe autoritativo: skill `rule-project-core`.

## Verificação

- Type-check confiável = `npm run build` (tsc) no **build Docker** (não há `tsc`/`node_modules` local garantido — ver `workflow-deploy`). Localmente `npx tsc --noEmit` funciona se as deps estiverem instaladas.
- O comando aparece no boot: `[COMMANDS] N commands have been loaded!` (N deve subir em 1).

> Há uma skill legada `.agents/skills/create_command/SKILL.md` com a mesma ideia — esta `workflow-commands` a substitui (mais completa). Pode remover a antiga.
