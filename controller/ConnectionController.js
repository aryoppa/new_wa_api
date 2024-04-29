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
        // Connection update logic...
        const { connection, lastDisconnect } = update;
		if(connection === 'close') {
            let reason = lastDisconnect && lastDisconnect.error ? new Boom(lastDisconnect.error).output.statusCode : -1;
			switch (reason) {
				case DisconnectReason.badSession:
					console.log(`Bad Session File, Please Delete ${session} and Scan Again`);
					sock.logout();
					break;
				case DisconnectReason.connectionClosed:
					console.log("Connection closed, reconnecting....");
					connectToWhatsApp();
					break;
				case DisconnectReason.connectionLost:
					console.log("Connection Lost from Server, reconnecting...");
					connectToWhatsApp();
					break;
				case DisconnectReason.loggedOut:
					console.log(`Device Logged Out, deleting session and scanning again.`);
					fs.rm('baileys_auth_info', { recursive: true });
					connectToWhatsApp();
					sock.logout();
					break;
				case DisconnectReason.restartRequired:
					console.log("Restart Required, Restarting...");
					connectToWhatsApp();
					break;
				case DisconnectReason.timedOut:
					console.log("Connection TimedOut, Reconnecting...");
					connectToWhatsApp();
					break;
				default:
					sock.end(`Unknown DisconnectReason: ${reason}|${lastDisconnect.error}`);
					break;
			}
        }else if(connection === 'open') {
			console.log('Bot is ready!');
			let getGroups = await sock.groupFetchAllParticipating();
			let groups = Object.entries(getGroups).slice(0).map(entry => entry[1]);
			return groups;
        }
    });
    sock.ev.on("creds.update", saveCreds);
    // 
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const message = messages[0];
        // console.log(message);
        const { key, message: msgContent } = message;
        const { remoteJid: noWa, fromMe } = key;
        // console.log(key);
        const check = msgContent?.extendedTextMessage?.contextInfo;
        const targetJid = "6285880379892@s.whatsapp.net";
        // const targetJid = "6285880379892@s.whatsapp.net";
        const text = msgContent?.conversation || msgContent?.extendedTextMessage?.text;
        // console.log(msgContent);
        // if(msgContent.conversation)
        
        textMessage = text.replaceAll(/\p{Emoji}/gu, ''); // '--'

        // console.log(textMessage);
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
                const messageType = Object?.keys(msgContent)[0];
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