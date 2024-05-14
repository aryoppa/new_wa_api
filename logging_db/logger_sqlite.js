/**
 * This module provides functionality for logging data to an SQLite database.
 * It includes methods to connect to the database and write log entries.
 * The database is set up to store logs with JSON data.
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
        } else {
            console.log('SQLite connected successfully.');
        }

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
            // Load the JSON1 extension for JSON support
            db.run('SELECT load_extension("json1")', error => {
                if (error) {
                    console.error('Could not load the json1 extension:', error.message);
                }
            });
            // Create the logs table with an auto-incrementing ID and a JSON data field
            db.run(`CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data JSON
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
 * @returns {Promise<void>} A promise that resolves when the log entry is written to the database.
 */
async function writeToDatabase(name, nowa, question, response) {
    if (!db) {
        console.error('Database connection is not established.');
        return;
    }

    // Extract the phone number and create a timestamp for the log entry
    const number = nowa?.replace('@s.whatsapp.net', '') || '';
    const timestamp = new Date().toISOString();

    // Construct the log entry as a JSON object
    const logEntry = {
        client: name,
        phoneNumber: number,
        question: question,
        answer: response,
        timestamp: timestamp
    };

    // SQL query to insert the log entry into the database
    const sql = `INSERT INTO logs (data) VALUES (?)`;
    const params = [JSON.stringify(logEntry)];

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
