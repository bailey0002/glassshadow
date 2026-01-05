/**
 * PLAYER ENTITY
 * Player state, inventory, and capabilities
 */

import { PlayerVitals } from '../pillars/vitals.js';

class Player {
  constructor(config = {}) {
    // Vitals system
    this.vitals = new PlayerVitals(config.vitals);
    
    // Equipment/inventory
    this.equipment = config.equipment || [];
    this.maxInventorySlots = config.maxInventorySlots || 6;
    
    // Position within current environment
    this.position = config.position || { x: 0, y: 0 };
    
    // Current facing direction
    this.facing = config.facing || 'south';
    
    // Is player currently hidden?
    this.hidden = false;
    
    // Active conditions (derived from vitals + situational)
    this.conditions = new Set();
    
    // Skill levels (for skill checks)
    this.skills = {
      stealth: config.skills?.stealth || 50,
      hacking: config.skills?.hacking || 40,
      lockpicking: config.skills?.lockpicking || 30,
      combat: config.skills?.combat || 40,
      persuasion: config.skills?.persuasion || 50
    };
  }

  /**
   * Check if player has a specific item
   */
  hasItem(itemId) {
    return this.equipment.includes(itemId);
  }

  /**
   * Add item to inventory
   */
  addItem(itemId) {
    if (this.equipment.length >= this.maxInventorySlots) {
      return { success: false, reason: 'Inventory full' };
    }
    if (this.hasItem(itemId)) {
      return { success: false, reason: 'Already have this item' };
    }
    this.equipment.push(itemId);
    return { success: true };
  }

  /**
   * Remove item from inventory
   */
  removeItem(itemId) {
    const index = this.equipment.indexOf(itemId);
    if (index === -1) {
      return { success: false, reason: 'Item not in inventory' };
    }
    this.equipment.splice(index, 1);
    return { success: true };
  }

  /**
   * Get highest access level from keycards
   */
  getAccessLevel(equipmentData) {
    let maxLevel = 0;
    for (const itemId of this.equipment) {
      const item = equipmentData[itemId];
      if (item?.accessLevel && item.accessLevel > maxLevel) {
        maxLevel = item.accessLevel;
      }
    }
    return maxLevel;
  }

  /**
   * Perform a skill check
   */
  skillCheck(skill, difficulty, modifiers = {}) {
    const baseSkill = this.skills[skill] || 50;
    
    // Apply condition modifiers from vitals
    let conditionMod = 0;
    const uiEffects = this.vitals.getUIEffects();
    
    // Fine motor affected by stress
    if (['hacking', 'lockpicking'].includes(skill)) {
      conditionMod -= uiEffects.shakeIntensity * 30;
    }
    
    // Combat boosted by adrenaline
    if (skill === 'combat' && this.conditions.has('adrenaline')) {
      conditionMod += 20;
    }
    
    // Apply any passed modifiers
    const extraMod = Object.values(modifiers).reduce((sum, val) => sum + val, 0);
    
    const finalSkill = baseSkill + conditionMod + extraMod;
    const roll = Math.random() * 100;
    
    return {
      success: roll < finalSkill - difficulty,
      margin: finalSkill - difficulty - roll,
      criticalSuccess: roll < 5,
      criticalFailure: roll > 95
    };
  }

  /**
   * Move player to a new position
   */
  moveTo(x, y) {
    this.position = { x, y };
    this.hidden = false; // Moving breaks hidden state
  }

  /**
   * Set player's hidden state
   */
  setHidden(hidden) {
    this.hidden = hidden;
    if (hidden) {
      this.conditions.add('hidden');
    } else {
      this.conditions.delete('hidden');
    }
  }

  /**
   * Get current state for UI rendering
   */
  getState() {
    return {
      vitals: {
        health: this.vitals.health,
        stamina: this.vitals.stamina,
        stress: this.vitals.stress,
        detection: this.vitals.detection
      },
      position: this.position,
      facing: this.facing,
      hidden: this.hidden,
      equipment: this.equipment,
      conditions: Array.from(this.conditions),
      uiEffects: this.vitals.getUIEffects()
    };
  }

  /**
   * Tick - called each game tick
   */
  tick() {
    this.vitals.tick();
    this.vitals.updateConditions();
    
    // Sync conditions from vitals
    for (const condition of this.vitals.conditions) {
      this.conditions.add(condition);
    }
  }

  /**
   * Serialize for save/load
   */
  serialize() {
    return {
      vitals: this.vitals.serialize(),
      equipment: this.equipment,
      position: this.position,
      facing: this.facing,
      hidden: this.hidden,
      conditions: Array.from(this.conditions),
      skills: this.skills
    };
  }

  /**
   * Deserialize from saved state
   */
  static deserialize(data) {
    const player = new Player({
      vitals: data.vitals,
      equipment: data.equipment,
      position: data.position,
      facing: data.facing,
      skills: data.skills
    });
    player.hidden = data.hidden;
    player.conditions = new Set(data.conditions);
    return player;
  }
}

export { Player };
