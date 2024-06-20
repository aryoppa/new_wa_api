/**
 * Configuration for the chatbot service.
 * @type {{apiUrl: string, port: number}}
 */
module.exports = {
    // The URL of the chatbot API.
    // apiUrl_rag: 'http://10.239.9.85:8006/chatbot/',
    // apiUrl_reckon: 'http://127.0.0.1:8000/run_notebook/',
    apiUrl_rag: 'http://0.0.0.0:8000/chatbot/',
    apiUrl_reckon: 'http://0.0.0.0:8002/run_notebook/',
    // The port on which the chatbot service will run. Defaults to 8001 if not specified in the environment.
    port: process.env.PORT || 8001
};