// orderMatch.js

// Constant definition
// ------------------------------------------------------
const ONE_SECOND = 1000;
const BUTTON_COOL_TIME = 10 * ONE_SECOND;
const REMOVE_FROM_WATINGLIST = 10 * ONE_SECOND;


// ------------------------------------------------------
// class OrderMatch
// ------------------------------------------------------
class OrderMatch{
  
  // constructor
  // ------------------------------------------------------
  constructor(socket) {
    // initialize
    this.socket = socket;
    OrderMatch.processingStatuses.set(this.socket, false);
  }// ------------------------------------------------------
  
  // matching: Validates the input information and performs the matching process.
  // ------------------------------------------------------
  async matching (button, contentId, uuid) {
    // Check if it is an invalid button  
    if (this.isButtonInvalid(button, contentId)) return;

    // Checks if "button press" is on cooldown
    if (this.isButtonCoolingDown(button, contentId)) return;

    // Check if processing is in progress
    if (OrderMatch.processingStatuses.get(this.socket.id)) return;
    OrderMatch.processingStatuses.set(this.socket.id, true);

    // Get Waiting Lists
    const waitingList = OrderMatch.getWaitingLists(button, contentId);

    try {
      await this.makePair(waitingList.selected, waitingList.paired, contentId, uuid);

    } catch (error) {
      console.log('Error occurred during matching process:', error);
      console.error(error.stack);
      this.socket.emit('response', 'Error occurred during matching process.');

    } finally {
      OrderMatch.processingStatuses.set(this.socket.id, false);
    }
  }// ------------------------------------------------------
  
  
  // makePair: Create a matching pair and set a timeout when waiting.
  // ------------------------------------------------------
  async makePair(waitingList, pairedWatingList, contentId, uuid) {
    // Remove the client from the waiting list after a certain time
    const timeoutId = this.setRemovalTimeout(waitingList, contentId, uuid);

    // If there is any client in waiting list(paired), make a pair
    if (pairedWatingList.length > 0) {
      const pairedClient = pairedWatingList[0];
      if (pairedClient !== uuid) {
        pairedWatingList.shift();
        clearTimeout(timeoutId); // Cancel the timeout if a pair is made
        await OrderMatch.pairProcess(uuid, pairedClient, contentId);
        this.socket.emit('response', `Making a pair: ${uuid} and ${pairedClient} contentId:${contentId}`);
      }
    }else {
      waitingList.push(uuid); // If not matched, add to waiting list.
      console.log(`Stacked ${this.socket.id} ( ${uuid} ).`);
      this.socket.emit('response', `Stacked ${this.socket.id} ( ${uuid} ) contentId:${contentId}.`);
    }
  }// ------------------------------------------------------


  // isButtonInvalid: Verify button input is disabled.
  // ------------------------------------------------------
  isButtonInvalid(button, contentId) {
    if (button !== "A" && button !== "B") {
        this.socket.emit('response', `Invalid button input. buttonId:${button} contentId:${contentId}.`);
        return true;
      }
  }// ------------------------------------------------------


  // isButtonCoolingDown: Check if the button input cooldown has finished.
  // ------------------------------------------------------
  isButtonCoolingDown(button, contentId) {
    const now = Date.now();

    if (OrderMatch.lastPressedTime.has(this.socket.id) && now - OrderMatch.lastPressedTime.get(this.socket.id) < BUTTON_COOL_TIME) {
      console.log(`${this.socket.id} tried to press button ${button} but it's still cooling down. contentId:${contentId}`);
      this.socket.emit('response', `${this.socket.id} tried to press button ${button} but it's still cooling down. contentId:${contentId}`);
      return true;
      
    } else {
      console.log(`Button ${button} pressed by ${this.socket.id} time:${now} contentId:${contentId}`);
      this.socket.emit('response', `Button ${button} pressed by ${this.socket.id} time:${now} contentId:${contentId}`);
      OrderMatch.lastPressedTime.set(this.socket.id, now); // Record the time of this button press
    }
    return false;
  }// ------------------------------------------------------


  // setRemovalTimeout: Set a timeout when waiting.
  // ------------------------------------------------------
  setRemovalTimeout(waitingList, contentId, uuid) {
    // If there is an existing timeout for this socket, do not create a new one
    if (OrderMatch.lastTimeoutId.has(this.socket.id)) return OrderMatch.lastTimeoutId.get(this.socket.id);

    const timeoutId = setTimeout(() => {
      const index = waitingList.indexOf(uuid);
      if (index !== -1) {
        const removed = waitingList.splice(index, 1);
        console.log(`Removed ${removed[0]} contentId:${contentId}.`);
        this.socket.emit('response', `Removed ${removed[0]} contentId:${contentId}.`);
        this.socket.emit('endedWaiting', {uuid: removed[0], contentId: contentId});
      }
      // After the timeout is done, remove the timeoutId from the map
      OrderMatch.lastTimeoutId.delete(this.socket.id);
    }, REMOVE_FROM_WATINGLIST);

    OrderMatch.lastTimeoutId.set(this.socket.id, timeoutId);  // Record the timeoutId of this socket

    return timeoutId;
  }// ------------------------------------------------------
  
  // static methods getWaitingLists
  // ------------------------------------------------------
  static getWaitingLists(button, contentId) {
    if (!OrderMatch.waitingLists[contentId]) {
      OrderMatch.waitingLists[contentId] = {
        A: [],
        B: []
      };
    }

    // Create a waiting list to use during processing
    const waitingList = {
        selected: OrderMatch.waitingLists[contentId][button],
        paired: OrderMatch.waitingLists[contentId][button === "A" ? "B" : "A"]
      };
    return waitingList;
  }// ------------------------------------------------------

  // static methods pairProcess: Executes processing for matched pairs.
  // ------------------------------------------------------
  static async pairProcess(selectedClient, PairedClient, contentId) {
    console.log(`Making a pair: ${selectedClient} and ${PairedClient} contentId:${contentId}`);
    // Send some message to both clients or do something...
    // Ensure this function returns a Promise
  }// ------------------------------------------------------
}
// class OrderMatch:End
// ------------------------------------------------------


// ------------------------------------------------------
// static properties
// ------------------------------------------------------
OrderMatch.lastPressedTime = new Map();  // button pressed time
OrderMatch.lastTimeoutId = new Map();  // timeoutId for each socket
OrderMatch.processingStatuses = new Map();  // processing frag for each socket
OrderMatch.waitingLists = {  // waiting client list
  contentId: {
    A: [],
    B: []
  }
};




module.exports = {OrderMatch};