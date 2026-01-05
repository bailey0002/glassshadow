/**
 * ACTION CARD COMPONENT
 * Renders individual action buttons with state management
 */

class ActionCard {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.actions = [];
    this.selectedAction = null;
    this.categoryFilter = null;
    
    this.setupContainer();
    this.setupEventListeners();
  }

  setupContainer() {
    this.container.innerHTML = '';
    this.container.className = 'action-card';
    
    // Header
    this.header = document.createElement('div');
    this.header.className = 'action-card-header';
    this.header.innerHTML = `
      <span class="action-card-title">Actions</span>
      <div class="action-card-filters"></div>
    `;
    this.container.appendChild(this.header);
    
    // Action list
    this.actionList = document.createElement('div');
    this.actionList.className = 'action-list';
    this.container.appendChild(this.actionList);
  }

  setupEventListeners() {
    this.actionList.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.action-btn');
      if (actionBtn && !actionBtn.classList.contains('blocked')) {
        const actionId = actionBtn.dataset.actionId;
        this.executeAction(actionId);
      }
    });

    this.actionList.addEventListener('mouseenter', (e) => {
      const actionBtn = e.target.closest('.action-btn');
      if (actionBtn) {
        this.showActionTooltip(actionBtn);
      }
    }, true);

    this.actionList.addEventListener('mouseleave', (e) => {
      const actionBtn = e.target.closest('.action-btn');
      if (actionBtn) {
        this.hideActionTooltip();
      }
    }, true);
  }

  /**
   * Update with new actions
   */
  update(actions, playerVitals) {
    this.actions = actions;
    this.playerVitals = playerVitals;
    this.render();
  }

  /**
   * Render the action list
   */
  render() {
    this.actionList.innerHTML = '';

    // Group actions by type
    const grouped = this.groupActions(this.actions);

    for (const [category, categoryActions] of Object.entries(grouped)) {
      if (this.categoryFilter && this.categoryFilter !== category) continue;
      if (categoryActions.length === 0) continue;

      const categoryEl = document.createElement('div');
      categoryEl.className = 'action-category';
      categoryEl.innerHTML = `<div class="category-label">${this.formatCategory(category)}</div>`;

      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'category-actions';

      for (const action of categoryActions) {
        const actionBtn = this.createActionButton(action);
        actionsContainer.appendChild(actionBtn);
      }

      categoryEl.appendChild(actionsContainer);
      this.actionList.appendChild(categoryEl);
    }
  }

  /**
   * Create an action button element
   */
  createActionButton(action) {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.dataset.actionId = `${action.verb}-${action.target}`;
    btn.dataset.verb = action.verb;
    btn.dataset.target = action.target;

    // Check if action is blocked
    if (action.blocked) {
      btn.classList.add('blocked');
      btn.title = action.blockReason || 'Action unavailable';
    }

    // Check stamina cost
    const staminaCost = this.getStaminaCost(action.verb);
    if (this.playerVitals && this.playerVitals.stamina < staminaCost) {
      btn.classList.add('low-stamina');
    }

    // Risk indicator
    const risk = this.getActionRisk(action.verb);

    btn.innerHTML = `
      <span class="action-icon">${this.getActionIcon(action.verb)}</span>
      <span class="action-label">${action.label}</span>
      ${staminaCost > 0 ? `<span class="action-cost" title="Stamina: ${staminaCost}">${staminaCost}</span>` : ''}
      ${risk !== 'none' ? `<span class="action-risk risk-${risk}" title="Risk: ${risk}"></span>` : ''}
    `;

    // Highlight if objective-related
    if (action.isObjective) {
      btn.classList.add('objective-action');
    }

    return btn;
  }

  /**
   * Execute an action
   */
  executeAction(actionId) {
    const [verb, ...targetParts] = actionId.split('-');
    const target = targetParts.join('-');
    
    const action = this.actions.find(a => a.verb === verb && a.target === target);
    
    if (!action || action.blocked) return;

    this.selectedAction = action;
    this.highlightAction(actionId);

    this.eventBus.emit('action:execute', {
      verb,
      target,
      action
    });
  }

  /**
   * Highlight the selected action
   */
  highlightAction(actionId) {
    const buttons = this.actionList.querySelectorAll('.action-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));

    const selected = this.actionList.querySelector(`[data-action-id="${actionId}"]`);
    if (selected) {
      selected.classList.add('selected');
    }
  }

  /**
   * Show tooltip with action details
   */
  showActionTooltip(actionBtn) {
    const verb = actionBtn.dataset.verb;
    const details = this.getActionDetails(verb);
    
    // Remove existing tooltip
    this.hideActionTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'action-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-title">${this.formatVerb(verb)}</div>
      <div class="tooltip-description">${details.description}</div>
      <div class="tooltip-stats">
        <span>Duration: ${details.duration}s</span>
        <span>Noise: ${details.noise}</span>
      </div>
    `;

    const rect = actionBtn.getBoundingClientRect();
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${rect.top}px`;

    document.body.appendChild(tooltip);
    this.activeTooltip = tooltip;
  }

  hideActionTooltip() {
    if (this.activeTooltip) {
      this.activeTooltip.remove();
      this.activeTooltip = null;
    }
  }

  /**
   * Group actions by category
   */
  groupActions(actions) {
    const groups = {
      movement: [],
      observation: [],
      interaction: [],
      technical: [],
      social: [],
      combat: []
    };

    for (const action of actions) {
      const category = this.getActionCategory(action.verb);
      if (groups[category]) {
        groups[category].push(action);
      }
    }

    return groups;
  }

  /**
   * Get action category
   */
  getActionCategory(verb) {
    const categories = {
      move: 'movement', sneak: 'movement', run: 'movement', hide: 'movement',
      look: 'observation', examine: 'observation', listen: 'observation', search: 'observation',
      take: 'interaction', use: 'interaction', combine: 'interaction', drop: 'interaction',
      hack: 'technical', lockpick: 'technical', disable: 'technical',
      talk: 'social', persuade: 'social', intimidate: 'social', distract: 'social',
      attack: 'combat', subdue: 'combat', flee: 'combat'
    };
    return categories[verb] || 'interaction';
  }

  /**
   * Get action icon
   */
  getActionIcon(verb) {
    const icons = {
      move: '→', sneak: '👣', run: '💨', hide: '🙈',
      look: '👁', examine: '🔍', listen: '👂', search: '🔎',
      take: '✋', use: '⚡', combine: '🔗', drop: '📦',
      hack: '💻', lockpick: '🔓', disable: '⚙️',
      talk: '💬', persuade: '🗣', intimidate: '😠', distract: '🎭',
      attack: '⚔️', subdue: '🤜', flee: '🏃'
    };
    return icons[verb] || '•';
  }

  /**
   * Get stamina cost for action
   */
  getStaminaCost(verb) {
    const costs = {
      move: 5, sneak: 10, run: 20, hide: 5,
      look: 0, examine: 0, listen: 0, search: 10,
      take: 2, use: 5, combine: 0, drop: 0,
      hack: 15, lockpick: 20, disable: 15,
      talk: 0, persuade: 10, intimidate: 15, distract: 10,
      attack: 25, subdue: 30, flee: 15
    };
    return costs[verb] || 0;
  }

  /**
   * Get action risk level
   */
  getActionRisk(verb) {
    const risks = {
      move: 'low', sneak: 'none', run: 'high', hide: 'none',
      look: 'none', examine: 'low', listen: 'none', search: 'medium',
      take: 'low', use: 'low', combine: 'none', drop: 'none',
      hack: 'medium', lockpick: 'high', disable: 'high',
      talk: 'medium', persuade: 'medium', intimidate: 'high', distract: 'medium',
      attack: 'high', subdue: 'high', flee: 'medium'
    };
    return risks[verb] || 'none';
  }

  /**
   * Get action details for tooltip
   */
  getActionDetails(verb) {
    const details = {
      move: { description: 'Walk to a location. May be noticed.', duration: 1, noise: 'normal' },
      sneak: { description: 'Move quietly. Harder to detect.', duration: 2, noise: 'silent' },
      run: { description: 'Sprint quickly. Very noisy.', duration: 0.5, noise: 'loud' },
      hide: { description: 'Conceal yourself from view.', duration: 1, noise: 'silent' },
      look: { description: 'Survey your surroundings.', duration: 0.5, noise: 'silent' },
      examine: { description: 'Inspect something closely.', duration: 2, noise: 'silent' },
      listen: { description: 'Listen for sounds and movement.', duration: 1, noise: 'silent' },
      search: { description: 'Thoroughly search an area.', duration: 5, noise: 'quiet' },
      take: { description: 'Pick up an item.', duration: 0.5, noise: 'silent' },
      use: { description: 'Use an item or interact with something.', duration: 1, noise: 'varies' },
      hack: { description: 'Access a computer system.', duration: 10, noise: 'silent' },
      lockpick: { description: 'Pick a lock without a key.', duration: 15, noise: 'quiet' },
      talk: { description: 'Start a conversation.', duration: 0, noise: 'normal' },
      persuade: { description: 'Convince someone of something.', duration: 0, noise: 'normal' },
      intimidate: { description: 'Threaten to get what you want.', duration: 0, noise: 'normal' },
      distract: { description: 'Draw attention away.', duration: 1, noise: 'varies' },
      attack: { description: 'Attack an enemy.', duration: 1, noise: 'loud' },
      subdue: { description: 'Neutralize without killing.', duration: 2, noise: 'moderate' },
      flee: { description: 'Escape from danger.', duration: 0.5, noise: 'loud' }
    };
    return details[verb] || { description: 'Perform an action.', duration: 1, noise: 'normal' };
  }

  /**
   * Format category name
   */
  formatCategory(category) {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Format verb name
   */
  formatVerb(verb) {
    return verb.charAt(0).toUpperCase() + verb.slice(1);
  }

  /**
   * Set category filter
   */
  setFilter(category) {
    this.categoryFilter = category;
    this.render();
  }

  /**
   * Clear filter
   */
  clearFilter() {
    this.categoryFilter = null;
    this.render();
  }

  /**
   * Destroy component
   */
  destroy() {
    this.hideActionTooltip();
    this.container.innerHTML = '';
  }
}

export { ActionCard };
