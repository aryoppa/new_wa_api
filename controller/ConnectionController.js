const {
    default: makeWASocket,
    DisconnectReason,
    isJidBroadcast,
    makeInMemoryStore,
    useMultiFileAuthState,
    downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require('fs').promises;
const pino = require("pino");
const session = "baileys_auth_info";
const { makeApiRequest } = require('../utils/utils');
// const { writeToDatabase } = require('../logging_db/logger');
const { writeToDatabase } = require('../logging_db/logger_sqlite');

// Create an in-memory store with silent logging.
const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });
let sock;

/**
 * Establishes a connection to WhatsApp using Baileys library.
 * It initializes the socket with authentication state, binds event listeners,
 * and handles QR code printing in the terminal.
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(session);
    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: "silent" }),
        shouldIgnoreJid: isJidBroadcast
    });
    store.bind(sock.ev);
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
        await fetchGroups();
    }
}

/**
 * Handles disconnection events by logging out or attempting reconnection based on the reason.
 * @param {string} reason - The reason for the disconnection.
 */
async function handleDisconnect(reason) {
    if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
        console.log(reason === DisconnectReason.loggedOut ? `Device Logged Out, deleting session and scanning again.` : `Bad Session File, Please Delete ${session} and Scan Again`);
        await fs.rm(session, { recursive: true }).catch(console.error);
    } else if (Object.values(DisconnectReason).includes(reason)) {
        console.log("Connection issue, reconnecting...");
    } else {
        console.error(`Unknown DisconnectReason: ${reason}`);
        return;
    }
    connectToWhatsApp();
}

/**
 * Fetches all groups where the bot is participating.
 * @returns {Array} An array of group objects.
 */
async function fetchGroups() {
    const getGroups = await sock.groupFetchAllParticipating();
    return Object.values(getGroups);
}

async function handleMessagesUpsert({ messages }) {
    const message = messages[0];
    const { key, message: msgContent } = message;
    const { remoteJid: noWa, fromMe } = key;
    const check = msgContent?.extendedTextMessage?.contextInfo;
    // const targetJid = "6285880379892@s.whatsapp.net";
    const targetJid = "6285159911409@s.whatsapp.net";
    const text = msgContent?.conversation || msgContent?.extendedTextMessage?.text;
    const textMessage = text?.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{23F3}\u{24C2}\u{23E9}-\u{23EF}\u{25B6}\u{23F8}-\u{23FA}]/gu, '');
    await sock.readMessages([key]);
    
    const isGroupMessage = key.remoteJid.includes("@g.us");
    const isPersonalMessage = !fromMe && !isGroupMessage;
    const isTargetMentioned = check?.mentionedJid?.includes(targetJid) || check?.participant?.includes(targetJid);

    if (isGroupMessage && isTargetMentioned) {
        const cleanquery = textMessage.replace("@6285159911409", '');
        const answer = await sendReply(noWa, cleanquery, message);
        await writeToDatabase(message.pushName, key.participant, cleanquery, answer);

    } else if (isPersonalMessage) {
        const answer = await sendReply(noWa, textMessage, message);
        await writeToDatabase(message.pushName, key.remoteJid ,textMessage, answer);
    }
}

/**
 * Sends a reply to a specific WhatsApp number.
 * @param {string} noWa - The WhatsApp number to send the message to.
 * @param {string} textMessage - The text message to send.
 * @param {Object} message - The original message object for quoting.
 * @returns {string} The response data from the API.
 */
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

/**
 * Handles document messages by downloading and saving the document.
 * @param {Object} message - The message object containing the document.
 * @param {Object} msgContent - The content of the document message.
 */
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
};
