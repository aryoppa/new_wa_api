const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
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
const { writeFile } = require("fs/promises");

const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });
let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(session);
    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: "silent" }),
		shouldIgnoreJid: jid => isJidBroadcast(jid)
    });
    store.bind(sock.ev);
    sock.multi = true;
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error ? new Boom(lastDisconnect.error).output.statusCode : -1;
            const reconnect = async () => {
                console.log("Reconnecting...");
                await connectToWhatsApp();
            };

            switch (reason) {
                case DisconnectReason.badSession:
                    console.log(`Bad Session File, Please Delete ${session} and Scan Again`);
                    await sock.logout();
                    break;
                case DisconnectReason.connectionClosed:
                case DisconnectReason.connectionLost:
                case DisconnectReason.restartRequired:
                case DisconnectReason.timedOut:
                    await reconnect();
                    break;
                case DisconnectReason.loggedOut:
                    console.log(`Device Logged Out, deleting session and scanning again.`);
                    await fs.promises.rm('baileys_auth_info', { recursive: true });
                    await reconnect();
                    await sock.logout();
                    break;
                default:
                    console.error(`Unknown DisconnectReason: ${reason}|${lastDisconnect?.error}`);
                    sock.end();
                    break;
            }
        } else if (connection === 'open') {
            console.log('Bot is ready!');
            const getGroups = await sock.groupFetchAllParticipating();
            return Object.values(getGroups);
        }
    });
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const message = messages[0];
        const { key, message: msgContent } = message;
        const { remoteJid: noWa, fromMe } = key;
        const check = msgContent?.extendedTextMessage?.contextInfo;
        const targetJid = "6285880379892@s.whatsapp.net";
        const textMessage = msgContent?.conversation || msgContent?.extendedTextMessage?.text;

        // Mark the message as read
        await sock.readMessages([key]);

        // Function to handle sending replies
        const sendReply = async (content) => {
            try {
                const response = await makeApiRequest(content);
                await sock.sendMessage(noWa, { text: response.data }, { quoted: message });
            } catch (error) {
                console.error("Error sending message:", error);
            }
        };

        // Check if the message is mentioning the target Jid or is from the target participant
        if (check?.mentionedJid?.includes(targetJid) || check?.participant?.includes(targetJid)) {
            if (textMessage) {
                await sendReply(textMessage);
            } else {
                const nonTextMessageReply = "Mohon maaf, untuk saat ini kami hanya dapat menerima pesan text. Silahkan kirim ulang pertanyaan Anda dalam bentuk text.";
                await sock.sendMessage(noWa, { text: nonTextMessageReply });
            }
        } else if (!fromMe) {
            if (textMessage) {
                await sendReply(textMessage);
            } else {
                const messageType = Object.keys(msgContent)[0];
                if (messageType === 'documentMessage') {
                    try {
                        const buffer = await downloadMediaMessage(
                            message,
                            'buffer',
                            {},
                            { reuploadRequest: sock.updateMediaMessage }
                        );
                        const name = msgContent?.documentMessage?.fileName;
                        if (name) {
                            await writeFile(`./downloads/${name}`, buffer);
                        } else {
                            console.log('No file name provided, cannot save the file.');
                        }
                    } catch (error) {
                        console.error("Error handling document message:", error);
                    }
                }
            }
        }
    });

}

module.exports = {
    connectToWhatsApp,
}

