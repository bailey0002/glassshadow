/**
 * INFILTRATION GAME ENGINE
 * Core game loop, state machine, and event bus
 */

import { GameState } from './state.js';
import { GAME_PHASES, PRIORITY_TIERS } from './constants.js';

class GameEngine {
  constructor() {
    this.state = new GameState();
    this.eventBus = new EventBus();
    this.running = false;
    this.tickRate = 100; // ms between game ticks
  }

  /**
   * Initialize game with a mission file
   */
  async loadMission(missionPath) {
    const mission = await fetch(missionPath).then(r => r.json());
    
    // Load referenced environments
    for (const envId of mission.environments) {
      const env = await this.loadEnvironment(envId);
      this.state.environments.set(envId, env);
    }
    
    // Instantiate NPCs
    for (const npcDef of mission.npcs) {
      const npc = this.createNPC(npcDef);
      this.state.npcs.set(npc.id, npc);
    }
    
    // Set player starting equipment
    this.state.player.equipment = mission.starting_equipment;
    
    // Set Sloan's behavioral mode
    this.state.sloan.mode = mission.sloan_mode || 'balanced';
    
    // Set objectives
    this.state.objectives = mission.objectives;
    
    // Set starting location
    this.state.currentEnvironment = mission.environments[0];
    
    this.eventBus.emit('mission:loaded', mission);
  }

  /**
   * Main game loop
   */
  start() {
    this.running = true;
    this.loop();
  }

  loop() {
    if (!this.running) return;
    
    this.tick();
    setTimeout(() => this.loop(), this.tickRate);
  }

  tick() {
    // Update NPC states
    this.updateNPCs();
    
    // Check player conditions
    this.updatePlayerConditions();
    
    // Evaluate priorities for UI
    const priorities = this.evaluatePriorities();
    this.eventBus.emit('priorities:updated', priorities);
    
    // Check win/lose conditions
    this.checkObjectives();
  }

  /**
   * Priority evaluation - determines what the UI should emphasize
   */
  evaluatePriorities() {
    const priorities = [];
    const env = this.state.environments.get(this.state.currentEnvironment);
    
    // TIER 1: Immediate social/threat presence
    const engagedNPCs = this.getEngagedNPCs();
    if (engagedNPCs.length > 0) {
      priorities.push({
        type: 'npc-interaction',
        tier: PRIORITY_TIERS.IMMEDIATE,
        weight: 100,
        data: engagedNPCs
      });
    }
    
    // TIER 2: Environmental actions (only if Tier 1 clear)
    if (priorities.length === 0) {
      priorities.push({
        type: 'environment-actions',
        tier: PRIORITY_TIERS.ENVIRONMENTAL,
        weight: 50,
        data: this.getAvailableActions()
      });
    }
    
    // TIER 3: Inventory/self actions (always available but deprioritized)
    priorities.push({
      type: 'inventory',
      tier: PRIORITY_TIERS.SELF,
      weight: 10,
      data: this.state.player.equipment
    });
    
    // MODIFIERS: Conditions affect priority weights
    if (this.state.player.conditions.includes('high-stress')) {
      priorities.push({
        type: 'stress-overlay',
        tier: PRIORITY_TIERS.MODIFIER,
        weight: 80,
        data: { stressLevel: this.state.player.vitals.stress }
      });
    }
    
    return priorities.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Get NPCs in current environment who are aware and engaged
   */
  getEngagedNPCs() {
    const env = this.state.environments.get(this.state.currentEnvironment);
    return Array.from(this.state.npcs.values())
      .filter(npc => 
        npc.location === this.state.currentEnvironment &&
        npc.awareness !== 'unaware' &&
        npc.engaged
      );
  }

  /**
   * Get available actions based on current context
   */
  getAvailableActions() {
    const env = this.state.environments.get(this.state.currentEnvironment);
    const actions = [];
    
    // Environment-based actions
    for (const element of env.elements) {
      if (element.interactive) {
        actions.push({
          verb: element.defaultAction,
          target: element.id,
          label: `${element.defaultAction} ${element.name}`
        });
      }
    }
    
    // Movement actions
    for (const exit of env.exits) {
      actions.push({
        verb: 'move',
        target: exit.destination,
        label: `Go to ${exit.label}`
      });
    }
    
    return actions;
  }

  /**
   * Execute a player action
   */
  executeAction(action) {
    // Check if action is blocked by current priorities
    const priorities = this.evaluatePriorities();
    const topPriority = priorities[0];
    
    if (topPriority.type === 'npc-interaction' && action.verb !== 'talk' && action.verb !== 'fight' && action.verb !== 'flee') {
      this.eventBus.emit('action:blocked', {
        reason: 'npc-engaged',
        message: "You can't do that while someone is watching you."
      });
      return false;
    }
    
    // Execute the action
    const result = this.resolveAction(action);
    this.eventBus.emit('action:executed', { action, result });
    
    // Sloan may comment
    this.triggerSloan('action', action, result);
    
    return result;
  }

  /**
   * Trigger Sloan response based on context
   */
  triggerSloan(trigger, ...args) {
    this.eventBus.emit('sloan:trigger', { trigger, args });
  }

  /**
   * Update NPC states each tick
   */
  updateNPCs() {
    for (const [id, npc] of this.state.npcs) {
      // Patrol movement
      if (npc.behavior === 'patrol' && npc.patrolPath) {
        this.updatePatrol(npc);
      }
      
      // Awareness decay
      if (npc.awareness === 'suspicious' && !npc.engaged) {
        npc.suspicionTimer--;
        if (npc.suspicionTimer <= 0) {
          npc.awareness = 'unaware';
        }
      }
    }
  }

  /**
   * Update player conditions based on vitals
   */
  updatePlayerConditions() {
    const vitals = this.state.player.vitals;
    const conditions = [];
    
    if (vitals.stress > 70) conditions.push('high-stress');
    if (vitals.health < 30) conditions.push('injured');
    if (vitals.stamina < 20) conditions.push('exhausted');
    
    this.state.player.conditions = conditions;
  }
}

/**
 * Simple event bus for decoupled communication
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) callbacks.splice(index, 1);
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    for (const callback of this.listeners.get(event)) {
      callback(data);
    }
  }
}

export { GameEngine, EventBus };
