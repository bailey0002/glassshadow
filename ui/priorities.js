/**
 * PRIORITY SYSTEM
 * Attention hierarchy logic - determines what the UI emphasizes
 */

import { PRIORITY_TIERS, GAME_PHASES, NPC_AWARENESS, VITAL_THRESHOLDS } from '../core/constants.js';

/**
 * Priority Manager - evaluates game state to determine UI focus
 */
class PriorityManager {
  constructor() {
    this.priorityCache = null;
    this.lastEvaluation = 0;
    this.cacheLifetime = 100; // ms before re-evaluation
  }

  /**
   * Get current priorities based on game state
   */
  evaluate(state, environments, npcs) {
    const now = Date.now();
    if (this.priorityCache && (now - this.lastEvaluation) < this.cacheLifetime) {
      return this.priorityCache;
    }

    const priorities = [];
    const currentEnv = environments.get(state.currentEnvironment);

    // TIER 0 (MODIFIER): Conditions that overlay everything
    const uiModifiers = this.getUIModifiers(state);
    if (uiModifiers.hasEffects) {
      priorities.push({
        type: 'condition-overlay',
        tier: PRIORITY_TIERS.MODIFIER,
        weight: 90,
        data: uiModifiers
      });
    }

    // TIER 1 (IMMEDIATE): NPC interactions and threats
    const combatants = this.getCombatants(state, npcs);
    if (combatants.length > 0) {
      priorities.push({
        type: 'combat',
        tier: PRIORITY_TIERS.IMMEDIATE,
        weight: 100,
        data: combatants
      });
    }

    const engagedNPCs = this.getEngagedNPCs(state, npcs);
    if (engagedNPCs.length > 0 && combatants.length === 0) {
      priorities.push({
        type: 'npc-interaction',
        tier: PRIORITY_TIERS.IMMEDIATE,
        weight: 95,
        data: engagedNPCs
      });
    }

    // Critical conditions
    const criticalConditions = this.getCriticalConditions(state);
    if (criticalConditions.length > 0) {
      priorities.push({
        type: 'critical-status',
        tier: PRIORITY_TIERS.IMMEDIATE,
        weight: 85,
        data: criticalConditions
      });
    }

    // TIER 2 (ENVIRONMENTAL): Room actions and objects
    const nearbyNPCs = this.getNearbyNPCs(state, npcs);
    if (nearbyNPCs.length > 0 && engagedNPCs.length === 0) {
      priorities.push({
        type: 'npc-nearby',
        tier: PRIORITY_TIERS.ENVIRONMENTAL,
        weight: 60,
        data: nearbyNPCs
      });
    }

    const objectiveProximity = this.checkObjectiveProximity(state, currentEnv);
    if (objectiveProximity) {
      priorities.push({
        type: 'objective-near',
        tier: PRIORITY_TIERS.ENVIRONMENTAL,
        weight: 70,
        data: objectiveProximity
      });
    }

    const envActions = this.getEnvironmentActions(state, currentEnv);
    if (envActions.length > 0) {
      priorities.push({
        type: 'environment-actions',
        tier: PRIORITY_TIERS.ENVIRONMENTAL,
        weight: 50,
        data: envActions
      });
    }

    const interactiveElements = this.getInteractiveElements(currentEnv);
    if (interactiveElements.length > 0) {
      priorities.push({
        type: 'interactive-elements',
        tier: PRIORITY_TIERS.ENVIRONMENTAL,
        weight: 45,
        data: interactiveElements
      });
    }

    // TIER 3 (SELF): Inventory and status
    priorities.push({
      type: 'inventory',
      tier: PRIORITY_TIERS.SELF,
      weight: 20,
      data: state.player.equipment
    });

    priorities.push({
      type: 'vitals',
      tier: PRIORITY_TIERS.SELF,
      weight: 15,
      data: state.player.vitals
    });

    // Sort by weight (highest first)
    priorities.sort((a, b) => b.weight - a.weight);

    this.priorityCache = priorities;
    this.lastEvaluation = now;

    return priorities;
  }

  /**
   * Get NPCs in current room who are engaged with the player
   */
  getEngagedNPCs(state, npcs) {
    return Array.from(npcs.values())
      .filter(npc => 
        npc.location === state.currentEnvironment &&
        npc.engaged === true &&
        npc.awareness !== NPC_AWARENESS.UNAWARE &&
        !npc.vitals?.conditions?.has('unconscious')
      )
      .map(npc => ({
        id: npc.id,
        name: npc.name,
        type: npc.type,
        awareness: npc.awareness,
        position: npc.position,
        hasDialogue: !!npc.dialogueId,
        capabilities: Array.from(npc.capabilities || [])
      }));
  }

