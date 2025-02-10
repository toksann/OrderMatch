// IntentManager.js

// ------------------------------------------------------
// class IntentManager
// ------------------------------------------------------
class IntentManager {
  
  // constructor
  // ------------------------------------------------------
  constructor() {
    // initialize  
    this.contentList = new Map();
    this.hasIntentSelectListA = {contentId: false};
    this.hasIntentSelectListB = {contentId: false};
  }// ------------------------------------------------------
  
  // updateContentList: Add contentId to history without overlap.
  // ------------------------------------------------------
  updateContentList(contentId) {
    this.contentList.set(contentId, true);
  }// ------------------------------------------------------

  // expressIntent: Reflects the intent of intentType for each contentId.
  // ------------------------------------------------------
  expressIntent(contentId, intentType) {
    this.updateContentList(contentId);
    
    const intentCountList = IntentManager.getIntentCountLists(contentId);
    
    if (intentType === 'A' && !this.hasIntentSelectListA[contentId]) {
      intentCountList.A++;
      this.hasIntentSelectListA[contentId] = true;
    } else if (intentType === 'B' && !this.hasIntentSelectListB[contentId]) {
      intentCountList.B++;
      this.hasIntentSelectListB[contentId] = true;
    } else {
      console.error(`argument error: contentId: ${contentId}, intentType: ${intentType}`);
    }
    
    return { A: intentCountList.A, B: intentCountList.B };
  }// ------------------------------------------------------

  // cancelIntent: Cancels the intent of intentType by contentId.
  // ------------------------------------------------------
  cancelIntent(contentId, intentType) {
    this.updateContentList(contentId);

    const intentCountList = IntentManager.getIntentCountLists(contentId);

    if (intentType === 'A' && this.hasIntentSelectListA[contentId]) {
      intentCountList.A = Math.max(0, intentCountList.A - 1);
      this.hasIntentSelectListA[contentId] = false;
    } else if (intentType === 'B' && this.hasIntentSelectListB[contentId]) {
      intentCountList.B = Math.max(0, intentCountList.B - 1);
      this.hasIntentSelectListB[contentId] = false;
    } else {
      console.error(`argument error: contentId: ${contentId}, intentType: ${intentType}`);
    }

    return { A: intentCountList.A, B: intentCountList.B };
  }// ------------------------------------------------------
  
  // cleanUpIntent: Clear Intent information by instance.
  // ------------------------------------------------------
  cleanUpIntent() {
    let updatedIntents = [];  // Aggregation of intents by contentId to use as return value
    console.log('Start clean up intents');
    
    // Iterate through the list of contentIds the client has interacted with
    this.contentList.forEach((contentId) => {
      // If both 'A' and 'B' intents are canceled, skip the process.
      if (!this.hasIntentSelectListA[contentId] && !this.hasIntentSelectListB[contentId]) return updatedIntents;
      const intentCountList = IntentManager.getIntentCountLists(contentId);
      
      // Check if the client expressed intent A for this contentId
      if (this.hasIntentSelectListA[contentId]) {
        intentCountList.A = Math.max(0, intentCountList.A - 1);  // decrement "A" count
        this.hasIntentSelectListA[contentId] = false;   // deselected "A"
        console.log('clear "A" count');
      }
      // Check if the client expressed intent B for this contentId
      if (this.hasIntentSelectListB[contentId]) {
        intentCountList.B = Math.max(0, intentCountList.B - 1);  // decrement "B" count
        this.hasIntentSelectListB[contentId] = false;  // deselected "B"
        console.log('clear "B" count');
      }
      
      updatedIntents.push({
        contentId: contentId,
        intents: {A: intentCountList.A, B: intentCountList.B,}
      });
    });
    // Clear the list for this client
    this.contentList.clear();
    
    return updatedIntents;
  }// ------------------------------------------------------
  
  // static methods getIntentCountLists
  // ------------------------------------------------------
  static getIntentCountLists(contentId) {
    if (!IntentManager.intentCountLists[contentId]) {
      IntentManager.intentCountLists[contentId] = { A: 0, B: 0 };
    }
    return IntentManager.intentCountLists[contentId];
  }// ------------------------------------------------------
}
// class IntentManager:End
// ------------------------------------------------------


// ------------------------------------------------------
// static properties
// ------------------------------------------------------
IntentManager.intentCountLists = {};  // Count of intents across servers



module.exports = {IntentManager};