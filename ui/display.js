/**
 * DYNAMIC DISPLAY SYSTEM
 * Manages card states, transitions, and responsive emphasis
 */

import { CARD_STATES, PRIORITY_TIERS } from '../core/constants.js';

/**
 * Card instance representing a UI element
 */
class Card {
  constructor(config) {
    this.id = config.id;
    this.type = config.type;
    this.priority = config.priority || 0;
    this.state = config.state || CARD_STATES.STANDARD;
    this.data = config.data || {};
    
    // Animation state
    this.transitioning = false;
    this.transitionTarget = null;
    this.transitionProgress = 0;
    
    // Position hints
    this.position = config.position || 'auto';
    this.anchor = config.anchor || 'center';
  }

  /**
   * Begin transition to new state
   */
  transitionTo(newState, duration = 300) {
    if (this.state === newState) return;
    
    this.transitioning = true;
    this.transitionTarget = newState;
    this.transitionProgress = 0;
    this.transitionDuration = duration;
    
    return new Promise(resolve => {
      this.transitionResolve = resolve;
    });
  }

  /**
   * Update transition progress
   */
  updateTransition(deltaTime) {
    if (!this.transitioning) return;
    
    this.transitionProgress += deltaTime / this.transitionDuration;
    
    if (this.transitionProgress >= 1) {
      this.state = this.transitionTarget;
      this.transitioning = false;
      this.transitionTarget = null;
      
      if (this.transitionResolve) {
        this.transitionResolve();
        this.transitionResolve = null;
      }
    }
  }

  /**
   * Get current visual state (accounts for transitions)
   */
  getVisualState() {
    if (!this.transitioning) {
      return { state: this.state, blend: 0 };
    }
    
    return {
      state: this.state,
      targetState: this.transitionTarget,
      blend: this.easeInOut(this.transitionProgress)
    };
  }

  easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

/**
 * Display Manager - orchestrates all UI cards
 */
class DisplayManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.cards = new Map();
    this.activeEffects = new Map();
    
    // Current priority context
    this.priorities = [];
    
