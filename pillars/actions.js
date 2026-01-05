/**
 * ACTIONS SYSTEM
 * Pillar 5: Information gathering and execution
 */

import { ACTION_VERBS, NPC_AWARENESS } from '../core/constants.js';

/**
 * Action definition with preconditions and effects
 */
class Action {
  constructor(config) {
    this.id = config.id;
    this.verb = config.verb;
    this.label = config.label;
    this.description = config.description;
    
    // Requirements to perform this action
    this.preconditions = config.preconditions || [];
    
    // What happens when action succeeds
    this.effects = config.effects || [];
    
    // Skill check requirements
    this.skillCheck = config.skillCheck || null;
    
    // Time cost in game ticks
    this.duration = config.duration || 1;
    
    // Does this action make noise?
    this.noiseLevel = config.noiseLevel || 0;
    
    // Does this action increase detection?
    this.detectionRisk = config.detectionRisk || 0;
    
    // Stamina cost
    this.staminaCost = config.staminaCost || 0;
  }

  /**
   * Check if action can be performed in current context
   */
  canExecute(state, target) {
    for (const precondition of this.preconditions) {
      if (!this.checkPrecondition(precondition, state, target)) {
        return {
          canExecute: false,
          reason: precondition.failMessage || 'Cannot perform this action'
        };
      }
    }
    return { canExecute: true };
  }

  checkPrecondition(precondition, state, target) {
    switch (precondition.type) {
      case 'hasItem':
        return state.player.equipment.includes(precondition.item);
      
      case 'noNPCsEngaged':
        return !state.getNPCsInCurrentRoom().some(npc => 
          npc.awareness !== 'unaware' && npc.engaged
        );
      
      case 'npcState':
        const npc = state.npcs.get(target);
        return npc && npc.awareness === precondition.state;
      
      case 'environmentAttribute':
        const env = state.environments.get(state.currentEnvironment);
        return env.attributes[precondition.attribute] === precondition.value;
      
      case 'playerConditionAbsent':
        return !state.player.conditions.includes(precondition.condition);
      
      case 'staminaMin':
        return state.player.vitals.stamina >= precondition.amount;
      
      case 'accessLevel':
        return state.player.equipment.some(item => {
          const itemDef = state.getEquipment(item);
          return itemDef.accessLevel >= precondition.level;
        });
      
      default:
        return true;
    }
  }
}

/**
 * Registry of all available actions
 */
