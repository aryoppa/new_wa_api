const fs = require("fs");

/**
 * Writes log data to a CSV file.
 * 
 * @param {string} name - The name of the client.
 * @param {string} nowa - The WhatsApp number including the domain.
 * @param {string} question - The question asked by the client.
 * @param {string} response - The response given to the client.
 */
function writetoFile(name, nowa, question, response) {
    const logDir = "./logs";
    const logFile = `${logDir}/logs.csv`;
    const number = nowa?.replace('@s.whatsapp.net', ''); // Remove WhatsApp domain from number
    const data = {
        "client": name,
        "phone number": number,
        "question": question,
        "answer": response
    };

    // Ensure the logs directory exists
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    // Append the log data to the CSV file
    fs.appendFileSync(logFile, JSON.stringify(data) + "\n", {
        encoding: 'utf8',
        mode: 0o666
    });
}

module.exports = {
    writetoFile
};