    // Global display modifiers (from player conditions)
    this.modifiers = {
      shake: 0,
      blur: 0,
      darken: 0,
      pulse: 0
    };
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.eventBus.on('priorities:updated', (priorities) => this.handlePriorityUpdate(priorities));
    this.eventBus.on('condition:added', (data) => this.handleConditionChange(data, true));
    this.eventBus.on('condition:removed', (data) => this.handleConditionChange(data, false));
  }

  /**
   * Register a card with the display system
   */
  registerCard(cardConfig) {
    const card = new Card(cardConfig);
    this.cards.set(card.id, card);
    return card;
  }

  /**
   * Remove a card
   */
  unregisterCard(cardId) {
    this.cards.delete(cardId);
  }

  /**
   * Handle priority updates from game engine
   */
  handlePriorityUpdate(priorities) {
    this.priorities = priorities;
    this.recalculateCardStates();
  }

  /**
   * Recalculate all card states based on current priorities
   */
  recalculateCardStates() {
    const topPriority = this.priorities[0];
    
    for (const [id, card] of this.cards) {
      const newState = this.determineCardState(card, topPriority);
      
      if (newState !== card.state) {
        card.transitionTo(newState);
      }
    }
  }

  /**
   * Determine what state a card should be in
   */
  determineCardState(card, topPriority) {
    // Special handling for different card types
    switch (card.type) {
      case 'action-palette':
        return this.determineActionPaletteState(card, topPriority);
      
      case 'sloan-panel':
        return this.determineSloanPanelState(card, topPriority);
      
      case 'inventory':
        return this.determineInventoryState(card, topPriority);
      
      case 'vitals':
        return this.determineVitalsState(card, topPriority);
      
      case 'map':
        return this.determineMapState(card, topPriority);
      
      case 'dialogue':
        return this.determineDialogueState(card, topPriority);
      
      default:
        return CARD_STATES.STANDARD;
    }
  }

  determineActionPaletteState(card, topPriority) {
    if (!topPriority) return CARD_STATES.STANDARD;
    
    // NPC engaged - collapse environment actions, show social/combat
    if (topPriority.type === 'npc-interaction') {
      if (card.data.actionType === 'environment') {
        return CARD_STATES.COLLAPSED;
      }
      if (card.data.actionType === 'social' || card.data.actionType === 'combat') {
        return CARD_STATES.EXPANDED;
      }
    }
    
    // Environment focus - expand environment actions
    if (topPriority.type === 'environment-actions') {
      if (card.data.actionType === 'environment') {
        return CARD_STATES.EXPANDED;
      }
      return CARD_STATES.STANDARD;
    }
    
    return CARD_STATES.STANDARD;
  }

  determineSloanPanelState(card, topPriority) {
    // Sloan panel expands when she's speaking
    if (card.data.speaking) {
      return CARD_STATES.EXPANDED;
    }
    
    // Minimize during intense action
    if (topPriority?.type === 'npc-interaction' && topPriority.data.some(npc => npc.awareness === 'hostile')) {
      return CARD_STATES.MINIMIZED;
    }
    
    return CARD_STATES.STANDARD;
  }

  determineInventoryState(card, topPriority) {
    // Collapse inventory during NPC interaction unless specifically needed
    if (topPriority?.type === 'npc-interaction') {
      return CARD_STATES.MINIMIZED;
    }
    
    return CARD_STATES.STANDARD;
  }

  determineVitalsState(card, topPriority) {
    // Always visible, but expand if critical
    if (card.data.critical) {
      return CARD_STATES.EXPANDED;
    }
    
    return CARD_STATES.STANDARD;
  }

  determineMapState(card, topPriority) {
    // Map should minimize during active situations
    if (topPriority?.type === 'npc-interaction') {
      return CARD_STATES.MINIMIZED;
    }
    
    // Expand when explicitly studying
    if (card.data.studying) {
      return CARD_STATES.EXPANDED;
    }
    
    return CARD_STATES.STANDARD;
  }

  determineDialogueState(card, topPriority) {
    // Dialogue always expanded when active
    if (topPriority?.type === 'npc-interaction' && card.data.active) {
      return CARD_STATES.EXPANDED;
    }
    
    return CARD_STATES.COLLAPSED;
  }

  /**
   * Handle condition changes affecting display
   */
  handleConditionChange(data, added) {
    const { conditionId } = data;
    
    // Map conditions to display effects
    const effectMap = {
      'high-stress': { shake: 0.3, pulse: 0.5 },
      'panicked': { shake: 0.6, blur: 0.2, pulse: 0.8 },
      'injured': { darken: 0.1, pulse: 0.3 },
      'critical': { darken: 0.3, pulse: 0.9 },
      'hidden': { darken: 0.2 }
    };
    
    if (effectMap[conditionId]) {
      if (added) {
        this.activeEffects.set(conditionId, effectMap[conditionId]);
      } else {
        this.activeEffects.delete(conditionId);
      }
      
      this.recalculateModifiers();
    }
  }

  /**
   * Recalculate global modifiers from active effects
   */
  recalculateModifiers() {
    // Reset
    this.modifiers = { shake: 0, blur: 0, darken: 0, pulse: 0 };
    
    // Accumulate effects
    for (const effect of this.activeEffects.values()) {
      for (const [key, value] of Object.entries(effect)) {
        this.modifiers[key] = Math.min(1, this.modifiers[key] + value);
      }
    }
    
    this.eventBus.emit('display:modifiersChanged', this.modifiers);
  }

  /**
   * Create a popup card
   */
  popup(config) {
    const card = new Card({
      ...config,
      state: CARD_STATES.POPUP,
      position: 'center'
    });
    
    this.cards.set(card.id, card);
    
    // Auto-dismiss after duration
    if (config.duration) {
      setTimeout(() => {
        card.transitionTo(CARD_STATES.COLLAPSED).then(() => {
          this.cards.delete(card.id);
        });
      }, config.duration);
    }
    
    return card;
  }

  /**
   * Get render state for all cards
   */
  getRenderState() {
    const state = {
      cards: [],
      modifiers: this.modifiers
    };
    
    for (const card of this.cards.values()) {
      state.cards.push({
        id: card.id,
        type: card.type,
        data: card.data,
        visual: card.getVisualState(),
        position: card.position,
        anchor: card.anchor
      });
    }
    
    // Sort by priority
    state.cards.sort((a, b) => (b.data.priority || 0) - (a.data.priority || 0));
    
    return state;
  }

  /**
   * Update - called each frame
   */
  update(deltaTime) {
    for (const card of this.cards.values()) {
      card.updateTransition(deltaTime);
    }
  }
}

export { Card, DisplayManager, CARD_STATES };