  /**
   * Get NPCs in current room who are NOT engaged (but visible)
   */
  getNearbyNPCs(state, npcs) {
    return Array.from(npcs.values())
      .filter(npc => 
        npc.location === state.currentEnvironment &&
        !npc.engaged &&
        !npc.vitals?.conditions?.has('unconscious')
      )
      .map(npc => ({
        id: npc.id,
        name: npc.name,
        type: npc.type,
        awareness: npc.awareness,
        position: npc.position,
        facing: npc.facing,
        behavior: npc.behavior
      }));
  }

  /**
   * Get NPCs currently in combat with the player
   */
  getCombatants(state, npcs) {
    return Array.from(npcs.values())
      .filter(npc => 
        npc.location === state.currentEnvironment &&
        npc.awareness === NPC_AWARENESS.HOSTILE &&
        npc.engaged === true &&
        !npc.vitals?.conditions?.has('unconscious')
      )
      .map(npc => ({
        id: npc.id,
        name: npc.name,
        type: npc.type,
        health: npc.vitals?.health || 100,
        armed: npc.hasCapability?.('armed') || false,
        position: npc.position
      }));
  }

  /**
   * Get critical conditions requiring immediate attention
   */
  getCriticalConditions(state) {
    const critical = [];

    // Health critical
    if (state.player.vitals.health <= VITAL_THRESHOLDS.HEALTH.CRITICAL) {
      critical.push({
        type: 'health-critical',
        value: state.player.vitals.health,
        message: 'Health critical!'
      });
    }

    // Stress at maximum
    if (state.player.vitals.stress >= VITAL_THRESHOLDS.STRESS.CRITICAL) {
      critical.push({
        type: 'stress-critical',
        value: state.player.vitals.stress,
        message: 'Stress overwhelming!'
      });
    }

    // Detection about to trigger
    if (state.player.vitals.detection >= VITAL_THRESHOLDS.DETECTION.SPOTTED) {
      critical.push({
        type: 'detection-critical',
        value: state.player.vitals.detection,
        message: 'About to be spotted!'
      });
    }

    // Check for specific critical conditions
    const criticalConditionNames = ['critical', 'panicked', 'bleeding'];
    for (const condition of state.player.conditions) {
      if (criticalConditionNames.includes(condition)) {
        critical.push({
          type: 'condition-critical',
          condition,
          message: `${condition.charAt(0).toUpperCase() + condition.slice(1)} condition active`
        });
      }
    }

    return critical;
  }

  /**
   * Get available actions based on current environment
   */
  getEnvironmentActions(state, environment) {
    if (!environment) return [];

    const actions = [];

    // Movement actions (exits)
    for (const exit of (environment.exits || [])) {
      const blocked = exit.locked && !this.playerHasKeycard(state, exit.keycardLevel);
      actions.push({
        verb: 'move',
        target: exit.destination,
        label: exit.label,
        type: 'movement',
        blocked,
        blockReason: blocked ? `Requires Level ${exit.keycardLevel} Keycard` : null,
        position: exit.position
      });
    }

    // Element actions
    for (const element of (environment.elements || [])) {
      if (element.interactive) {
        const action = {
          verb: element.defaultAction,
          target: element.id,
          label: `${this.capitalizeFirst(element.defaultAction)} ${element.name}`,
          type: 'interaction',
          position: element.position
        };

        // Check requirements
        if (element.requiresKeycard) {
          action.blocked = !this.playerHasKeycard(state, element.keycardLevel);
          action.blockReason = action.blocked ? `Requires Level ${element.keycardLevel} Keycard` : null;
        }

        actions.push(action);
      }
    }

    // Add universal actions
    actions.push({ verb: 'look', target: 'room', label: 'Survey Room', type: 'observation' });
    actions.push({ verb: 'listen', target: 'room', label: 'Listen', type: 'observation' });

    return actions;
  }

  /**
   * Get interactive elements in current environment
   */
  getInteractiveElements(environment) {
    if (!environment) return [];

    return (environment.elements || [])
      .filter(el => el.interactive)
      .map(el => ({
        id: el.id,
        name: el.name,
        type: el.type,
        position: el.position,
        size: el.size || { w: 1, h: 1 },
        defaultAction: el.defaultAction,
        isObjective: el.isObjective || false,
        contents: el.contents || [],
        provideCover: el.provideCover || false
      }));
  }

