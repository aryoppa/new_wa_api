const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'logs.db');
let db;

function connectToDatabase() {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.error('SQLite connection error:', err.message);
        } else {
            console.log('SQLite connected successfully.');
            db.run(`CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client TEXT,
                phoneNumber TEXT,
                question TEXT,
                answer TEXT,
                timestamp TEXT DEFAULT (datetime('now', 'localtime'))
            )`);
        }
    });
}

connectToDatabase();

/**
 * Writes log data to SQLite.
 * 
 * @param {string} name - The name of the client.
 * @param {string} nowa - The WhatsApp number including the domain.
 * @param {string} question - The question asked by the client.
 * @param {string} response - The response given to the client.
 */
async function writeToDatabase(name, nowa, question, response) {
    if (!db) {
        console.error('Database connection is not established.');
        return;
    }

    const number = nowa?.replace('@s.whatsapp.net', ''); // Remove WhatsApp domain from number
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });

    // Save the log entry to the database
    const sql = `INSERT INTO logs (client, phoneNumber, question, answer, timestamp) VALUES (?, ?, ?, ?, ?)`;
    const params = [name, number, question, response, timestamp];

    db.run(sql, params, function(err) {
        if (err) {
            console.error('Failed to save log entry:', err.message);
        } else {
            console.log(`Log entry saved to database with ID: ${this.lastID}`);
        }
    });
}

module.exports = {
    writeToDatabase
};
