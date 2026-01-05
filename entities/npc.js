/**
 * NPC ENTITY
 * NPC class with behaviors, awareness states, and capabilities
 */

import { NPCVitals } from '../pillars/vitals.js';
import { NPC_AWARENESS, NPC_BEHAVIORS, NPC_CAPABILITIES } from '../core/constants.js';

class NPC {
  constructor(config) {
    this.id = config.id;
    this.type = config.type || 'generic';
    this.name = config.name || 'Unknown';
    
    // Vitals system
    this.vitals = new NPCVitals(config.vitals);
    
    // Location
    this.location = config.location;
    this.position = config.position || { x: 0, y: 0 };
    this.facing = config.facing || 'south';
    
    // Behavior pattern
    this.behavior = config.behavior || NPC_BEHAVIORS.STATIONARY;
    this.patrolPath = config.patrolPath || null;
    this.patrolIndex = 0;
    this.patrolDirection = 1; // 1 = forward, -1 = backward
    
    // Awareness and engagement
    this.awareness = config.awareness || NPC_AWARENESS.UNAWARE;
    this.engaged = false;
    this.targetEntity = null;
    
    // Capabilities - what can this NPC do?
    this.capabilities = new Set(config.capabilities || []);
    
    // Inventory (items NPC is carrying)
    this.inventory = config.inventory || [];
    
    // Dialogue reference
    this.dialogueId = config.dialogueId || null;
    
    // Work stations (for worker NPCs)
    this.workStations = config.workStations || [];
    this.currentWorkStation = 0;
    
    // Timers
    this.suspicionTimer = 0;
    this.idleTimer = 0;
    this.actionCooldown = 0;
  }

  /**
   * Check if NPC has a specific capability
   */
  hasCapability(capability) {
    return this.capabilities.has(capability);
  }

