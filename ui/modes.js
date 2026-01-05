/**
 * GAME MODES
 * Modal state management for different gameplay contexts
 */

import { GAME_PHASES, CARD_STATES } from '../core/constants.js';

/**
 * Mode configurations - what cards are available in each mode
 */
const MODES = {
  [GAME_PHASES.EXPLORATION]: {
    name: 'Exploration',
    description: 'Free movement and investigation',
    availableCards: ['action-palette', 'inventory', 'map', 'vitals', 'sloan', 'environment'],
    primaryFocus: 'environment-actions',
    cardStates: {
      'action-palette': CARD_STATES.STANDARD,
      'inventory': CARD_STATES.MINIMIZED,
      'map': CARD_STATES.MINIMIZED,
      'vitals': CARD_STATES.STANDARD,
      'sloan': CARD_STATES.STANDARD,
      'environment': CARD_STATES.STANDARD,
      'dialogue': CARD_STATES.COLLAPSED,
      'combat': CARD_STATES.COLLAPSED
    },
    allowedActions: ['look', 'examine', 'listen', 'search', 'move', 'sneak', 'run', 'hide', 
                     'take', 'use', 'hack', 'lockpick', 'talk', 'distract']
  },

  [GAME_PHASES.DIALOGUE]: {
    name: 'Dialogue',
    description: 'Conversation with NPCs',
    availableCards: ['dialogue', 'vitals', 'sloan'],
    primaryFocus: 'dialogue',
    cardStates: {
      'action-palette': CARD_STATES.COLLAPSED,
      'inventory': CARD_STATES.COLLAPSED,
      'map': CARD_STATES.COLLAPSED,
      'vitals': CARD_STATES.MINIMIZED,
      'sloan': CARD_STATES.MINIMIZED,
      'environment': CARD_STATES.COLLAPSED,
      'dialogue': CARD_STATES.EXPANDED,
      'combat': CARD_STATES.COLLAPSED
    },
    allowedActions: ['talk', 'persuade', 'intimidate', 'distract', 'flee']
  },

  [GAME_PHASES.COMBAT]: {
    name: 'Combat',
    description: 'Active conflict',
    availableCards: ['combat-actions', 'vitals', 'sloan'],
    primaryFocus: 'combat',
    cardStates: {
      'action-palette': CARD_STATES.COLLAPSED,
      'inventory': CARD_STATES.MINIMIZED,
      'map': CARD_STATES.COLLAPSED,
      'vitals': CARD_STATES.EXPANDED,
      'sloan': CARD_STATES.MINIMIZED,
      'environment': CARD_STATES.COLLAPSED,
      'dialogue': CARD_STATES.COLLAPSED,
      'combat': CARD_STATES.EXPANDED
    },
    allowedActions: ['attack', 'subdue', 'flee', 'hide', 'use']
  },

  [GAME_PHASES.STEALTH]: {
    name: 'Stealth',
    description: 'Evading detection',
    availableCards: ['stealth-actions', 'map-mini', 'vitals', 'sloan'],
    primaryFocus: 'detection-meter',
    cardStates: {
      'action-palette': CARD_STATES.COLLAPSED,
      'inventory': CARD_STATES.COLLAPSED,
      'map': CARD_STATES.STANDARD,
      'vitals': CARD_STATES.EXPANDED,
      'sloan': CARD_STATES.MINIMIZED,
      'environment': CARD_STATES.MINIMIZED,
      'dialogue': CARD_STATES.COLLAPSED,
      'combat': CARD_STATES.COLLAPSED
    },
    allowedActions: ['sneak', 'hide', 'flee', 'distract', 'subdue']
  },

  [GAME_PHASES.PUZZLE]: {
    name: 'Puzzle',
    description: 'Solving challenges',
    availableCards: ['puzzle-interface', 'inventory', 'sloan'],
    primaryFocus: 'puzzle-interface',
    cardStates: {
      'action-palette': CARD_STATES.COLLAPSED,
      'inventory': CARD_STATES.STANDARD,
      'map': CARD_STATES.COLLAPSED,
      'vitals': CARD_STATES.MINIMIZED,
      'sloan': CARD_STATES.STANDARD,
      'environment': CARD_STATES.COLLAPSED,
      'dialogue': CARD_STATES.COLLAPSED,
      'combat': CARD_STATES.COLLAPSED
    },
    allowedActions: ['use', 'combine', 'examine']
  },

  [GAME_PHASES.CUTSCENE]: {
    name: 'Cutscene',
    description: 'Narrative sequence',
    availableCards: [],
    primaryFocus: 'narrative',
    cardStates: {
      'action-palette': CARD_STATES.COLLAPSED,
      'inventory': CARD_STATES.COLLAPSED,
      'map': CARD_STATES.COLLAPSED,
      'vitals': CARD_STATES.COLLAPSED,
      'sloan': CARD_STATES.COLLAPSED,
      'environment': CARD_STATES.COLLAPSED,
      'dialogue': CARD_STATES.COLLAPSED,
      'combat': CARD_STATES.COLLAPSED
    },
    allowedActions: []
  }
};

