
// Importing required modules
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
const { makeApiRequest, getApiReckon } = require('../utils/utils');
const { writeToDatabase } = require('../logging_db/logger_sqlite');

// Constants
const SESSION = "baileys_auth_info";

// Logger configuration
const silentLogger = pino().child({ level: "silent", stream: "store" });
const store = makeInMemoryStore({ logger: silentLogger });

// Global variable
let sock;

/**
 * Initializes the WhatsApp connection and event listeners.
 * @returns {Promise<void>}
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION);
    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: silentLogger,
        shouldIgnoreJid: isJidBroadcast
    });
    store.bind(sock.ev);
    sock.ev.on('connection.update', handleConnectionUpdate);
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", handleMessagesUpsert);
}

/**
 * Processes connection updates and triggers appropriate actions.
 * @param {Object} update - The connection update object.
 * @returns {Promise<void>}
 */
async function handleConnectionUpdate(update) {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
        const disconnectReason = lastDisconnect?.error ? new Boom(lastDisconnect.error).output.statusCode : DisconnectReason.unknown;
        await handleDisconnect(disconnectReason);
    } else if (connection === 'open') {
        console.log('WhatsApp connection established.');
        await fetchGroups();
    }
}

/**
 * Manages disconnection based on the provided reason.
 * @param {string} reason - The disconnection reason.
 * @returns {Promise<void>}
 */
async function handleDisconnect(reason) {
    const isLoggedOut = reason === DisconnectReason.loggedOut;
    const isBadSession = reason === DisconnectReason.badSession;
    if (isLoggedOut || isBadSession) {
        const message = isLoggedOut ? `Device Logged Out, deleting session and scanning again.` : `Bad Session File, Please Delete ${SESSION} and Scan Again`;
        console.log(message);
        await fs.rm(SESSION, { recursive: true }).catch(console.error);
    } else if (Object.values(DisconnectReason).includes(reason)) {
        console.log("Connection issue detected, attempting to reconnect...");
    } else {
        console.error(`Unrecognized disconnection reason: ${reason}`);
        return;
    }
    connectToWhatsApp();
}

/**
 * Retrieves groups where the bot is a participant.
 * @returns {Promise<Array>} A promise that resolves to an array of group objects.
 */
async function fetchGroups() {
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups);
}

/**
 * Handles new messages and performs actions based on message content.
 * @param {Object} upsert - The messages upsert object.
 * @returns {Promise<void>}
 */
async function handleMessagesUpsert({ messages }) {
    const message = messages[0];
    const { key, message: msgContent } = message;
    const { remoteJid: noWa, fromMe } = key;
    const check = msgContent?.extendedTextMessage?.contextInfo;
    const targetJid = "6285159911409@s.whatsapp.net";
    const text = msgContent?.conversation || msgContent?.extendedTextMessage?.text;
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{23F3}\u{24C2}\u{23E9}-\u{23EF}\u{25B6}\u{23F8}-\u{23FA}]/gu;
    const textMessage = text?.replace(emojiRegex, '');
    await sock.readMessages([key]);
    
    const isGroupMessage = noWa.includes("@g.us");
    const isPersonalMessage = !fromMe && !isGroupMessage;
    const isTargetMentioned = check?.mentionedJid?.includes(targetJid) || check?.participant?.includes(targetJid);

    if (isGroupMessage && isTargetMentioned) {
        const cleanQuery = textMessage.replace(`@${targetJid.split('@')[0]}`, '').trim();
        const answer = await sendReply(noWa, cleanQuery, message);
        const messages = answer.data.data.message
        const index = answer.data.data.index
        await writeToDatabase(message.pushName, noWa, textMessage, messages, index);
    } else if (isPersonalMessage) {
        if(message.message?.documentWithCaptionMessage?.message?.documentMessage?.caption.toLowerCase() == "proses file berikut ini"){
            handleDocumentMessage(message);
        }
        else if(text == "Jalankan Notebook!"){
            try {
                const cek = await getApiReckon();
                const path = require('path');

                try {
                    fs.writeFileSync("./downloads/rekon.html", cek.data);
                    await sock.sendMessage(noWa, { document: {url: "./downloads/rekon.html"} , mimetype:'text/html', fileName:'Rekon.html'
                    , caption:'Hasil Rekon dapat diakses melalui file berikut'}, { quoted: message } );

                } catch (error) {
                    console.error('Error writing to or sending document:', error);
                }
                
            } catch (error) {
                console.error('Error running notebook:', error);
            }
        }
        else{
            const answer = await sendReply(noWa, textMessage, message);
            const messages = answer.data.data.message
            const index = answer.data.data.index
            await writeToDatabase(message.pushName, noWa, textMessage, messages, index);
        }
    }
}

/**
 * Sends a text reply to a WhatsApp number and quotes the original message.
 * @param {string} noWa - The recipient's WhatsApp number.
 * @param {string} textMessage - The message text to send.
 * @param {Object} message - The original message for quoting.
 * @returns {Promise<Object>} A promise that resolves to the API response.
 */
async function sendReply(noWa, textMessage, message) {
    if (textMessage) {
        try {
            const response = await makeApiRequest(textMessage);
            await sock.sendMessage(noWa, { text: response.data.data.message }, { quoted: message });
            return response;
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    } else {
        const nonTextMessageReply = "Mohon maaf, untuk saat ini kami hanya dapat menerima pesan text. Silahkan kirim ulang pertanyaan Anda dalam bentuk text.";
        await sock.sendMessage(noWa, { text: nonTextMessageReply });
    }
}

/**
 * Downloads and saves a document from a WhatsApp message.
 * @param {Object} message - The message object containing the document.
 * @returns {Promise<void>}
 */
async function handleDocumentMessage(message) {
    try {
        const buffer = await downloadMediaMessage(message, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
        if (buffer) {
            await fs.writeFile(`./downloads/SKI_BPOM_Terbaru.csv`, buffer);
            console.log(`Document saved: SKI_BPOM_Terbaru.csv`);
        } else {
            console.log('Document name missing, unable to save file.');
        }
    } catch (error) {
        console.error("Document handling error:", error);
    }
}

// Exporting the connectToWhatsApp function
module.exports = {
    connectToWhatsApp
};