  /**
   * Get NPC's current state for rendering
   */
  getState() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      position: this.position,
      facing: this.facing,
      awareness: this.awareness,
      engaged: this.engaged,
      behavior: this.behavior,
      capabilities: Array.from(this.capabilities)
    };
  }

  /**
   * Handle player detection
   */
  detectPlayer(playerPosition, playerHidden, environmentNoise) {
    if (!this.vitals.canAct()) return false;
    
    // Calculate detection based on distance and facing
    const dx = playerPosition.x - this.position.x;
    const dy = playerPosition.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Base detection range
    let detectionRange = 5;
    
    // Hidden players are harder to detect
    if (playerHidden) {
      detectionRange *= 0.3;
    }
    
    // Check if player is in front of NPC
    const inFront = this.isInFront(dx, dy);
    if (!inFront) {
      detectionRange *= 0.2; // Much harder to detect behind
    }
    
    // Noisy environments reduce awareness
    if (environmentNoise === 'loud') {
      detectionRange *= 0.7;
    }
    
    if (distance <= detectionRange) {
      // Calculate suspicion increase based on proximity
      const suspicionIncrease = Math.max(5, 30 - distance * 5);
      this.vitals.addSuspicion(suspicionIncrease);
      
      if (this.awareness === NPC_AWARENESS.HOSTILE || 
          this.awareness === NPC_AWARENESS.ALERT) {
        this.engaged = true;
        this.targetEntity = 'player';
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Check if a position is in front of the NPC
   */
  isInFront(dx, dy) {
    switch (this.facing) {
      case 'north': return dy < 0;
      case 'south': return dy > 0;
      case 'east': return dx > 0;
      case 'west': return dx < 0;
      default: return true;
    }
  }

  /**
   * Update NPC behavior each tick
   */
  tick(gameState) {
    if (!this.vitals.canAct()) return;
    
    // Decay suspicion if not engaged
    if (!this.engaged && this.awareness !== NPC_AWARENESS.HOSTILE) {
      this.vitals.decaySuspicion();
    }
    
    // Update awareness state
    this.updateAwareness();
    
    // Execute behavior pattern
    switch (this.behavior) {
      case NPC_BEHAVIORS.PATROL:
        this.executePatrol();
        break;
      case NPC_BEHAVIORS.WORKER:
        this.executeWork();
        break;
      case NPC_BEHAVIORS.WANDER:
        this.executeWander();
        break;
      case NPC_BEHAVIORS.GUARD:
        this.executeGuard();
        break;
    }
    
    // Decrease action cooldown
    if (this.actionCooldown > 0) {
      this.actionCooldown--;
    }
    
    this.vitals.tick();
  }

  /**
   * Update awareness state based on suspicion
   */
  updateAwareness() {
    const suspicion = this.vitals.suspicion;
    
    if (suspicion >= 100) {
      this.awareness = NPC_AWARENESS.HOSTILE;
    } else if (suspicion >= 70) {
      this.awareness = NPC_AWARENESS.ALERT;
    } else if (suspicion >= 30) {
      this.awareness = NPC_AWARENESS.SUSPICIOUS;
    } else if (suspicion < 10 && this.awareness === NPC_AWARENESS.SUSPICIOUS) {
      this.awareness = NPC_AWARENESS.UNAWARE;
    }
  }

  /**
   * Execute patrol behavior
   */
  executePatrol() {
    if (!this.patrolPath || this.patrolPath.length < 2) return;
    if (this.awareness === NPC_AWARENESS.ALERT || this.engaged) return;
    
    const target = this.patrolPath[this.patrolIndex];
    
    // Move toward target point
    if (this.moveToward(target)) {
      // Reached point, move to next
      this.patrolIndex += this.patrolDirection;
      
      // Reverse at ends
      if (this.patrolIndex >= this.patrolPath.length) {
        this.patrolDirection = -1;
        this.patrolIndex = this.patrolPath.length - 2;
      } else if (this.patrolIndex < 0) {
        this.patrolDirection = 1;
        this.patrolIndex = 1;
      }
    }
  }

  /**
   * Execute worker behavior
   */
  executeWork() {
    if (this.awareness !== NPC_AWARENESS.UNAWARE) return;
    if (this.workStations.length === 0) return;
    
    this.idleTimer++;
    
    // Occasionally move to different work station
    if (this.idleTimer > 50 + Math.random() * 50) {
      this.idleTimer = 0;
      this.currentWorkStation = (this.currentWorkStation + 1) % this.workStations.length;
      // Would need environment data to get actual position
    }
  }

  /**
   * Execute wander behavior
   */
  executeWander() {
    if (this.awareness !== NPC_AWARENESS.UNAWARE) return;
    
    this.idleTimer++;
    
    if (this.idleTimer > 30 + Math.random() * 40) {
      this.idleTimer = 0;
      // Random small movement
      this.position.x += Math.floor(Math.random() * 3) - 1;
      this.position.y += Math.floor(Math.random() * 3) - 1;
      this.updateFacing();
    }
  }

  /**
   * Execute guard behavior
   */
  executeGuard() {
    // Guards stay in place but rotate facing
    this.idleTimer++;
    
    if (this.idleTimer > 40 + Math.random() * 20) {
      this.idleTimer = 0;
      const directions = ['north', 'south', 'east', 'west'];
      this.facing = directions[Math.floor(Math.random() * directions.length)];
    }
  }

  /**
   * Move toward a target position
   */
  moveToward(target, speed = 1) {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.5) {
      return true; // Arrived
    }
    
    // Normalize and apply speed
    this.position.x += (dx / distance) * speed;
    this.position.y += (dy / distance) * speed;
    
    this.updateFacing();
    return false;
  }

  /**
   * Update facing direction based on movement
   */
  updateFacing() {
    // This would be based on last movement direction
    // Simplified here
  }

  /**
   * Call for backup (if capable)
   */
  callBackup(eventBus) {
    if (!this.hasCapability(NPC_CAPABILITIES.CALL_BACKUP)) return false;
    if (this.actionCooldown > 0) return false;
    
    eventBus.emit('npc:calledBackup', {
      npcId: this.id,
      location: this.location
    });
    
    this.actionCooldown = 100; // Can't call again for a while
    return true;
  }

  /**
   * Sound alarm (if capable)
   */
  soundAlarm(eventBus) {
    if (!this.hasCapability(NPC_CAPABILITIES.SOUND_ALARM)) return false;
    if (this.actionCooldown > 0) return false;
    
    eventBus.emit('facility:alarm', {
      triggeredBy: this.id,
      location: this.location
    });
    
    this.actionCooldown = 999; // One-time action
    return true;
  }

  /**
   * Lock nearby doors (if capable)
   */
  lockDoors(eventBus) {
    if (!this.hasCapability(NPC_CAPABILITIES.LOCK_DOORS)) return false;
    
    eventBus.emit('facility:lockdown', {
      triggeredBy: this.id,
      location: this.location
    });
    
    return true;
  }

  /**
   * Apply damage to NPC
   */
  takeDamage(amount) {
    this.vitals.modifyVital('health', -amount);
    
    if (this.vitals.health <= 0) {
      this.vitals.conditions.add('unconscious');
      this.engaged = false;
    }
  }

  /**
   * Subdue NPC (non-lethal)
   */
  subdue() {
    this.vitals.conditions.add('unconscious');
    this.engaged = false;
    this.awareness = NPC_AWARENESS.UNAWARE;
    
    // Drop inventory items
    return this.inventory;
  }

  /**
   * Serialize for save/load
   */
  serialize() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      location: this.location,
      position: this.position,
      facing: this.facing,
      behavior: this.behavior,
      patrolPath: this.patrolPath,
      patrolIndex: this.patrolIndex,
      awareness: this.awareness,
      engaged: this.engaged,
      capabilities: Array.from(this.capabilities),
      inventory: this.inventory,
      vitals: this.vitals.serialize()
    };
  }

  /**
   * Create NPC from config
   */
  static fromConfig(config, slot) {
    return new NPC({
      ...config,
      position: slot.position,
      facing: slot.facingDirection,
      behavior: slot.defaultBehavior,
      patrolPath: slot.patrolPath,
      workStations: slot.workStations
    });
  }
}

/**
 * NPC type templates
 */
const NPCTemplates = {
  guard: {
    type: 'guard',
    name: 'Security Guard',
    capabilities: [
      NPC_CAPABILITIES.CALL_BACKUP,
      NPC_CAPABILITIES.ARMED,
      NPC_CAPABILITIES.KEYS
    ],
    inventory: ['keycard-level1', 'radio-guard'],
    vitals: { health: 80 }
  },
  
  tech: {
    type: 'tech',
    name: 'Technician',
    capabilities: [NPC_CAPABILITIES.ACCESS_CODES],
    inventory: ['keycard-level2'],
    vitals: { health: 50 }
  },
  
  receptionist: {
    type: 'receptionist',
    name: 'Receptionist',
    capabilities: [NPC_CAPABILITIES.SOUND_ALARM],
    inventory: ['keycard-level1'],
    vitals: { health: 40 }
  },
  
  executive: {
    type: 'executive',
    name: 'Executive',
    capabilities: [NPC_CAPABILITIES.ACCESS_CODES, NPC_CAPABILITIES.LOCK_DOORS],
    inventory: ['keycard-level3'],
    vitals: { health: 40 }
  }
};

export { NPC, NPCTemplates };
