/**
 * CONDITIONS SYSTEM
 * Pillar 6: Character enhancements/constraints and effects
 */

import { CONDITION_EFFECTS } from '../core/constants.js';

/**
 * Condition definition
 */
class Condition {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    
    // How the condition is acquired
    this.triggers = config.triggers || [];
    
    // How the condition is removed
    this.cures = config.cures || [];
    
    // Stat modifiers while active
    this.modifiers = config.modifiers || {};
    
    // UI effects
    this.uiEffects = config.uiEffects || {};
    
    // Is this condition visible to the player?
    this.visible = config.visible ?? true;
    
    // Does this condition have a duration?
    this.duration = config.duration || null; // null = permanent until cured
    
    // Can stack multiple times?
    this.stackable = config.stackable || false;
    this.maxStacks = config.maxStacks || 1;
  }
}

/**
 * Registry of all conditions
 */
const ConditionRegistry = {
  // STRESS-BASED CONDITIONS
  'high-stress': new Condition({
    id: 'high-stress',
    name: 'Stressed',
    description: 'Your hands are shaking. Fine motor tasks are harder.',
    triggers: [
      { type: 'vitalThreshold', vital: 'stress', threshold: 70 }
    ],
    cures: [
      { type: 'vitalBelow', vital: 'stress', threshold: 50 }
    ],
    modifiers: {
      fineMotor: -30,
      combat: 10,
      sloanConnection: -50
    },
    uiEffects: {
      screenShake: 0.3,
      pulseOverlay: true,
      cardTremor: true
    }
  }),

  'panicked': new Condition({
    id: 'panicked',
    name: 'Panicked',
    description: 'Fight or flight is overwhelming you. Hard to think clearly.',
    triggers: [
      { type: 'vitalThreshold', vital: 'stress', threshold: 90 }
    ],
    cures: [
      { type: 'vitalBelow', vital: 'stress', threshold: 70 }
    ],
    modifiers: {
      fineMotor: -60,
      combat: 20,
      sloanConnection: -80,
      readingComprehension: -60,
      decisionMaking: -40
    },
    uiEffects: {
      screenShake: 0.6,
      visionTunnel: true,
      textGarble: 0.3,
      sloanStatic: true,
      heartbeatAudio: true
    }
  }),

  // HEALTH-BASED CONDITIONS
  'injured': new Condition({
    id: 'injured',
    name: 'Injured',
    description: 'You\'re bleeding. Movement is impaired.',
    triggers: [
      { type: 'vitalThreshold', vital: 'health', threshold: 30, below: true }
    ],
    cures: [
      { type: 'itemUse', item: 'medkit-small' },
      { type: 'vitalAbove', vital: 'health', threshold: 50 }
    ],
    modifiers: {
      movement: -40,
      stealth: -20,
      bleedRate: 2
    },
    uiEffects: {
      redVignette: true,
      bloodDrops: true,
      movementSlowed: true
    }
  }),

  'critical': new Condition({
    id: 'critical',
    name: 'Critical',
    description: 'Fading fast. Need medical attention immediately.',
    triggers: [
      { type: 'vitalThreshold', vital: 'health', threshold: 10, below: true }
    ],
    cures: [
      { type: 'itemUse', item: 'medkit-small' }
    ],
    modifiers: {
      allActions: -50,
      bleedRate: 5
    },
    uiEffects: {
      blackoutPulse: true,
      soundMuffled: true,
      sloanUrgent: true
    }
  }),

  // STAMINA-BASED CONDITIONS
  'exhausted': new Condition({
    id: 'exhausted',
    name: 'Exhausted',
    description: 'Running on empty. Everything is harder.',
    triggers: [
      { type: 'vitalThreshold', vital: 'stamina', threshold: 20, below: true }
    ],
    cures: [
      { type: 'vitalAbove', vital: 'stamina', threshold: 40 },
      { type: 'rest', duration: 10 }
    ],
    modifiers: {
      allActions: -20,
      recovery: -50,
      movement: -20
    },
    uiEffects: {
      heavyBreathing: true,
      actionsSlowed: true
    }
  }),

  // SITUATIONAL CONDITIONS
  'hidden': new Condition({
    id: 'hidden',
    name: 'Hidden',
    description: 'You\'re concealed. Stay quiet.',
    triggers: [
      { type: 'action', action: 'hide' }
    ],
    cures: [
      { type: 'action', action: 'move' },
      { type: 'detected' }
    ],
    modifiers: {
      detection: -50,
      stealth: 30
    },
    uiEffects: {
      hiddenIndicator: true,
      darkenedView: true
    }
  }),

  'spotted': new Condition({
    id: 'spotted',
    name: 'Spotted',
    description: 'Someone has seen you. Act fast.',
    triggers: [
      { type: 'vitalThreshold', vital: 'detection', threshold: 80 }
    ],
    cures: [
      { type: 'vitalBelow', vital: 'detection', threshold: 40 },
      { type: 'npcSubdued' },
      { type: 'escape' }
    ],
    modifiers: {
      stress: 10 // Adds stress each tick
    },
    uiEffects: {
      alertIndicator: true,
      urgentPulse: true,
      sloanWarning: true
    }
  }),

  // EQUIPMENT-BASED CONDITIONS
  'illuminated': new Condition({
    id: 'illuminated',
    name: 'Flashlight On',
    description: 'You can see better, but so can they.',
    triggers: [
      { type: 'itemActive', item: 'flashlight' }
    ],
    cures: [
      { type: 'itemDeactivate', item: 'flashlight' }
    ],
    modifiers: {
      visibility: 50,
      detection: 30
    },
    uiEffects: {
      lightCone: true
    }
  }),

  // SPECIAL CONDITIONS
  'adrenaline': new Condition({
    id: 'adrenaline',
    name: 'Adrenaline Rush',
    description: 'Time seems to slow. You feel invincible.',
    triggers: [
      { type: 'combat', result: 'firstStrike' },
      { type: 'narrowEscape' }
    ],
    cures: [
      { type: 'duration', ticks: 30 }
    ],
    modifiers: {
      combat: 30,
      movement: 20,
      painResistance: 50
    },
    uiEffects: {
      timeSlowEffect: true,
      enhancedFocus: true
    },
    duration: 30
  }),

  'unconscious': new Condition({
    id: 'unconscious',
    name: 'Unconscious',
    description: 'Out cold.',
    triggers: [
      { type: 'damage', result: 'knockout' },
      { type: 'vitalThreshold', vital: 'health', threshold: 0 }
    ],
    cures: [
      { type: 'duration', ticks: 100 },
      { type: 'itemUse', item: 'smelling-salts' }
    ],
    modifiers: {
      allActions: -100
    },
    uiEffects: {
      blackout: true
    }
  }),

  // SLOAN-SPECIFIC CONDITIONS
  'sloan-static': new Condition({
    id: 'sloan-static',
    name: 'Comm Interference',
    description: 'Sloan\'s voice is breaking up.',
    triggers: [
      { type: 'connectionQuality', threshold: 30, below: true }
    ],
    cures: [
      { type: 'connectionQuality', threshold: 50 }
    ],
    modifiers: {
      sloanConnection: -60
    },
    uiEffects: {
      sloanTextGarble: 0.5,
      staticAudio: true,
      sloanDelayed: true
    }
  }),

  'sloan-offline': new Condition({
    id: 'sloan-offline',
    name: 'Comm Lost',
    description: 'You\'re on your own.',
    triggers: [
      { type: 'connectionQuality', threshold: 10, below: true }
    ],
    cures: [
      { type: 'connectionQuality', threshold: 30 }
    ],
    modifiers: {
      sloanConnection: -100
    },
    uiEffects: {
      sloanPanelOffline: true,
      isolationEffect: true
    }
  })
};