const ActionRegistry = {
  // OBSERVATION ACTIONS
  look: new Action({
    id: 'look',
    verb: ACTION_VERBS.LOOK,
    label: 'Look around',
    description: 'Survey your surroundings',
    preconditions: [],
    effects: [
      { type: 'revealElements', scope: 'room' },
      { type: 'revealNPCs', scope: 'room' }
    ],
    duration: 1,
    noiseLevel: 0,
    detectionRisk: 5
  }),

  examine: new Action({
    id: 'examine',
    verb: ACTION_VERBS.EXAMINE,
    label: 'Examine',
    description: 'Look more closely at something',
    preconditions: [
      { type: 'noNPCsEngaged', failMessage: "You can't examine that while being watched" }
    ],
    effects: [
      { type: 'revealContents', target: 'selected' },
      { type: 'gatherIntel', target: 'selected' }
    ],
    duration: 2,
    noiseLevel: 0,
    detectionRisk: 10
  }),

  listen: new Action({
    id: 'listen',
    verb: ACTION_VERBS.LISTEN,
    label: 'Listen',
    description: 'Try to hear what\'s nearby',
    preconditions: [],
    effects: [
      { type: 'revealNPCs', scope: 'adjacent' },
      { type: 'revealConversations', scope: 'room' }
    ],
    duration: 2,
    noiseLevel: 0,
    detectionRisk: 0
  }),

  search: new Action({
    id: 'search',
    verb: ACTION_VERBS.SEARCH,
    label: 'Search',
    description: 'Thoroughly search an area or container',
    preconditions: [
      { type: 'noNPCsEngaged', failMessage: "Too risky to search while being watched" }
    ],
    effects: [
      { type: 'revealHiddenItems', target: 'selected' },
      { type: 'revealSecrets', target: 'selected' }
    ],
    duration: 5,
    noiseLevel: 1,
    detectionRisk: 20,
    staminaCost: 5
  }),

  // MOVEMENT ACTIONS
  move: new Action({
    id: 'move',
    verb: ACTION_VERBS.MOVE,
    label: 'Move',
    description: 'Walk to a new location',
    preconditions: [],
    effects: [
      { type: 'changeLocation', target: 'selected' }
    ],
    duration: 3,
    noiseLevel: 2,
    detectionRisk: 15,
    staminaCost: 2
  }),

  sneak: new Action({
    id: 'sneak',
    verb: ACTION_VERBS.SNEAK,
    label: 'Sneak',
    description: 'Move quietly and carefully',
    preconditions: [
      { type: 'staminaMin', amount: 10, failMessage: "Too tired to move carefully" }
    ],
    effects: [
      { type: 'changeLocation', target: 'selected' }
    ],
    duration: 6,
    noiseLevel: 0,
    detectionRisk: 5,
    staminaCost: 10
  }),

  run: new Action({
    id: 'run',
    verb: ACTION_VERBS.RUN,
    label: 'Run',
    description: 'Sprint to a location',
    preconditions: [
      { type: 'staminaMin', amount: 20, failMessage: "Not enough stamina to run" }
    ],
    effects: [
      { type: 'changeLocation', target: 'selected' }
    ],
    duration: 1,
    noiseLevel: 4,
    detectionRisk: 40,
    staminaCost: 20
  }),

  hide: new Action({
    id: 'hide',
    verb: ACTION_VERBS.HIDE,
    label: 'Hide',
    description: 'Take cover behind something',
    preconditions: [
      { type: 'coverAvailable', failMessage: "Nothing to hide behind here" }
    ],
    effects: [
      { type: 'setHidden', value: true },
      { type: 'reduceDetection', amount: 30 }
    ],
    duration: 2,
    noiseLevel: 1,
    detectionRisk: 0,
    staminaCost: 5
  }),

  // INTERACTION ACTIONS
  take: new Action({
    id: 'take',
    verb: ACTION_VERBS.TAKE,
    label: 'Take',
    description: 'Pick up an item',
    preconditions: [
      { type: 'noNPCsEngaged', failMessage: "Can't take that while being watched" },
      { type: 'itemPickupable', failMessage: "Can't pick that up" }
    ],
    effects: [
      { type: 'addToInventory', target: 'selected' },
      { type: 'removeFromEnvironment', target: 'selected' }
    ],
    duration: 1,
    noiseLevel: 0,
    detectionRisk: 10
  }),

  use: new Action({
    id: 'use',
    verb: ACTION_VERBS.USE,
    label: 'Use',
    description: 'Use an item or interact with something',
    preconditions: [],
    effects: [
      { type: 'executeItemEffect', target: 'selected' }
    ],
    duration: 2,
    noiseLevel: 1,
    detectionRisk: 5
  }),

  // TECHNICAL ACTIONS
  hack: new Action({
    id: 'hack',
    verb: ACTION_VERBS.HACK,
    label: 'Hack',
    description: 'Attempt to access a computer system',
    preconditions: [
      { type: 'noNPCsEngaged', failMessage: "Can't hack while being watched" },
      { type: 'targetIsComputer', failMessage: "Nothing to hack here" }
    ],
    skillCheck: {
      skill: 'hacking',
      baseDifficulty: 50,
      modifiedBy: ['fineMotor']
    },
    effects: [
      { type: 'accessSystem', target: 'selected' },
      { type: 'revealData', target: 'selected' }
    ],
    duration: 10,
    noiseLevel: 0,
    detectionRisk: 5,
    staminaCost: 0
  }),

  lockpick: new Action({
    id: 'lockpick',
    verb: ACTION_VERBS.LOCKPICK,
    label: 'Pick Lock',
    description: 'Attempt to open a lock without a key',
    preconditions: [
      { type: 'hasItem', item: 'lockpick-set', failMessage: "Need lockpicks" },
      { type: 'noNPCsEngaged', failMessage: "Can't pick locks while being watched" }
    ],
    skillCheck: {
      skill: 'lockpicking',
      baseDifficulty: 60,
      modifiedBy: ['fineMotor']
    },
    effects: [
      { type: 'unlockTarget', target: 'selected' }
    ],
    duration: 8,
    noiseLevel: 1,
    detectionRisk: 15,
    staminaCost: 5
  }),

  // SOCIAL ACTIONS
  talk: new Action({
    id: 'talk',
    verb: ACTION_VERBS.TALK,
    label: 'Talk',
    description: 'Initiate conversation',
    preconditions: [
      { type: 'npcPresent', failMessage: "No one to talk to" }
    ],
    effects: [
      { type: 'startDialogue', target: 'selected' }
    ],
    duration: 1,
    noiseLevel: 2,
    detectionRisk: 0
  }),

  distract: new Action({
    id: 'distract',
    verb: ACTION_VERBS.DISTRACT,
    label: 'Distract',
    description: 'Create a diversion',
    preconditions: [],
    effects: [
      { type: 'createDistraction', target: 'selected' },
      { type: 'redirectNPCAttention', scope: 'room' }
    ],
    duration: 2,
    noiseLevel: 3,
    detectionRisk: 30,
    staminaCost: 5
  }),

  // COMBAT ACTIONS
  subdue: new Action({
    id: 'subdue',
    verb: ACTION_VERBS.SUBDUE,
    label: 'Subdue',
    description: 'Non-lethal takedown',
    preconditions: [
      { type: 'npcVulnerable', failMessage: "Target is not vulnerable" },
      { type: 'staminaMin', amount: 30, failMessage: "Too tired for takedown" }
    ],
    skillCheck: {
      skill: 'combat',
      baseDifficulty: 40,
      modifiedBy: ['combat']
    },
    effects: [
      { type: 'subdueNPC', target: 'selected' },
      { type: 'addStress', amount: 15 }
    ],
    duration: 3,
    noiseLevel: 2,
    detectionRisk: 50,
    staminaCost: 30
  }),

  flee: new Action({
    id: 'flee',
    verb: ACTION_VERBS.FLEE,
    label: 'Flee',
    description: 'Disengage and escape',
    preconditions: [
      { type: 'exitAvailable', failMessage: "No way out" }
    ],
    effects: [
      { type: 'disengageAllNPCs' },
      { type: 'changeLocation', target: 'nearestExit' },
      { type: 'addStress', amount: 20 }
    ],
    duration: 1,
    noiseLevel: 4,
    detectionRisk: 60,
    staminaCost: 25
  })
};

