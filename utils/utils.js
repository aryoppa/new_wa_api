const axios = require("axios");
const { apiUrl } = require('../config');

async function makeApiRequest(text) {
    let response = null
            try {
                const postData = {
                    text : text
                };
                const headers = {
                    'Content-Type': 'application/json'
                };
                response = await axios.post(apiUrl, postData, { headers });
                
            } catch (error) {
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
            return response;
}

module.exports = {
    makeApiRequest
};