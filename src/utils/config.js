// config.js

// Constant definition
// ------------------------------------------------------
const ONE_SECOND = 1000;
const ONE_MINUTES = 60 * ONE_SECOND;
const CONFIG = {
  DISCONNECT_SOCKET_WAIT_TIME: ONE_MINUTES * 0.25,
  CHECK_INTERVAL: ONE_MINUTES * 10,
  PORT: 3000,
};
    
module.exports = CONFIG;