/**
 * GAME CONSTANTS
 * Enums, thresholds, and magic numbers
 */

// Priority tiers for UI attention hierarchy
export const PRIORITY_TIERS = {
  IMMEDIATE: 1,     // NPCs, active threats
  ENVIRONMENTAL: 2, // Room actions, objects
  SELF: 3,          // Inventory, status
  MODIFIER: 0       // Overlays that modify other displays
};

// Game phases
export const GAME_PHASES = {
  EXPLORATION: 'exploration',
  DIALOGUE: 'dialogue',
  COMBAT: 'combat',
  STEALTH: 'stealth',
  CUTSCENE: 'cutscene',
  PUZZLE: 'puzzle'
};

// NPC awareness states
export const NPC_AWARENESS = {
  UNAWARE: 'unaware',       // Doesn't know player exists
  SUSPICIOUS: 'suspicious', // Something's off, investigating
  ALERT: 'alert',           // Knows player is there, reacting
  HOSTILE: 'hostile',       // Active threat
  ALLIED: 'allied',         // Friendly
  NEUTRAL: 'neutral'        // Knows player, doesn't care
};

// NPC behavior patterns
export const NPC_BEHAVIORS = {
  STATIONARY: 'stationary', // Stays in one spot
  PATROL: 'patrol',         // Moves along a path
  WANDER: 'wander',         // Random movement
  GUARD: 'guard',           // Watches an area/object
  WORKER: 'worker'          // Interacts with environment
};

// NPC capabilities - what can they do?
export const NPC_CAPABILITIES = {
  CALL_BACKUP: 'call_backup',
  LOCK_DOORS: 'lock_doors',
  SOUND_ALARM: 'sound_alarm',
  ARMED: 'armed',
  KEYS: 'has_keys',
  ACCESS_CODES: 'has_codes'
};

// Player condition effects
export const CONDITION_EFFECTS = {
  'high-stress': {
    description: 'Hands shaking, hard to focus',
    effects: {
      fineMotor: -30,      // Hacking, lockpicking harder
      combat: +10,         // Adrenaline boost
      sloanConnection: -50 // Communication degrades
    }
  },
  'injured': {
    description: 'Bleeding, movement impaired',
    effects: {
      movement: -40,
      stealth: -20,
      bleedRate: 2  // Health loss per tick
    }
  },
  'exhausted': {
    description: 'Running on empty',
    effects: {
      allActions: -20,
      recovery: -50
    }
  },
  'panicked': {
    description: 'Fight or flight overwhelming',
    effects: {
      sloanConnection: -80,
      readingComprehension: -60,
      combat: +20
    }
  }
};

// Vital thresholds
export const VITAL_THRESHOLDS = {
  STRESS: {
    LOW: 30,
    MEDIUM: 50,
    HIGH: 70,
    CRITICAL: 90
  },
  HEALTH: {
    HEALTHY: 70,
    HURT: 50,
    WOUNDED: 30,
    CRITICAL: 10
  },
  DETECTION: {
    SAFE: 20,
    NOTICED: 40,
    SUSPICIOUS: 60,
    SPOTTED: 80,
    CAUGHT: 100
  }
};

// Sloan behavioral modes
export const SLOAN_MODES = {
  CAUTIOUS: 'cautious',   // Speaks less, warns more
  BALANCED: 'balanced',   // Normal operation
  AGGRESSIVE: 'aggressive' // More tactical suggestions
};

// Sloan trigger types
export const SLOAN_TRIGGERS = {
  ENTER_ROOM: 'enter_room',
  SPOT_NPC: 'spot_npc',
  SPOT_ITEM: 'spot_item',
  PLAYER_IDLE: 'player_idle',
  STRESS_CHANGE: 'stress_change',
  OBJECTIVE_NEAR: 'objective_near',
  DANGER: 'danger',
  HINT_REQUEST: 'hint_request',
  ACTION_RESULT: 'action_result'
};

// Environment attributes
export const ENV_ATTRIBUTES = {
  LIGHTING: ['dark', 'dim', 'normal', 'bright'],
  NOISE: ['silent', 'quiet', 'normal', 'loud'],
  COVER: ['none', 'sparse', 'moderate', 'heavy'],
  SECURITY: ['none', 'low', 'medium', 'high', 'maximum']
};

// Action verbs
export const ACTION_VERBS = {
  // Movement
  MOVE: 'move',
  SNEAK: 'sneak',
  RUN: 'run',
  HIDE: 'hide',
  
  // Observation
  LOOK: 'look',
  EXAMINE: 'examine',
  LISTEN: 'listen',
  SEARCH: 'search',
  
  // Interaction
  TAKE: 'take',
  USE: 'use',
  COMBINE: 'combine',
  DROP: 'drop',
  
  // Social
  TALK: 'talk',
  PERSUADE: 'persuade',
  INTIMIDATE: 'intimidate',
  DISTRACT: 'distract',
  
  // Technical
  HACK: 'hack',
  LOCKPICK: 'lockpick',
  DISABLE: 'disable',
  
  // Combat
  ATTACK: 'attack',
  SUBDUE: 'subdue',
  FLEE: 'flee'
};

// UI card states
export const CARD_STATES = {
  EXPANDED: 'expanded',
  STANDARD: 'standard',
  MINIMIZED: 'minimized',
  COLLAPSED: 'collapsed',
  POPUP: 'popup'
};

// Map rendering constants
export const MAP_CONFIG = {
  TILE_SIZE: 32,           // Pixels per grid tile
  BLUEPRINT_SCALE: 0.5,    // Scale for room blueprints
  OVERVIEW_SCALE: 0.1,     // Scale for full facility map
  COLORS: {
    WALL: '#1a1a2e',
    FLOOR: '#16213e',
    DOOR: '#e94560',
    OBJECTIVE: '#ffc107',
    PLAYER: '#00ff88',
    NPC_HOSTILE: '#ff4444',
    NPC_NEUTRAL: '#888888',
    NPC_ALLIED: '#44ff44',
    FURNITURE: '#0f3460',
    COMPUTER: '#00d4ff',
    COVER: '#2d4059'
  }
};
