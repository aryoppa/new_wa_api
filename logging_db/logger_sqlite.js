/**
 * This module provides functionality for logging data to an SQLite database.
 * It includes methods to connect to the database and write log entries.
 * The database is set up to store logs in a structured table format.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to the SQLite database file
const dbPath = path.resolve(__dirname, 'logs.db');
// Database connection instance
let db;

/**
 * Establishes a connection to the SQLite database and sets up the required
 * tables and configurations if the connection is successful.
 */
function connectToDatabase() {
    // Initialize a new database connection
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.error('SQLite connection error:', err.message);
            return;
        }
        console.log('SQLite connected successfully.');

        // Configure the database and create tables if they don't exist
        db.serialize(() => {
            // Enable foreign key constraints
            db.run('PRAGMA foreign_keys = ON', error => {
                if (error) {
                    console.error('Error enabling foreign keys:', error.message);
                }
            });
            // Set the database encoding to UTF-8
            db.run('PRAGMA encoding = "UTF-8"', error => {
                if (error) {
                    console.error('Error setting encoding:', error.message);
                }
            });
            // Create the logs table with structured columns
            db.run(`CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_name TEXT,
                phone_number TEXT,
                question TEXT,
                answer TEXT,
                reference_index TEXT, -- 'index' is a reserved keyword in SQL, renamed to 'reference_index'
                timestamp TEXT
            )`, error => {
                if (error) {
                    console.error('Error creating logs table:', error.message);
                }
            });
        });
    });
}

// Immediately attempt to connect to the database upon module load
connectToDatabase();

/**
 * Writes a log entry to the database with the provided client information and conversation details.
 * 
 * @param {string} name - The name of the client.
 * @param {string} nowa - The WhatsApp number including the domain.
 * @param {string} question - The question asked by the client.
 * @param {string} response - The response given to the client.
 * @param {string} index - The index of reference from knowledge
 * @returns {Promise<void>} A promise that resolves when the log entry is written to the database.
 */
async function writeToDatabase(name, nowa, question, response, index) {
    if (!db) {
        console.error('Database connection is not established.');
        return;
    }

    // Extract the phone number and create a timestamp for the log entry
    const number = nowa?.replace('@s.whatsapp.net', '') || '';
    const timestamp = new Date().toISOString();

    // SQL query to insert the log entry into the database
    const sql = `INSERT INTO logs (client_name, phone_number, question, answer, reference_index, timestamp) VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [name, number, question, response, index, timestamp];

    // Execute the SQL query to insert the log entry
    db.run(sql, params, function(err) {
        if (err) {
            console.error('Failed to save log entry:', err.message);
        } else {
            console.log(`Log entry saved to database with ID: ${this.lastID}`);
        }
    });
}

// Export the writeToDatabase function for external use
module.exports = {
    writeToDatabase
};
