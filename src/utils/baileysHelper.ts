import { AnyMessageContent, GroupMetadata, GroupMetadataParticipants, MiscMessageGenerationOptions, WAMessage, WA_DEFAULT_EPHEMERAL, areJidsSameUser, downloadMediaMessage, isJidGroup } from "@whiskeysockets/baileys"
import NodeCache from 'node-cache'
import { getClient } from "../bot"
/* import { Sticker, StickerTypes } from 'wa-sticker-formatter' */
/* import { stickerMeta } from "../config" */

const myCache = new NodeCache()

export const groupFetchAllParticipating = async () => {
    const client = getClient()
    const result: any = {}
    const groups = await client.groupFetchAllParticipating()
    for (const group in groups) {
        result[group] = groups[group].subject
    }
    return result
}

export const getCachedGroupMetadata = async (
    jid: string,
): Promise<GroupMetadataParticipants | undefined> => {
    if (!isJidGroup(jid)) {
        return undefined
    }

    const client = getClient()

    let metadata: GroupMetadata
    const data = myCache.get(jid)

    if (data) {
        metadata = data as GroupMetadata
        return {
            participants: metadata.participants,
        } as GroupMetadataParticipants
    }

    try {
        metadata = await client.groupMetadata(jid)
    } catch {
        return undefined
    }

    myCache.set(jid, metadata, 30)

    return {
        participants: metadata?.participants,
    } as GroupMetadataParticipants
}

export const getFullCachedGroupMetadata = async (
    jid: string,
): Promise<GroupMetadata | undefined> => {
    if (!isJidGroup(jid)) {
        return undefined
    }

    const client = getClient()

    let metadata: GroupMetadata
    const data = myCache.get(jid)

    if (data) {
        metadata = data as GroupMetadata
        return metadata
    }

    try {
        metadata = await client.groupMetadata(jid)
    } catch {
        return undefined
    }

    myCache.set(jid, metadata, 30)

    return metadata
}

export const amAdminOfGroup = (group: GroupMetadata | undefined) => {
    const client = getClient()
    return group ? group.participants
        .find((p) => areJidsSameUser(p.id, client.user?.id))
        ?.admin?.endsWith('admin') !== undefined
        : false
}

export const getBody = (message: WAMessage) => {
    return (
        message.message?.extendedTextMessage?.text ||
        message.message?.conversation ||
        message.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
        message.message?.ephemeralMessage?.message?.conversation ||
        ''
    )
}

export const getMessage = (message: WAMessage) => {
    return (
        message?.message?.extendedTextMessage ||// text
        message?.message?.ephemeralMessage?.message?.extendedTextMessage ||// ephemeral text
        message?.message?.imageMessage ||// image
        message?.message?.videoMessage ||// video
        message?.message?.ephemeralMessage?.message?.imageMessage ||// ephemeral image
        message?.message?.ephemeralMessage?.message?.videoMessage ||// ephemeral video
        message?.message?.viewOnceMessage?.message?.imageMessage ||// viewonce image
        message?.message?.viewOnceMessage?.message?.videoMessage ||// viewonce video
        message?.message?.viewOnceMessageV2?.message?.imageMessage ||// viewonce v2 image
        message?.message?.viewOnceMessageV2?.message?.videoMessage)// viewonce v2 video
}

export const getMessageExpiration = (message: WAMessage) => {
    return getMessage(message)?.contextInfo?.expiration
}

export const getMessageOptions = (message: WAMessage, quote: boolean): MiscMessageGenerationOptions => {
    return {
        cachedGroupMetadata: getCachedGroupMetadata,
        quoted: quote ? message : undefined,
        ephemeralExpiration: getMessageExpiration(message) || WA_DEFAULT_EPHEMERAL
    }
}

export const sendMessage = async (
    content: AnyMessageContent,
    message: WAMessage,
    quote: boolean = true
) => {
    if (!message.key.remoteJid) return
    const client = getClient()
    return await client.sendMessage(
        message.key.remoteJid,
        content,
        getMessageOptions(message, quote)
    )
}

export const react = async (message: WAMessage, emoji: string) => {
    return await sendMessage(
        {
            react: {
                text: emoji,
                key: message.key
              }
        },
        message,
        false
    )
  }

export const makeSticker = async (message: WAMessage, url = '') => {
    return// TODO
    const data = url ? url
    : <Buffer>await downloadMediaMessage(message, 'buffer', {})

    /* const sticker = new Sticker(data, stickerMeta)
    const content = { text: await sticker.toMessage() }
    return await sendMessage(content, message, true) */
}