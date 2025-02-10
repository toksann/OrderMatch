// ------------------------------------------------------
// server.js
// ------------------------------------------------------

// initial configuration
// ------------------------------------------------------
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

app.use(cors());
// ------------------------------------------------------

// import module
// ------------------------------------------------------
const CONFIG = require('./src/utils/config.js');
const {IntentManager} = require('./src/utils/intentManager.js');
const {OrderMatch} = require('./src/utils/orderMatch.js');


// global variables
// ------------------------------------------------------
const uuidToSocketIds = new Map(); // Link UUID and socket
const checkIntervals = {};  // An object that holds a survival check timer for each socket ID
const socketTimeouts = {}; // Object that holds the survival check timer
// global variables:End


// Put the server into standby mode
server.listen(process.env.PORT || CONFIG.PORT, () => {
    console.log("Server is running");
});

// ------------------------------------------------------
// server start processing
// ------------------------------------------------------
io.on('start', () => {
  // initialize
  uuidToSocketIds.clear();
});
// server start processing:End
// ------------------------------------------------------


// ------------------------------------------------------
// socket.io processing
// ------------------------------------------------------
io.on("connection", (socket) => {
  console.log("a user connected ID: ", socket.id, " Remaining Sockets :", uuidToSocketIds.size);
  let requestUuid = false;

  // Set and start the connection confirmation timer
  startSurvivalCheck(socket, socketTimeouts, checkIntervals, CONFIG);
  const handleUUID = handleSurvivalResponse(socket, socketTimeouts, requestUuid);

  
  // linking UUID and socket.id (temporary multiple management allowed)
  const socketIdToUuid = {socketId: {uuid: undefined}};
  
  socket.on("return UUID", (uuid) => {
    const existingSocketIds = linkUuidToSocket(uuid, socket, uuidToSocketIds);  // global link
    socketIdToUuid[socket.id] = uuid;  // local link
    console.log("Updated sockets linked with UUID: ", uuid, " Current socketIDs: ", existingSocketIds);
    requestUuid = true;
  });
  
  
  // Real-time matching processing
  // ------------------------------------------------------
  const orderMatch = new OrderMatch(socket);
  
  socket.on("button pressed", async ({ button, contentId }) => {
    if (socketIdToUuid[socket.id]) {
      orderMatch.matching(button, contentId, socketIdToUuid[socket.id]);
    } else {
      console.log("UUID is 'Undefined'! Order is invalid.");
    }
  });
  
  
  // Intent Count processing
  // ------------------------------------------------------
  const socketIntent = new IntentManager();
  intentManage(socket, socketIntent);  // Handles message exchanges with clients.
  // Intent Count processing:End
  // ------------------------------------------------------
  
  
  // disconnect processing
  // ------------------------------------------------------
  socket.on('disconnect', () => {
    // IntentManager termination processing
    // ------------------------------------------------------
    const afterIntents = socketIntent.cleanUpIntent();
    
    // Broadcast the results of termination processing async.
    afterIntents.forEach(({contentId, intent}) => {
      io.emit('intentCount', {contentId: contentId, A:intent.A, B: intent.B});  // return information to all client
    });
    // ------------------------------------------------------
 
    
    // Clear the connection confirmation timer
    clearSurvivalCheckers(socket.id, checkIntervals, socketTimeouts);
    
    
    // Process to delete disconnected socket.id
    const uuid = socketIdToUuid[socket.id];
    removeDisconnectedSocket(uuid, socket, uuidToSocketIds) ;
    
    
    console.log("a user disconnected ID: ", socket.id, " UUID :", uuid, " Remaining Sockets :", uuidToSocketIds.size);
  });
  // disconnect processing:End
  // ------------------------------------------------------
});
// socket.io processing:End
// ------------------------------------------------------



// functions sector
// ------------------------------------------------------

// ------------------------------------------------------
// function startSurvivalCheck
// ------------------------------------------------------
function startSurvivalCheck(socket, socketTimeouts, checkIntervals, CONFIG) {
  const checkAlive = () => {
    socket.emit("are you alive");

    socketTimeouts[socket.id] = setTimeout(() => {
      if (!socket.connected) return;
      socket.disconnect(true);
    }, CONFIG.DISCONNECT_SOCKET_WAIT_TIME);
  };

  // Schedule the first checking
  checkIntervals[socket.id] = setInterval(checkAlive, CONFIG.CHECK_INTERVAL);
}
// function startSurvivalCheck:End
// ------------------------------------------------------


