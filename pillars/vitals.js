/**
 * VITALS SYSTEM
 * Pillar 4: Character and NPC state tracking
 */

import { VITAL_THRESHOLDS, CONDITION_EFFECTS } from '../core/constants.js';

/**
 * Base class for any entity with vitals
 */
class VitalsSystem {
  constructor(config = {}) {
    this.health = config.health ?? 100;
    this.maxHealth = config.maxHealth ?? 100;
    this.stamina = config.stamina ?? 100;
    this.maxStamina = config.maxStamina ?? 100;
    this.stress = config.stress ?? 0;
    this.detection = config.detection ?? 0;
    
    this.conditions = new Set();
    this.effects = new Map(); // Active timed effects
  }

  /**
   * Get current status tier for a vital
   */
  getHealthStatus() {
    if (this.health >= VITAL_THRESHOLDS.HEALTH.HEALTHY) return 'healthy';
    if (this.health >= VITAL_THRESHOLDS.HEALTH.HURT) return 'hurt';
    if (this.health >= VITAL_THRESHOLDS.HEALTH.WOUNDED) return 'wounded';
    if (this.health >= VITAL_THRESHOLDS.HEALTH.CRITICAL) return 'critical';
    return 'dead';
  }

  getStressStatus() {
    if (this.stress <= VITAL_THRESHOLDS.STRESS.LOW) return 'calm';
    if (this.stress <= VITAL_THRESHOLDS.STRESS.MEDIUM) return 'tense';
    if (this.stress <= VITAL_THRESHOLDS.STRESS.HIGH) return 'stressed';
    if (this.stress <= VITAL_THRESHOLDS.STRESS.CRITICAL) return 'panicked';
    return 'overwhelmed';
  }

  getDetectionStatus() {
    if (this.detection <= VITAL_THRESHOLDS.DETECTION.SAFE) return 'hidden';
    if (this.detection <= VITAL_THRESHOLDS.DETECTION.NOTICED) return 'noticed';
    if (this.detection <= VITAL_THRESHOLDS.DETECTION.SUSPICIOUS) return 'suspicious';
    if (this.detection <= VITAL_THRESHOLDS.DETECTION.SPOTTED) return 'spotted';
    return 'caught';
  }

  /**
   * Modify a vital with bounds checking
   */
  modifyVital(vital, amount) {
    switch (vital) {
      case 'health':
        this.health = Math.max(0, Math.min(this.maxHealth, this.health + amount));
        break;
      case 'stamina':
        this.stamina = Math.max(0, Math.min(this.maxStamina, this.stamina + amount));
        break;
      case 'stress':
        this.stress = Math.max(0, Math.min(100, this.stress + amount));
        break;
      case 'detection':
        this.detection = Math.max(0, Math.min(100, this.detection + amount));
        break;
    }
    
    this.updateConditions();
    return this[vital];
  }

  /**
   * Update conditions based on current vitals
   */
  updateConditions() {
    // Clear auto-conditions (those derived from vitals)
    const autoConditions = ['high-stress', 'injured', 'exhausted', 'panicked'];
    autoConditions.forEach(c => this.conditions.delete(c));
    
    // Apply conditions based on thresholds
    if (this.stress > VITAL_THRESHOLDS.STRESS.HIGH) {
      this.conditions.add('high-stress');
    }
    if (this.stress > VITAL_THRESHOLDS.STRESS.CRITICAL) {
      this.conditions.add('panicked');
    }
    if (this.health < VITAL_THRESHOLDS.HEALTH.WOUNDED) {
      this.conditions.add('injured');
    }
    if (this.stamina < 20) {
      this.conditions.add('exhausted');
    }
  }

  /**
   * Get the cumulative effect modifier for a given action type
   */
  getEffectModifier(actionType) {
    let modifier = 0;
    
    for (const condition of this.conditions) {
      const effects = CONDITION_EFFECTS[condition]?.effects;
      if (effects) {
        if (effects[actionType]) {
          modifier += effects[actionType];
        }
        if (effects.allActions) {
          modifier += effects.allActions;
        }
      }
    }
    
    return modifier;
  }

  /**
   * Apply a timed effect
   */
  applyEffect(effectId, duration, effectData) {
    this.effects.set(effectId, {
      remaining: duration,
      ...effectData
    });
  }

