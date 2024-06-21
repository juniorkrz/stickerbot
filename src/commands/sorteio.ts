/* Comando base - StickerBot */
import { GroupMetadata, proto } from "@whiskeysockets/baileys";
import path from "path";
import { bot } from "../config";
import { StickerBotCommand } from "../types/Command";
import { WAMessageExtended } from "../types/Message";
import { react, sendMessage } from "../utils/baileysHelper";
import { checkCommand } from "../utils/commandValidator";
import { capitalize, spintax } from "../utils/misc";
import { getClient } from "../bot"; // Removido o comentário

// Funções auxiliares (adicione estas funções ao seu arquivo utils ou aqui temporariamente)
const getMessageExpiration = (message: WAMessageExtended): number => {
  // Defina a lógica de expiração da mensagem, se necessário
  return 0; // Retorna 0 para sem expiração
};

const getLocalizedText = (
  commandName: string,
  key: string,
  params: any
): string => {
  // Função para obter texto localizado usando spintax
  const template =
    "@{winner} {{meus |}parabéns|boa}! {Você|Tu|Vc} {ganhou |venceu |é o vencedor d}o {sorteio|concurso}{raffleName}! {🎉|🏆|🏅|🎖|🥇|⭐|✨}";
  return spintax(
    template
      .replace("{winner}", params.winner)
      .replace("{raffleName}", params.raffleName)
  );
};

const getPhoneFromJid = (jid: string): string => {
  // Função de exemplo para obter o telefone a partir do JID
  return jid.split("@")[0];
};

// Obtém o nome do arquivo sem a extensão .ts
const commandName = capitalize(path.basename(__filename, ".ts"));

// Configurações do comando:
export const command: StickerBotCommand = {
  name: commandName,
  aliases: ["sorteio", "sortear", "concurso", "raffle"],
  desc: "Realiza um sorteio entre os membros do grupo.",
  example: "de um doce!",
  needsPrefix: true,
  inMaintenance: false,
  runInPrivate: true,
  runInGroups: true,
  onlyInBotGroup: false,
  onlyBotAdmin: false,
  onlyAdmin: false,
  botMustBeAdmin: false,
  interval: 5,
  limiter: {},
  run: async (
    jid: string,
    message: WAMessageExtended,
    alias: string,
    body: string,
    group: GroupMetadata | undefined,
    isBotAdmin: boolean,
    isGroupAdmin: boolean,
    amAdmin: boolean
  ): Promise<proto.WebMessageInfo | undefined> => {
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
      await react(message, "❌");
      return undefined;
    }

    // Sinta-se livre para criar seu comando abaixo.
    const client = getClient();
    const expiration = getMessageExpiration(message);
    const raffleName = body
      .slice(command.needsPrefix ? 1 : 0)
      .replace(alias, "")
      .trim();

    if (!group) {
      await react(message, "❌");
      return undefined;
    }

    const clientJid = client.user?.id ? client.user.id.split(":")[0] : "";
    const participants = group.participants.filter(
      (participant) => participant.id !== clientJid
    );
    const randomIndex = Math.floor(Math.random() * participants.length);
    const winner = participants[randomIndex].id;
    const phrase = getLocalizedText(commandName, "response", {
      winner: getPhoneFromJid(winner),
      raffleName: raffleName ? " *" + raffleName + "*" : "",
    });

    return await client.sendMessage(
      jid,
      { text: phrase, mentions: [winner] },
      { quoted: message, ephemeralExpiration: expiration }
    );
  },
};