// ------------------------------------------------------
// function handleSurvivalResponse
// ------------------------------------------------------
function handleSurvivalResponse(socket, socketTimeouts, requestUuid) {
  let handleUuID = undefined;
  socket.on("im alive", (uuid) => {
    if (uuid) {
      console.log("Still alive ID: ", socket.id, " UUID: ", uuid, " Requested :", requestUuid);
      handleUuID = uuid;
      
      if (requestUuid) {
        clearTimeout(socketTimeouts[socket.id]);
        delete socketTimeouts[socket.id];
        console.log("ID", socket.id, "allowed to continue to 'Still alive'");
      } else {
        console.log("UUID is 'Not Requested'!"," Still alive ID: ", socket.id, " Requested :", requestUuid);
      }      
    } else {
      console.log("UUID is 'Undefined'!"," Still alive ID: ", socket.id, " Requested :", requestUuid);
    }
  });
  return handleUuID;
}
// function handleSurvivalResponse:End
// ------------------------------------------------------


// ------------------------------------------------------
// function clearSurvivalCheckers
// ------------------------------------------------------
function clearSurvivalCheckers(socketId, checkIntervals, socketTimeouts) {
  // Remove socket response request timeout
  if (checkIntervals[socketId]) {
    clearInterval(checkIntervals[socketId]); // clear timer
    delete checkIntervals[socketId]; // Delete checker object
  }

  // Remove socket response wait timeout
  if (socketTimeouts[socketId]) {
    clearTimeout(socketTimeouts[socketId]); // clear timer
    delete socketTimeouts[socketId]; // Delete timer object
  }
}
// function clearSurvivalCheckers:End
// ------------------------------------------------------


// ------------------------------------------------------
// function linkUuidToSocket
// ------------------------------------------------------
function linkUuidToSocket (uuid, socket, uuidToSocketIds) {
  let existingSocketIds = uuidToSocketIds.get(uuid) || [];

  // If the existing socket.id and current socket.id are different, disconnect the existing one and remove it from the array
  existingSocketIds = existingSocketIds.filter(existingSocketId => {
    if (existingSocketId !== socket.id) {
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        existingSocket.disconnect(true);
        console.log("Disconnected an old socket instance for UUID: ", uuid, " socketID: ", existingSocketId);
        return false; // This socket.id is no longer needed, so remove it from the filter results
      }
    }
    return true; // Leave the current socket.id or the ID that could not be disconnected
  });

  // Add current socket.id if it is not in the existing list
  if (!existingSocketIds.includes(socket.id)) {
    existingSocketIds.push(socket.id);
  }

  // Update Map with updated list
  uuidToSocketIds.set(uuid, existingSocketIds);
  
  return existingSocketIds;
}
// function linkUuidToSocket:End
// ------------------------------------------------------


// ------------------------------------------------------
// function removeDisconnectedSocket
// ------------------------------------------------------
function removeDisconnectedSocket (uuid, socket, uuidToSocketIds) {
  if (uuid) {
    const socketIds = uuidToSocketIds.get(uuid);  // Find the socket.id corresponding to the uuid, which may have more than one.
    if (socketIds) {
      const index = socketIds.indexOf(socket.id);
      if (index !== -1) {
        socketIds.splice(index, 1); // remove that socket.id from the list
        if (socketIds.length === 0) {
          uuidToSocketIds.delete(uuid); // If the list becomes empty, remove that UUID from the Map as well
        } else {
          uuidToSocketIds.set(uuid, socketIds); // Update Map with updated list
        }
      }
    }
  }
}
// function removeDisconnectedSocket:End
// ------------------------------------------------------


// ------------------------------------------------------
// function intentManage
// ------------------------------------------------------
function intentManage (socket, socketIntent) {
  
  // only returns "intent count" to client
  socket.on("request intent", (contentId) => {
    socketIntent.updateContentList(contentId);
    const intent = IntentManager.getIntentCountLists(contentId);
    socket.emit('intentCount', {contentId: contentId, A:intent.A, B: intent.B});
  });
  
  // increment A
  socket.on("Express Intent A", (contentId) => {
    const intent = socketIntent.expressIntent(contentId, 'A');
    io.emit('intentCount', {contentId: contentId, A:intent.A, B: intent.B});
  });
  
  // decrement A
  socket.on("Cancel Intent A", (contentId) => {
    const intent = socketIntent.cancelIntent(contentId, 'A');
    io.emit('intentCount', {contentId: contentId, A:intent.A, B: intent.B});
  });
  
  // increment B
  socket.on("Express Intent B", (contentId) => {
    const intent = socketIntent.expressIntent(contentId, 'B');
    io.emit('intentCount', {contentId: contentId, A:intent.A, B: intent.B});
  });
  
  // decrement B
  socket.on("Cancel Intent B", (contentId) => {
    const intent = socketIntent.cancelIntent(contentId, 'B');
    io.emit('intentCount', {contentId: contentId, A:intent.A, B: intent.B});
  });
}
// function intentManage:End
// ------------------------------------------------------