/**
 * Condition manager - tracks and applies active conditions
 */
class ConditionManager {
  constructor(state, eventBus) {
    this.state = state;
    this.eventBus = eventBus;
    this.activeConditions = new Map(); // entity id -> Set of condition ids
    this.conditionTimers = new Map();  // condition instance -> remaining duration
  }

  /**
   * Check if a condition should be triggered
   */
  checkTriggers(entityId) {
    const entity = this.getEntity(entityId);
    if (!entity) return;

    for (const [conditionId, condition] of Object.entries(ConditionRegistry)) {
      for (const trigger of condition.triggers) {
        if (this.evaluateTrigger(trigger, entity)) {
          this.addCondition(entityId, conditionId);
        }
      }
    }
  }

  /**
   * Check if a condition should be cured
   */
  checkCures(entityId) {
    const entity = this.getEntity(entityId);
    if (!entity) return;

    const conditions = this.activeConditions.get(entityId) || new Set();
    
    for (const conditionId of conditions) {
      const condition = ConditionRegistry[conditionId];
      
      for (const cure of condition.cures) {
        if (this.evaluateCure(cure, entity)) {
          this.removeCondition(entityId, conditionId);
          break;
        }
      }
    }
  }

  /**
   * Evaluate a trigger condition
   */
  evaluateTrigger(trigger, entity) {
    switch (trigger.type) {
      case 'vitalThreshold':
        const value = entity.vitals[trigger.vital];
        if (trigger.below) {
          return value < trigger.threshold;
        }
        return value > trigger.threshold;
      
      case 'connectionQuality':
        if (trigger.below) {
          return this.state.sloan.connectionQuality < trigger.threshold;
        }
        return this.state.sloan.connectionQuality > trigger.threshold;
      
      default:
        return false;
    }
  }

