import { checkCommand } from "../utils/commandValidator";
import { StickerBotCommand } from "../types/Command";
import { WAMessageExtended } from "../types/Message";
import { react } from "../utils/baileysHelper";
import { capitalize } from "../utils/misc";
import path from "path";
import { GroupMetadata } from "@whiskeysockets/baileys";
import { getClient } from "../bot";

// Gets the file name without the .ts extension
const commandName = capitalize(path.basename(__filename, ".ts"));

// Command settings:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ["fechar", "close"],
  desc: "Fecha o grupo para que apenas os administradores possam mandar mensagens.",
  example: false,
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: false,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: true,
  botMustBeAdmin: true,
  interval: 30,
  limiter: {}, // do not touch this
  run: async (
    jid: string,
    message: WAMessageExtended,
    alias: string,
    body: string,
    group: GroupMetadata | undefined,
    isBotAdmin: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ) => {
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
      return; //original "return false"
    }

    // Fecha um grupo

    // get the client
    const client = getClient();

    // close the group
    await client.groupSettingUpdate(jid, "announcement");

    // react success
    return await react(message, "🔒");
  },
};
