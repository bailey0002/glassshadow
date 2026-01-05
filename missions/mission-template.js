/**
 * MISSION TEMPLATE
 * Base structure for loading and running missions
 */

class Mission {
  constructor(missionData, dependencies) {
    this.id = missionData.id;
    this.title = missionData.title;
    this.description = missionData.description;
    this.briefing = missionData.briefing;
    
    // Dependencies (loaded data files)
    this.environmentsData = dependencies.environments;
    this.equipmentData = dependencies.equipment;
    
    // Mission-specific references
    this.environmentIds = missionData.environments;
    this.startingEnvironment = missionData.startingEnvironment || missionData.environments[0];
    this.startingPosition = missionData.startingPosition || { x: 0, y: 0 };
    
    // NPCs to spawn
    this.npcDefinitions = missionData.npcs || [];
    
    // Starting equipment overrides
    this.startingEquipment = missionData.starting_equipment || [];
    
    // Mission objectives
    this.objectives = missionData.objectives || [];
    
    // Sloan configuration
    this.sloanMode = missionData.sloan_mode || 'balanced';
    this.sloanEnabled = missionData.sloan_enabled !== false;
    
    // Win/lose conditions
    this.winConditions = missionData.win_conditions || [];
    this.loseConditions = missionData.lose_conditions || [];
    
    // Scripted events
    this.events = missionData.events || [];
    
    // Map configuration
    this.mapConfig = missionData.map || {};
    
    // Mission state
    this.status = 'not_started';
    this.completedObjectives = new Set();
    this.triggeredEvents = new Set();
  }

  /**
   * Load all mission assets
   */
  async load() {
    // Get environment data for referenced environments
    this.environments = {};
    for (const envId of this.environmentIds) {
      if (this.environmentsData.environments[envId]) {
        this.environments[envId] = this.environmentsData.environments[envId];
      } else {
        console.warn(`Environment ${envId} not found`);
      }
    }
    
    // Resolve equipment references
    this.equipment = {};
    for (const itemId of this.startingEquipment) {
      if (this.equipmentData.equipment[itemId]) {
        this.equipment[itemId] = this.equipmentData.equipment[itemId];
      }
    }
    
    this.status = 'loaded';
    return this;
  }

  /**
   * Initialize mission in game state
   */
  initialize(gameState) {
    // Set up player
    gameState.player.equipment = [...this.startingEquipment];
    gameState.currentEnvironment = this.startingEnvironment;
    gameState.player.position = { ...this.startingPosition };
    
    // Spawn NPCs
    for (const npcDef of this.npcDefinitions) {
      const env = this.environments[npcDef.location];
      if (env) {
        const slot = env.npcSlots.find(s => s.id === npcDef.slot) || env.npcSlots[0];
        // NPC would be created here using templates + slot data
      }
    }
    
    // Set Sloan mode
    gameState.sloan.mode = this.sloanMode;
    
    // Copy objectives
    gameState.objectives = this.objectives.map(obj => ({
      ...obj,
      completed: false
    }));
    
    this.status = 'active';
    return gameState;
  }

  /**
   * Check objective completion
   */
  checkObjective(objectiveId, gameState) {
    const objective = this.objectives.find(o => o.id === objectiveId);
    if (!objective) return false;
    
    switch (objective.type) {
      case 'retrieve':
        return gameState.player.equipment.includes(objective.target);
      
      case 'reach':
        return gameState.currentEnvironment === objective.location;
      
      case 'subdue':
        const npc = gameState.npcs.get(objective.target);
        return npc && npc.vitals.conditions.has('unconscious');
      
      case 'avoid_detection':
        return gameState.player.vitals.detection < 100;
      
      case 'hack':
        // Would check if specific terminal was accessed
        return gameState.hasFlag(`hacked_${objective.target}`);
      
      default:
        return false;
    }
  }

  /**
   * Check all win/lose conditions
   */
  checkEndConditions(gameState) {
    // Check lose conditions first
    for (const condition of this.loseConditions) {
      if (this.evaluateCondition(condition, gameState)) {
        return { ended: true, result: 'failure', reason: condition.reason };
      }
    }
    
    // Check win conditions
    let allWinMet = true;
    for (const condition of this.winConditions) {
      if (!this.evaluateCondition(condition, gameState)) {
        allWinMet = false;
        break;
      }
    }
    
    if (allWinMet && this.winConditions.length > 0) {
      return { ended: true, result: 'success', reason: 'All objectives complete' };
    }
    
    return { ended: false };
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition, gameState) {
    switch (condition.type) {
      case 'all_objectives':
        return this.objectives.every(obj => this.checkObjective(obj.id, gameState));
      
      case 'player_caught':
        return gameState.player.vitals.detection >= 100;
      
      case 'player_dead':
        return gameState.player.vitals.health <= 0;
      
      case 'alarm_triggered':
        return gameState.hasFlag('alarm_active');
      
      case 'reached_exit':
        return gameState.currentEnvironment === condition.location;
      
      case 'time_expired':
        return gameState.elapsedTime >= condition.limit;
      
      default:
        return false;
    }
  }

  /**
   * Check and trigger scripted events
   */
  checkEvents(gameState, eventBus) {
    for (const event of this.events) {
      if (this.triggeredEvents.has(event.id)) continue;
      
      if (this.evaluateCondition(event.trigger, gameState)) {
        this.triggeredEvents.add(event.id);
        this.executeEvent(event, gameState, eventBus);
      }
    }
  }

  /**
   * Execute a scripted event
   */
  executeEvent(event, gameState, eventBus) {
    for (const action of event.actions) {
      switch (action.type) {
        case 'sloan_speak':
          eventBus.emit('sloan:forceSpeech', { message: action.message });
          break;
        
        case 'spawn_npc':
          // Would spawn NPC at specified location
          break;
        
        case 'lock_door':
          // Would lock specified door
          break;
        
        case 'set_flag':
          gameState.setFlag(action.flag, action.value);
          break;
        
        case 'play_narration':
          eventBus.emit('narration:play', { text: action.text });
          break;
      }
    }
  }

  /**
   * Get mission briefing for UI
   */
  getBriefing() {
    return {
      title: this.title,
      description: this.description,
      briefing: this.briefing,
      objectives: this.objectives.map(obj => ({
        id: obj.id,
        description: obj.description,
        optional: obj.optional || false
      })),
      startingEquipment: this.startingEquipment.map(id => this.equipment[id]?.name || id)
    };
  }

  /**
   * Get current mission status for UI
   */
  getStatus(gameState) {
    return {
      status: this.status,
      objectives: this.objectives.map(obj => ({
        ...obj,
        completed: this.checkObjective(obj.id, gameState)
      })),
      completedCount: this.objectives.filter(obj => 
        this.checkObjective(obj.id, gameState)
      ).length,
      totalCount: this.objectives.length
    };
  }
}

export { Mission };