/**
 * Action resolver - executes actions and determines outcomes
 */
class ActionResolver {
  constructor(state, eventBus) {
    this.state = state;
    this.eventBus = eventBus;
  }

  /**
   * Attempt to execute an action
   */
  execute(actionId, target) {
    const action = ActionRegistry[actionId];
    if (!action) {
      return { success: false, message: 'Unknown action' };
    }

    // Check preconditions
    const check = action.canExecute(this.state, target);
    if (!check.canExecute) {
      return { success: false, message: check.reason };
    }

    // Perform skill check if required
    if (action.skillCheck) {
      const skillResult = this.performSkillCheck(action.skillCheck);
      if (!skillResult.success) {
        return { 
          success: false, 
          message: 'Failed skill check',
          partial: skillResult.partial
        };
      }
    }

    // Apply effects
    const results = [];
    for (const effect of action.effects) {
      const result = this.applyEffect(effect, target);
      results.push(result);
    }

    // Apply costs
    this.state.updateVitals({ stamina: -action.staminaCost });
    this.state.updateVitals({ detection: action.detectionRisk });

    // Generate noise (alerts nearby NPCs)
    if (action.noiseLevel > 0) {
      this.generateNoise(action.noiseLevel);
    }

    this.eventBus.emit('action:completed', { action, target, results });

    return { success: true, results };
  }

  performSkillCheck(check) {
    const baseChance = 100 - check.baseDifficulty;
    let modifier = 0;

    // Apply condition modifiers
    for (const mod of check.modifiedBy) {
      modifier += this.state.player.getEffectModifier(mod);
    }

    const finalChance = Math.max(5, Math.min(95, baseChance + modifier));
    const roll = Math.random() * 100;

    return {
      success: roll < finalChance,
      partial: roll < finalChance + 20 // Close enough for partial success
    };
  }

  applyEffect(effect, target) {
    // Effect application would be implemented here
    // Each effect type maps to a state change
    return { effect: effect.type, applied: true };
  }

  generateNoise(level) {
    const npcsInRoom = this.state.getNPCsInCurrentRoom();
    for (const npc of npcsInRoom) {
      if (npc.awareness === 'unaware' && level >= 2) {
        npc.vitals.addSuspicion(level * 10);
      }
    }
  }
}

export { Action, ActionRegistry, ActionResolver };