  /**
   * Tick - called each game tick to update timed effects
   */
  tick() {
    // Process bleeding
    if (this.conditions.has('injured')) {
      const bleedRate = CONDITION_EFFECTS['injured'].effects.bleedRate || 0;
      this.modifyVital('health', -bleedRate);
    }
    
    // Process timed effects
    for (const [effectId, effect] of this.effects) {
      effect.remaining--;
      if (effect.remaining <= 0) {
        this.effects.delete(effectId);
      }
    }
    
    // Natural stress decay when safe
    if (this.detection < VITAL_THRESHOLDS.DETECTION.SUSPICIOUS) {
      this.modifyVital('stress', -1);
    }
    
    // Natural stamina recovery when not moving
    this.modifyVital('stamina', 0.5);
  }

  /**
   * Serialize for save/load
   */
  serialize() {
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      stamina: this.stamina,
      maxStamina: this.maxStamina,
      stress: this.stress,
      detection: this.detection,
      conditions: Array.from(this.conditions),
      effects: Array.from(this.effects.entries())
    };
  }

  /**
   * Deserialize from saved state
   */
  static deserialize(data) {
    const vitals = new VitalsSystem(data);
    vitals.conditions = new Set(data.conditions);
    vitals.effects = new Map(data.effects);
    return vitals;
  }
}

/**
 * Player-specific vitals with additional tracking
 */
class PlayerVitals extends VitalsSystem {
  constructor(config = {}) {
    super(config);
    
    // Player-specific
    this.pulse = 70;        // BPM - affects UI pulse effect
    this.breathingRate = 12; // Breaths per minute
  }

  /**
   * Override to include pulse/breathing effects
   */
  updateConditions() {
    super.updateConditions();
    
    // Update physiological responses based on stress
    this.pulse = 70 + Math.floor(this.stress * 0.6); // 70-130 BPM
    this.breathingRate = 12 + Math.floor(this.stress * 0.1); // 12-22 BPM
  }

  /**
   * Get UI effect intensity based on current state
   */
  getUIEffects() {
    return {
      // Pulse effect intensity (for screen edge vignette pulse)
      pulseIntensity: Math.min(1, (this.pulse - 70) / 60),
      
      // Shake intensity (for UI jitter)
      shakeIntensity: this.conditions.has('high-stress') ? 0.3 : 0,
      
      // Blur/focus issues
      focusBlur: this.conditions.has('panicked') ? 0.4 : 0,
      
      // Sloan connection quality
      sloanQuality: Math.max(0, 100 - this.stress - (this.conditions.has('injured') ? 20 : 0)),
      
      // Reading difficulty
      textGarble: this.conditions.has('panicked') ? 0.3 : 0
    };
  }
}

/**
 * NPC-specific vitals with awareness tracking
 */
class NPCVitals extends VitalsSystem {
  constructor(config = {}) {
    super(config);
    
    // NPC-specific
    this.awareness = config.awareness || 'unaware';
    this.suspicion = config.suspicion || 0;
    this.alertCooldown = 0;
  }

  /**
   * Increase suspicion and potentially awareness
   */
  addSuspicion(amount) {
    this.suspicion = Math.min(100, this.suspicion + amount);
    
    if (this.suspicion > 30 && this.awareness === 'unaware') {
      this.awareness = 'suspicious';
    }
    if (this.suspicion > 70 && this.awareness === 'suspicious') {
      this.awareness = 'alert';
    }
    if (this.suspicion >= 100) {
      this.awareness = 'hostile';
    }
  }

  /**
   * Decay suspicion over time
   */
  decaySuspicion(amount = 1) {
    if (this.alertCooldown > 0) {
      this.alertCooldown--;
      return;
    }
    
    this.suspicion = Math.max(0, this.suspicion - amount);
    
    // Awareness can decrease but not below suspicious once alerted
    if (this.suspicion < 30 && this.awareness === 'suspicious') {
      this.awareness = 'unaware';
    }
  }

  /**
   * Check if NPC can perform certain actions
   */
  canAct() {
    return this.health > 0 && !this.conditions.has('unconscious');
  }
}

export { VitalsSystem, PlayerVitals, NPCVitals };
