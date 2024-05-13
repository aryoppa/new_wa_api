/**
 * Configuration for the chatbot service.
 * @type {{apiUrl: string, port: number}}
 */
module.exports = {
    // The URL of the chatbot API.
    apiUrl: 'http://10.239.9.85:8000/chatbot/',
    // apiUrl: 'http://0.0.0.0:8000/chatbot/',
    // The port on which the chatbot service will run. Defaults to 8001 if not specified in the environment.
    port: process.env.PORT || 8001
};