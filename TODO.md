# 📝 TO DO

## 🚀 Funcionalidades Novas

- [x] Criar stickers de mensagens citadas
- [ ] Carregar frases de um JSON
- [ ] Adicionar thumbnail nas imagens do `unmakeSticker`
- [ ] Limpeza automática de histórico/conversas
- [x] Implementar `botSetup`
- [x] Logs no grupo de admins
- [ ] Obrigar usuário a participar da comunidade (configurável)
- [x] Limite de taxa (10 mensagens/minuto por usuário)
- [x] Sistema de banimento
  - [x] `ban` / `banneds` / `unban`

## 🛠️ Melhorias e Correções

- [x] Renomear `spinText` para `spintax`
- [x] Adicionar `Dependabot`
- [x] Adicionar `ESLint`
- [x] Implementar `makeSticker`
- [x] Aprimorar `makeSticker` (tem muitos argumentos, não tá legal)
- [x] Implementar `unmakeSticker`

## 🔍 Validações para Criar Sticker

- [x] Chat privado
- [x] Grupos
  - [x] Criar se for mencionado
  - [x] Criar se for um grupo oficial

## 📝 Criar Sticker com Texto

- [x] Texto em imagem
- [ ] Texto em vídeo
- [ ] Texto em sticker

## 🔄 Migrar Comandos Antigos para o Novo Bot

- [x] `ttp` / `attp`
- [x] `open` / `close`
- [x] `placa` / `fipe`
- [x] `everyone`
- [x] `invite`
- [x] `jid`
- [x] `kick`
- [x] `link`
- [x] `menu`
- [x] `mp3`
- [x] `ping`
- [x] `pinga`
- [x] `pix`
- [x] `promote` / `demote`
- [x] `sorteio`
- [x] `rembg`
- [ ] `rename`
- [ ] `toImg`
- [x] `uptime`
- [ ] `vcard`
- [ ] `version`
- [ ] `s` / `s2` / `s3`
- [ ] `stickers`
- [x] `Feedback`

## 👾 Bugs

- [ ] `unmakeSticker` Error: EBUSY: resource busy or locked (on Windows)
- [ ] `menu` Error: ENOENT: no such file or directory, scandir '/usr/src/app/dist/img/menu'