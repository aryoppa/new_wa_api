
/**
 * Establishes a connection to WhatsApp service.
 * It imports the connection function from the ConnectionController module
 * and handles any unexpected errors that may occur during the connection process.
 */
const { connectToWhatsApp } = require("./controller/ConnectionController");

// Attempt to connect to WhatsApp and log any unexpected errors.
connectToWhatsApp().catch(err => {
  console.error("Unexpected error during WhatsApp connection:", err);
});