  /**
   * Evaluate a cure condition
   */
  evaluateCure(cure, entity) {
    switch (cure.type) {
      case 'vitalBelow':
        return entity.vitals[cure.vital] < cure.threshold;
      
      case 'vitalAbove':
        return entity.vitals[cure.vital] > cure.threshold;
      
      case 'duration':
        // Handled in tick()
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Add a condition to an entity
   */
  addCondition(entityId, conditionId) {
    if (!this.activeConditions.has(entityId)) {
      this.activeConditions.set(entityId, new Set());
    }
    
    const conditions = this.activeConditions.get(entityId);
    
    if (!conditions.has(conditionId)) {
      conditions.add(conditionId);
      
      const condition = ConditionRegistry[conditionId];
      
      // Set up duration timer if applicable
      if (condition.duration) {
        this.conditionTimers.set(`${entityId}:${conditionId}`, condition.duration);
      }
      
      this.eventBus.emit('condition:added', { entityId, conditionId, condition });
    }
  }

  /**
   * Remove a condition from an entity
   */
  removeCondition(entityId, conditionId) {
    const conditions = this.activeConditions.get(entityId);
    if (conditions) {
      conditions.delete(conditionId);
      this.conditionTimers.delete(`${entityId}:${conditionId}`);
      
      this.eventBus.emit('condition:removed', { entityId, conditionId });
    }
  }

  /**
   * Get all active conditions for an entity
   */
  getConditions(entityId) {
    return this.activeConditions.get(entityId) || new Set();
  }

  /**
   * Get cumulative modifiers for an entity
   */
  getModifiers(entityId) {
    const conditions = this.getConditions(entityId);
    const modifiers = {};
    
    for (const conditionId of conditions) {
      const condition = ConditionRegistry[conditionId];
      for (const [key, value] of Object.entries(condition.modifiers)) {
        modifiers[key] = (modifiers[key] || 0) + value;
      }
    }
    
    return modifiers;
  }

  /**
   * Get cumulative UI effects for an entity
   */
  getUIEffects(entityId) {
    const conditions = this.getConditions(entityId);
    const effects = {};
    
    for (const conditionId of conditions) {
      const condition = ConditionRegistry[conditionId];
      Object.assign(effects, condition.uiEffects);
    }
    
    return effects;
  }

  /**
   * Tick - process duration-based conditions
   */
  tick() {
    for (const [key, remaining] of this.conditionTimers) {
      if (remaining <= 0) {
        const [entityId, conditionId] = key.split(':');
        this.removeCondition(entityId, conditionId);
      } else {
        this.conditionTimers.set(key, remaining - 1);
      }
    }
  }

  getEntity(entityId) {
    if (entityId === 'player') {
      return this.state.player;
    }
    return this.state.npcs.get(entityId);
  }
}

export { Condition, ConditionRegistry, ConditionManager };
