const { connectToWhatsApp } = require("./controller/ConnectionController");
const { port } = require('./config');

connectToWhatsApp().catch(err => console.log("unexpected error: " + err));