  /**
   * Check if an objective is in the current room
   */
  checkObjectiveProximity(state, environment) {
    if (!environment || !state.objectives) return null;

    // Check for objective elements
    const objectiveElements = (environment.elements || []).filter(el => el.isObjective);
    if (objectiveElements.length > 0) {
      return {
        type: 'objective-in-room',
        elements: objectiveElements.map(el => ({
          id: el.id,
          name: el.name,
          position: el.position
        }))
      };
    }

    // Check for reach objectives
    const reachObjectives = state.objectives.filter(
      obj => obj.type === 'reach' && 
             obj.location === environment.id && 
             !obj.completed
    );
    if (reachObjectives.length > 0) {
      return {
        type: 'reach-objective',
        objectives: reachObjectives
      };
    }

    return null;
  }

  /**
   * Calculate UI modifiers from player conditions and vitals
   */
  getUIModifiers(state) {
    const modifiers = {
      shake: 0,
      blur: 0,
      darken: 0,
      pulse: 0,
      vignette: 0,
      tint: null,
      hasEffects: false
    };

    // Stress effects
    const stress = state.player.vitals.stress;
    if (stress > VITAL_THRESHOLDS.STRESS.HIGH) {
      modifiers.shake = Math.min(1, (stress - VITAL_THRESHOLDS.STRESS.HIGH) / 30);
      modifiers.pulse = modifiers.shake * 0.5;
      modifiers.hasEffects = true;
    }
    if (stress >= VITAL_THRESHOLDS.STRESS.CRITICAL) {
      modifiers.blur = 0.3;
      modifiers.hasEffects = true;
    }

    // Health effects
    const health = state.player.vitals.health;
    if (health < VITAL_THRESHOLDS.HEALTH.WOUNDED) {
      modifiers.vignette = Math.min(1, (VITAL_THRESHOLDS.HEALTH.WOUNDED - health) / 30);
      modifiers.hasEffects = true;
    }
    if (health <= VITAL_THRESHOLDS.HEALTH.CRITICAL) {
      modifiers.tint = 'rgba(255, 0, 0, 0.1)';
      modifiers.pulse = Math.max(modifiers.pulse, 0.8);
      modifiers.hasEffects = true;
    }

    // Detection effects
    const detection = state.player.vitals.detection;
    if (detection > VITAL_THRESHOLDS.DETECTION.SUSPICIOUS) {
      modifiers.tint = `rgba(255, 165, 0, ${(detection - VITAL_THRESHOLDS.DETECTION.SUSPICIOUS) / 200})`;
      modifiers.hasEffects = true;
    }

    // Condition-based effects
    for (const condition of state.player.conditions) {
      switch (condition) {
        case 'panicked':
          modifiers.shake = Math.max(modifiers.shake, 0.6);
          modifiers.blur = Math.max(modifiers.blur, 0.2);
          modifiers.hasEffects = true;
          break;
        case 'hidden':
          modifiers.darken = 0.2;
          modifiers.hasEffects = true;
          break;
        case 'adrenaline':
          modifiers.pulse = Math.max(modifiers.pulse, 0.7);
          modifiers.tint = 'rgba(255, 100, 100, 0.05)';
          modifiers.hasEffects = true;
          break;
        case 'exhausted':
          modifiers.blur = Math.max(modifiers.blur, 0.1);
          modifiers.darken = Math.max(modifiers.darken, 0.15);
          modifiers.hasEffects = true;
          break;
      }
    }

    return modifiers;
  }

  /**
   * Check if player has a keycard of required level
   */
  playerHasKeycard(state, requiredLevel) {
    if (!requiredLevel) return true;
    
    const keycards = state.player.equipment.filter(item => 
      item.startsWith('keycard-level')
    );
    
    for (const keycard of keycards) {
      const level = parseInt(keycard.replace('keycard-level', ''));
      if (level >= requiredLevel) return true;
    }
    
    return false;
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get the top priority
   */
  getTopPriority(state, environments, npcs) {
    const priorities = this.evaluate(state, environments, npcs);
    return priorities.length > 0 ? priorities[0] : null;
  }

  /**
   * Check if in a specific game mode based on priorities
   */
  determineGameMode(state, environments, npcs) {
    const priorities = this.evaluate(state, environments, npcs);
    const top = priorities[0];

    if (!top) return GAME_PHASES.EXPLORATION;

    switch (top.type) {
      case 'combat':
        return GAME_PHASES.COMBAT;
      case 'npc-interaction':
        return top.data[0]?.hasDialogue ? GAME_PHASES.DIALOGUE : GAME_PHASES.STEALTH;
      case 'npc-nearby':
        return GAME_PHASES.STEALTH;
      default:
        return GAME_PHASES.EXPLORATION;
    }
  }

  /**
   * Clear the priority cache
   */
  invalidateCache() {
    this.priorityCache = null;
    this.lastEvaluation = 0;
  }
}

export { PriorityManager };