/**
 * Mode Manager - handles transitions between game modes
 */
class ModeManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.currentMode = GAME_PHASES.EXPLORATION;
    this.previousMode = null;
    this.modeStack = [];
    this.transitionLocked = false;
  }

  /**
   * Get current mode configuration
   */
  getCurrentMode() {
    return MODES[this.currentMode];
  }

  /**
   * Get card state for a specific card in current mode
   */
  getCardState(cardId) {
    const mode = this.getCurrentMode();
    return mode.cardStates[cardId] || CARD_STATES.COLLAPSED;
  }

  /**
   * Check if action is allowed in current mode
   */
  isActionAllowed(actionVerb) {
    const mode = this.getCurrentMode();
    return mode.allowedActions.includes(actionVerb);
  }

  /**
   * Transition to a new mode
   */
  transitionTo(newMode, options = {}) {
    if (this.transitionLocked) return false;
    if (!MODES[newMode]) return false;
    if (this.currentMode === newMode) return false;

    const fromMode = this.currentMode;
    const toMode = newMode;

    // Push current mode to stack if requested
    if (options.pushToStack) {
      this.modeStack.push(fromMode);
    }

    this.previousMode = fromMode;
    this.currentMode = toMode;

    // Lock transitions briefly to prevent rapid switching
    this.transitionLocked = true;
    setTimeout(() => {
      this.transitionLocked = false;
    }, options.lockDuration || 300);

    // Emit transition event
    this.eventBus.emit('mode:changed', {
      from: fromMode,
      to: toMode,
      mode: MODES[toMode],
      cardStates: MODES[toMode].cardStates
    });

    return true;
  }

  /**
   * Return to previous mode
   */
  returnToPrevious() {
    if (this.previousMode) {
      return this.transitionTo(this.previousMode);
    }
    return false;
  }

  /**
   * Pop mode from stack
   */
  popMode() {
    if (this.modeStack.length > 0) {
      const mode = this.modeStack.pop();
      return this.transitionTo(mode);
    }
    return false;
  }

  /**
   * Get available cards for current mode
   */
  getAvailableCards() {
    return this.getCurrentMode().availableCards;
  }

  /**
   * Get all card states for current mode
   */
  getAllCardStates() {
    return { ...this.getCurrentMode().cardStates };
  }

  /**
   * Force a specific card state override
   */
  overrideCardState(cardId, state) {
    const mode = MODES[this.currentMode];
    if (mode.cardStates.hasOwnProperty(cardId)) {
      const originalState = mode.cardStates[cardId];
      mode.cardStates[cardId] = state;
      
      // Emit card state change
      this.eventBus.emit('card:stateOverride', {
        cardId,
        originalState,
        newState: state,
        mode: this.currentMode
      });
    }
  }

  /**
   * Reset to exploration mode
   */
  reset() {
    this.modeStack = [];
    this.previousMode = null;
    this.transitionTo(GAME_PHASES.EXPLORATION);
  }

  /**
   * Get mode info for debugging
   */
  getDebugInfo() {
    return {
      current: this.currentMode,
      previous: this.previousMode,
      stack: [...this.modeStack],
      locked: this.transitionLocked,
      availableCards: this.getAvailableCards()
    };
  }
}

/**
 * Transition effects for mode changes
 */
const TransitionEffects = {
  [GAME_PHASES.EXPLORATION]: {
    enter: { duration: 300, easing: 'ease-out' },
    exit: { duration: 200, easing: 'ease-in' }
  },
  [GAME_PHASES.DIALOGUE]: {
    enter: { duration: 400, easing: 'ease-out', focusBlur: true },
    exit: { duration: 300, easing: 'ease-in' }
  },
  [GAME_PHASES.COMBAT]: {
    enter: { duration: 150, easing: 'ease-out', flash: 'red' },
    exit: { duration: 200, easing: 'ease-in' }
  },
  [GAME_PHASES.STEALTH]: {
    enter: { duration: 400, easing: 'ease-out', darken: 0.2 },
    exit: { duration: 300, easing: 'ease-in' }
  }
};

export { MODES, ModeManager, TransitionEffects };
