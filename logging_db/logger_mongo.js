const mongoose = require("mongoose");

// Connect to MongoDB with connection options
const dbOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 10s
};

mongoose.connect('mongodb://0.0.0.0:27017/logs', dbOptions)
    .then(() => console.log('MongoDB connected successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define a schema for the log
const logSchema = new mongoose.Schema({
    client: String,
    phoneNumber: String,
    question: String,
    answer: String,
    timestamp: { type: Date, default: () => new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }) }
});

// Create a model from the schema
const Log = mongoose.model('Log', logSchema);

/**
 * Writes log data to MongoDB.
 * 
 * @param {string} name - The name of the client.
 * @param {string} nowa - The WhatsApp number including the domain.
 * @param {string} question - The question asked by the client.
 * @param {string} response - The response given to the client.
 */
async function writeToDatabase(name, nowa, question, response) {
    const number = nowa?.replace('@s.whatsapp.net', ''); // Remove WhatsApp domain from number
    const logEntry = new Log({
        client: name,
        phoneNumber: number,
        question: question,
        answer: response,
        timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
    });

    // Save the log entry to the database
    try {
        const savedLogEntry = await logEntry.save();
        console.log('Log entry saved to database:', savedLogEntry);
    } catch (err) {
        if (err.name === 'MongooseTimeoutError') {
            console.error('Failed to save log entry due to MongoDB timeout:', err);
        } else {
            console.error('Failed to save log entry:', err);
        }
    }
}

module.exports = {
    writeToDatabase
};
