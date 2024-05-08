const {
    default: makeWASocket,
    DisconnectReason,
    isJidBroadcast,
    makeInMemoryStore,
    useMultiFileAuthState,
    downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require('fs');
const pino = require("pino");
const { session } = { "session": "baileys_auth_info" };
const { makeApiRequest } = require('../utils/utils');
const {writetoFile} = require('../logger')

const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });
let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(session);
    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: "silent" }),
        shouldIgnoreJid: isJidBroadcast
    });
    store.bind(sock.ev);
    sock.multi = true;
    sock.ev.on('connection.update', handleConnectionUpdate);
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", handleMessagesUpsert);
}

async function handleConnectionUpdate(update) {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
        const reason = lastDisconnect?.error ? new Boom(lastDisconnect.error).output.statusCode : DisconnectReason.unknown;
        await handleDisconnect(reason);
    } else if (connection === 'open') {
        console.log('Bot is ready!');
        return await fetchGroups();
    }
}

async function handleDisconnect(reason) {
    switch (reason) {
        case DisconnectReason.badSession:
            console.log(`Bad Session File, Please Delete ${session} and Scan Again`);
            await sock.logout();
            break;
        case DisconnectReason.connectionClosed:
        case DisconnectReason.connectionLost:
        case DisconnectReason.restartRequired:
        case DisconnectReason.timedOut:
            console.log("Connection issue, reconnecting...");
            connectToWhatsApp();
            break;
        case DisconnectReason.loggedOut:
            console.log(`Device Logged Out, deleting session and scanning again.`);
            await fs.rm(session, { recursive: true });
            connectToWhatsApp();
            break;
        default:
            sock.end(`Unknown DisconnectReason: ${reason}`);
            break;
    }
}

async function fetchGroups() {
    const getGroups = await sock.groupFetchAllParticipating();
    return Object.values(getGroups);
}

async function handleMessagesUpsert({ messages }) {
    const message = messages[0];
    const { key, message: msgContent } = message;
    const { remoteJid: noWa, fromMe } = key;
    const check = msgContent?.extendedTextMessage?.contextInfo;
    const targetJid = "6285880379892@s.whatsapp.net";
    const text = msgContent?.conversation || msgContent?.extendedTextMessage?.text;
    // const textMessage = text?.replaceAll(/\p{Emoji}/gu, '');
    const textMessage = text;
    await sock.readMessages([key]);
    
    const isGroupMessage = key.remoteJid.includes("@g.us");
    const isPersonalMessage = !fromMe && !isGroupMessage;
    const isTargetMentioned = check?.mentionedJid?.includes(targetJid) || check?.participant?.includes(targetJid);

    if (isGroupMessage && isTargetMentioned) {
        const answer = await sendReply(noWa, textMessage, message);
        // console.log("tes");
        await writetoFile(message.pushName, textMessage, answer);

    } else if (isPersonalMessage) {
        // await handleNonTargetMessage(noWa, msgContent, message, textMessage);
        const answer = await sendReply(noWa, textMessage, message);
        // console.log(answer);
        await writetoFile(message.pushName, key.remoteJid ,textMessage, answer);
    }
}

async function sendReply(noWa, textMessage, message) {
    if (textMessage) {
        try {
            const response = await makeApiRequest(textMessage);
            await sock.sendMessage(noWa, { text: response.data }, { quoted: message });
            return response.data;
        } catch (error) {
            console.error("Error sending message:", error);
        }
    } else {
        const nonTextMessageReply = "Mohon maaf, untuk saat ini kami hanya dapat menerima pesan text. Silahkan kirim ulang pertanyaan Anda dalam bentuk text.";
        await sock.sendMessage(noWa, { text: nonTextMessageReply });
    }
}

async function handleNonTargetMessage(noWa, msgContent, message, textMessage) {
    
    if (textMessage) {
        await sendReply(noWa, textMessage, message);
    } else {
        const messageType = Object.keys(msgContent)[0];
        if (messageType === 'documentMessage') {
            await handleDocumentMessage(message, msgContent);
        }
    }
}

async function handleDocumentMessage(message, msgContent) {
    try {
        const buffer = await downloadMediaMessage(
            message,
            'buffer',
            {},
            { reuploadRequest: sock.updateMediaMessage }
        );
        const name = msgContent?.documentMessage?.fileName;
        if (name) {
            await fs.writeFile(`./downloads/${name}`, buffer);
        } else {
            console.log('No file name provided, cannot save the file.');
        }
    } catch (error) {
        console.error("Error handling document message:", error);
    }
}

module.exports = {
    connectToWhatsApp
}