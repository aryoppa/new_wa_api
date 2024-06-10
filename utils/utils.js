const axios = require("axios");
const { apiUrl_rag, apiUrl_reckon } = require('../config');

/**
 * Sends a POST request to the configured API with the provided text.
 * 
 * @param {string} text The text to be sent in the API request.
 * @returns {Promise<Object|null>} The response from the API or null in case of an error.
 */
async function makeApiRequest(text) {
    try {
        const postData = { text };
        const headers = { 'Content-Type': 'application/json' };
        return await axios.post(apiUrl_rag, postData, { headers });
    } catch (error) {
        logApiError(error);
        return null;
    }
}

/**
 * Sends a GET request to the configured API.
 * 
 * @returns {Promise<Object|null>} The response from the API or null in case of an error.
 */
async function getApiReckon(){
    try {
        return await axios.get(apiUrl_reckon);
    } catch (error) {
        logApiError(error);
        return null;
    }
}

/**
 * Logs the details of the error encountered during the API request.
 * 
 * @param {Error} error The error object caught during the API request.
 */
function logApiError(error) {
    if (error.response) {
        console.error('Server responded with a non-2xx status code:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Response headers:', error.response.headers);
    } else if (error.request) {
        console.error('No response received:', error.request);
    } else {
        console.error('Error setting up the request:', error.message);
    }
    console.error('Full error:', error);
}

module.exports = {
    makeApiRequest,
    getApiReckon
};
