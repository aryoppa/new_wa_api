// const qrcode = require("qrcode");
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
            // console.log(response.data.message);
            return response;
}

// function updateQR(data, soket) {
//     switch (data) {
//         case "qr":
//             qrcode.toDataURL(qr, (err, url) => {
//                 soket?.emit("qr", url);
//                 soket?.emit("log", "QR Code received, please scan!");
//             });
//             break;
//         case "connected":
//             soket?.emit("qrstatus", "./assets/check.svg");
//             soket?.emit("log", "WhatsApp terhubung!");
//             break;
//         case "qrscanned":
//             soket?.emit("qrstatus", "./assets/check.svg");
//             soket?.emit("log", "QR Code Telah discan!");
//             break;
//         case "loading":
//             soket?.emit("qrstatus", "./assets/loader.gif");
//             soket?.emit("log", "Registering QR Code , please wait!");
//             break;
//         default:
//             break;
//     }
// }

module.exports = {
    makeApiRequest,
    // updateQR
};