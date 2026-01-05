/**
 * GLASS SHADOW - MAIN.JS PATCH
 * 
 * Key fixes:
 * 1. Delay NPC detection on room entry (grace period)
 * 2. Fix instant mission fail
 * 3. Improve mobile event handling
 * 
 * INSTRUCTIONS:
 * Find these sections in main.js and apply the changes noted.
 */

// ==============================================
// FIX 1: Add grace period constant near top of file
// ==============================================
// Add this near other constants:

const DETECTION_GRACE_PERIOD = 3000; // 3 seconds before NPCs can detect player
const DETECTION_CHECK_INTERVAL = 1000; // Check detection every 1 second, not every frame

// ==============================================
// FIX 2: In the GlassShadow class constructor, add:
// ==============================================

// this.lastDetectionCheck = 0;
// this.roomEntryTime = 0;
// this.detectionEnabled = false;

// ==============================================
// FIX 3: Modify the room transition method
// ==============================================
// In the method that handles moving to a new room (likely called moveToRoom or similar),
// add this after setting the current room:

/*
moveToRoom(roomId) {
  // ... existing room transition code ...
  
  // Reset detection grace period
  this.roomEntryTime = Date.now();
  this.detectionEnabled = false;
  
  // Enable detection after grace period
  setTimeout(() => {
    this.detectionEnabled = true;
  }, DETECTION_GRACE_PERIOD);
  
  // ... rest of method ...
}
*/

// ==============================================
// FIX 4: Modify the game loop / tick method
// ==============================================
// Find the update/tick method and wrap NPC detection in a check:

/*
update(deltaTime) {
  // ... other update code ...
  
  // Only check detection if enough time has passed AND grace period is over
  const now = Date.now();
  if (this.detectionEnabled && (now - this.lastDetectionCheck) > DETECTION_CHECK_INTERVAL) {
    this.lastDetectionCheck = now;
    this.checkNPCDetection();
  }
  
  // ... rest of update ...
}
*/

// ==============================================
// FIX 5: Modify NPC detection to be less aggressive
// ==============================================
// Find the NPC detection check and make it incremental:

/*
checkNPCDetection() {
  const currentRoom = this.getCurrentRoom();
  if (!currentRoom) return;
  
  const npcsInRoom = this.getNPCsInRoom(currentRoom.id);
  
  for (const npc of npcsInRoom) {
    // Skip if NPC is already engaged or unconscious
    if (npc.state === 'engaged' || npc.state === 'unconscious') continue;
    
    // Calculate detection chance based on player actions, not instant
    const detectionRoll = Math.random() * 100;
    const playerDetectionLevel = this.state.player.vitals.detection || 0;
    
    // Detection threshold - harder to detect at low levels
    const threshold = 50 + (playerDetectionLevel * 0.5);
    
    if (detectionRoll < threshold && playerDetectionLevel > 20) {
      // Increment detection, don't instant-fail
      this.state.player.vitals.detection = Math.min(100, playerDetectionLevel + 10);
      
      // Only trigger engagement at high detection
      if (this.state.player.vitals.detection >= 80) {
        this.triggerNPCEngagement(npc);
      } else if (this.state.player.vitals.detection >= 50) {
        // NPC is suspicious but not engaging yet
        this.eventBus.emit('npc:suspicious', { npc, level: this.state.player.vitals.detection });
      }
    }
  }
}
*/

// ==============================================
// FIX 6: Don't instant-fail on NPC engagement
// ==============================================
// Modify triggerNPCEngagement to enter dialogue, not fail:

/*
triggerNPCEngagement(npc) {
  // Enter dialogue mode instead of instant fail
  this.eventBus.emit('npc:engaged', { npc });
  this.modeManager.pushMode('DIALOGUE');
  
  // Show NPC dialogue
  this.showNPCDialogue(npc);
  
  // Player can still talk their way out
  // Mission only fails if dialogue fails AND combat fails AND flee fails
}
*/

// ==============================================
// FIX 7: Add dialogue failure handler
// ==============================================

/*
handleDialogueFailed(npc) {
  // Increase detection significantly
  this.state.player.vitals.detection = Math.min(100, this.state.player.vitals.detection + 30);
  
  // Check for mission fail
  if (this.state.player.vitals.detection >= 100) {
    this.handleMissionFailed('You were caught by security.');
  } else {
    // NPC becomes hostile but player can still flee
    npc.state = 'hostile';
    this.modeManager.pushMode('COMBAT');
  }
}
*/

// ==============================================
// COMPLETE PATCHED DETECTION SYSTEM
// ==============================================
// If easier, replace the entire detection-related code with this:

class DetectionSystem {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.lastCheck = 0;
    this.checkInterval = 1000; // 1 second
    this.gracePeriod = 3000; // 3 seconds
    this.roomEntryTime = 0;
  }
  
  onRoomEnter() {
    this.enabled = false;
    this.roomEntryTime = Date.now();
    setTimeout(() => {
      this.enabled = true;
    }, this.gracePeriod);
  }
  
  update() {
    if (!this.enabled) return;
    
    const now = Date.now();
    if (now - this.lastCheck < this.checkInterval) return;
    this.lastCheck = now;
    
    this.checkDetection();
  }
  
  checkDetection() {
    const room = this.game.getCurrentRoom();
    if (!room) return;
    
    const npcs = this.game.getNPCsInRoom(room.id);
    const player = this.game.state.player;
    
    for (const npc of npcs) {
      if (npc.state === 'engaged' || npc.state === 'unconscious') continue;
      if (npc.awareness !== 'alert') continue; // Only alert NPCs detect
      
      // Base detection chance
      let detectChance = 10; // 10% base per check
      
      // Modifiers
      if (player.isMoving) detectChance += 15;
      if (player.isRunning) detectChance += 30;
      if (room.lighting === 'bright') detectChance += 10;
      if (room.lighting === 'dim') detectChance -= 10;
      if (player.vitals.stress > 50) detectChance += 10; // Nervous behavior
      
      // Roll
      if (Math.random() * 100 < detectChance) {
        // Incremental detection increase
        player.vitals.detection = Math.min(100, player.vitals.detection + 5);
        
        // Emit event for UI update
        this.game.eventBus.emit('detection:increased', { 
          level: player.vitals.detection,
          npc: npc.id 
        });
        
        // Thresholds
        if (player.vitals.detection >= 100) {
          this.game.handleMissionFailed('You were caught by security.');
        } else if (player.vitals.detection >= 70 && npc.state !== 'suspicious') {
          npc.state = 'suspicious';
          this.game.eventBus.emit('npc:suspicious', { npc });
          this.game.sloan.speak("They're getting suspicious. Careful.");
        } else if (player.vitals.detection >= 90 && npc.state !== 'engaged') {
          this.game.triggerNPCEngagement(npc);
        }
      }
    }
  }
}

// Export for use
if (typeof module !== 'undefined') {
  module.exports = { DetectionSystem, DETECTION_GRACE_PERIOD, DETECTION_CHECK_INTERVAL };
}
