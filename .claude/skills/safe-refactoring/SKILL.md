---
name: safe-refactoring
description: Estratégias de refatoração segura — quebrar arquivos grandes, extrair função/handler quando um bloco fica grande demais, Dispatcher Pattern para orquestradores grandes, refator incremental (slice, não big-bang), preservar API pública estável, 1 commit = 1 transformação reversível, NUNCA misturar refator + feature no mesmo commit. TRIGGER quando um arquivo/função cresce demais, ou quando o usuário pede "refatora", "extrai", "limpa esse arquivo", "quebra esse monolito", ou ao revisar PR pra detectar code smell de tamanho.
---

# Safe Refactoring — Quebrando monólitos com segurança

## 🛠️ Protocolo "Extract-First"

- **Extração imediata**: se um bloco (função, switch grande, handler) tem responsabilidade clara separável, extraia pra unidade própria.
- **Lógica isolada**: tire efeitos colaterais / chamadas async / setup pesado pra helpers/handlers dedicados, deixando o orquestrador leve.
- **Early guards**: valide nulidade/tipos no topo das unidades extraídas.

## 🔄 Padrão Dispatcher

Quando um arquivo centraliza muitos casos (muitos comandos, muitos subcomandos), use um **Dispatcher**: o orquestrador decide *qual* unidade chamar (via `switch`/mapa) e delega. No StickerBot, `handlers/text.ts` já é um dispatcher de comandos (auto-loader por alias); comandos com muitos subcomandos (ex.: `lista.ts`) podem extrair os handlers de cada subcomando.

## 🐢 Incremental, nunca big-bang

- Extraia **uma** sub-unidade por vez, valide (compila + comportamento), e só então a próxima.
- **1 commit = 1 transformação reversível.** Nunca misture refator estrutural com mudança de comportamento no mesmo commit — se quebrar, impossível bissectar.
- **Preserve a API pública**: se outros módulos importam o que você move, mantenha um re-export estável durante a transição. (No StickerBot, ao mexer em `db.ts`, preserve a assinatura dos helpers exportados — eles são consumidos em comandos/handlers.)

## 🛡️ Verificação de integridade

- **Type-check** após cada extração (`npm run build`/tsc — no StickerBot o confiável é no build Docker, ver `workflow-deploy`).
- Confirme que funções "órfãs" não foram removidas por engano; cheque imports quebrados.
- Se a mudança não reflete no runtime, suspeite de cache/hot-reload preso — reinicie o processo/container antes de concluir que o refator falhou.
