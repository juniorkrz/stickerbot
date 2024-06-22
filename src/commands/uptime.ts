/* Comando base - StickerBot */
import { GroupMetadata, proto } from "@whiskeysockets/baileys";
import path from "path";
import moment from "moment"; // Certifique-se de instalar a biblioteca moment
import { bot } from "../config";
import { StickerBotCommand } from "../types/Command";
import { WAMessageExtended } from "../types/Message";
import { sendMessage } from "../utils/baileysHelper";
import { checkCommand } from "../utils/commandValidator";
import { capitalize, spintax } from "../utils/misc";
//import { getClient } from '../bot'

// Obtém a extensão deste arquivo para importar dinamicamente '.ts' se estiver em desenvolvimento e '.js' se estiver em produção
const extension = __filename.endsWith(".js") ? ".js" : ".ts";

// Obtém o nome do arquivo sem a extensão .ts/.js
const commandName = capitalize(path.basename(__filename, extension));

// Adicionar startedAt ao bot se não existir
if (!("startedAt" in bot)) {
  (bot as any).startedAt = Date.now();
}

// Configurações do comando:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ["uptime"], // * Tudo que estiver aqui será aceito como comando, precisa ser um array com no mínimo um comando.
  desc: "Mostra a quanto tempo o bot está ligado.", // * Descrição do comando, será exibido no menu.
  example: false, // Exemplo do comando, deve ser uma string ou false
  needsPrefix: true, // O comando precisa de um prefixo para ser executado?
  inMaintenance: false, // O comando está em manutenção?
  runInPrivate: true, // O comando deve funcionar nos privados?
  runInGroups: true, // O comando deve funcionar em qualquer grupo?
  onlyInBotGroup: false, // O comando deve funcionar apenas nos grupos oficiais do bot?
  onlyBotAdmin: false, // O comando deve funcionar apenas para administradores do bot?
  onlyAdmin: false, // O comando deve funcionar apenas para administradores do grupo?
  botMustBeAdmin: false, // O bot precisa ser administrador do grupo para executar o comando?
  interval: 5, // Intervalo para executar esse comando novamente (em segundos)
  limiter: {}, // Não mexa nisso!
  run: async (
    jid: string, // ID do chat
    message: WAMessageExtended, // Mensagem (WAMessage)
    alias: string, // O alias que o usuário escolheu
    body: string, // Corpo da mensagem
    group: GroupMetadata | undefined, // Informações do grupo | Será undefined caso não seja um grupo
    isBotAdmin: boolean, // É um administrador do bot?
    isGroupAdmin: boolean, // É um administrador do grupo?
    amAdmin: boolean // O bot é admin no grupo?
  ) => {
    // Não modifique
    const check = await checkCommand(
      jid,
      message,
      alias,
      group,
      isBotAdmin,
      isGroupAdmin,
      amAdmin,
      command
    );
    if (!check) {
      return;
    }

    // Sinta-se livre para criar seu comando abaixo.
    // Tipo de retorno: Promise<proto.WebMessageInfo | undefined>

    // Como importar o client:

    // Remova o comentário do getClient no inicio desse arquivo
    // Use:
    // const client = getClient()

    // Exemplos do Baileys:
    // https://github.com/WhiskeySockets/Baileys
    // https://github.com/WhiskeySockets/Baileys/blob/master/Example/example.ts

    // Responde com o uptime do bot e reage a mensagem:

    const timestamp = message.messageTimestamp;
    if (!timestamp) {
      return await sendMessage(
        { text: "Timestamp da mensagem não encontrado." },
        message
      );
    }

    const time =
      (typeof timestamp === "number" ? timestamp : timestamp.low) * 1000;
    const ms = Date.now() - time;

    const currentTime = moment();
    const uptimeDuration = moment.duration(
      currentTime.diff(moment.unix((bot as any).startedAt / 1000))
    );

    const days = uptimeDuration.days();
    const hours = uptimeDuration.hours();
    const minutes = uptimeDuration.minutes();
    const seconds = uptimeDuration.seconds();

    const timeStrings = [];
    if (days > 0) {
      timeStrings.push(`${days} ${days > 1 ? "dias" : "dia"}`);
    }

    if (hours > 0) {
      timeStrings.push(`${hours} ${hours > 1 ? "horas" : "hora"}`);
    }

    if (minutes > 0) {
      timeStrings.push(`${minutes} ${minutes > 1 ? "minutos" : "minuto"}`);
    }

    if (seconds > 0) {
      timeStrings.push(`${seconds} ${seconds > 1 ? "segundos" : "segundo"}`);
    }

    const timeStr = timeStrings.join(", ");

    const responseText = `{⏱|⏳|🕓|⏰} Eu estou online há ${timeStr}.`;

    return await sendMessage({ text: spintax(responseText) }, message);
  },
};
