/**
 * GAME STATE MANAGEMENT
 * Central source of truth for all game data
 */

class GameState {
  constructor() {
    // Current environment the player is in
    this.currentEnvironment = null;
    
    // All loaded environments (Map: id -> Environment)
    this.environments = new Map();
    
    // All active NPCs (Map: id -> NPC)
    this.npcs = new Map();
    
    // Player state
    this.player = {
      vitals: {
        health: 100,
        stamina: 100,
        stress: 0,
        detection: 0  // 0-100, how close to being caught
      },
      conditions: [],  // Active condition modifiers
      equipment: [],   // Current inventory
      position: { x: 0, y: 0 }  // Position within current environment
    };
    
    // Sloan state
    this.sloan = {
      mode: 'balanced',       // cautious, balanced, aggressive
      connectionQuality: 100, // Degrades with player stress/injury
      lastMessage: null,
      cooldown: 0             // Ticks until Sloan can speak again
    };
    
    // Mission objectives
    this.objectives = [];
    
    // Game phase
    this.phase = 'exploration';  // exploration, dialogue, combat, stealth, cutscene
    
    // Discovered information
    this.intel = [];
    
    // Global flags for story progression
    this.flags = new Map();
  }

  /**
   * Get a snapshot of state for UI rendering
   */
  getSnapshot() {
    return {
      environment: this.currentEnvironment,
      player: { ...this.player },
      sloan: { ...this.sloan },
      phase: this.phase,
      npcsInRoom: this.getNPCsInCurrentRoom()
    };
  }

  /**
   * Get all NPCs in the current environment
   */
  getNPCsInCurrentRoom() {
    return Array.from(this.npcs.values())
      .filter(npc => npc.location === this.currentEnvironment);
  }

  /**
   * Update player vitals with bounds checking
   */
  updateVitals(changes) {
    for (const [key, delta] of Object.entries(changes)) {
      if (this.player.vitals.hasOwnProperty(key)) {
        this.player.vitals[key] = Math.max(0, Math.min(100, 
          this.player.vitals[key] + delta
        ));
      }
    }
    
    // Stress affects Sloan connection
    this.sloan.connectionQuality = Math.max(0, 100 - this.player.vitals.stress);
  }

  /**
   * Add or remove equipment
   */
  addEquipment(itemId) {
    if (!this.player.equipment.includes(itemId)) {
      this.player.equipment.push(itemId);
      return true;
    }
    return false;
  }

  removeEquipment(itemId) {
    const index = this.player.equipment.indexOf(itemId);
    if (index > -1) {
      this.player.equipment.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Set a story flag
   */
  setFlag(key, value = true) {
    this.flags.set(key, value);
  }

  /**
   * Check a story flag
   */
  hasFlag(key) {
    return this.flags.get(key) === true;
  }

  /**
   * Save state to JSON (for save/load functionality)
   */
  serialize() {
    return JSON.stringify({
      currentEnvironment: this.currentEnvironment,
      player: this.player,
      sloan: this.sloan,
      objectives: this.objectives,
      phase: this.phase,
      intel: this.intel,
      flags: Array.from(this.flags.entries()),
      npcs: Array.from(this.npcs.entries()).map(([id, npc]) => [id, npc.serialize()])
    });
  }

  /**
   * Load state from JSON
   */
  deserialize(json) {
    const data = JSON.parse(json);
    this.currentEnvironment = data.currentEnvironment;
    this.player = data.player;
    this.sloan = data.sloan;
    this.objectives = data.objectives;
    this.phase = data.phase;
    this.intel = data.intel;
    this.flags = new Map(data.flags);
    // NPCs would need to be reinstantiated from their serialized form
  }
}

export { GameState };
