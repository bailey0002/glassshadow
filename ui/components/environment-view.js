/**
 * ENVIRONMENT VIEW COMPONENT
 * Displays current room description, elements, exits, and NPC presence
 */

class EnvironmentView {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    
    this.currentEnvironment = null;
    this.npcsInRoom = [];
    this.visitedRooms = new Set();
    
    this.setupContainer();
    this.setupEventListeners();
  }

  setupContainer() {
    this.container.innerHTML = '';
    this.container.className = 'environment-view';

    // Room header
    this.headerEl = document.createElement('div');
    this.headerEl.className = 'env-header';
    this.container.appendChild(this.headerEl);

    // Room description
    this.descriptionEl = document.createElement('div');
    this.descriptionEl.className = 'env-description';
    this.container.appendChild(this.descriptionEl);

    // Attributes (lighting, noise, etc.)
    this.attributesEl = document.createElement('div');
    this.attributesEl.className = 'env-attributes';
    this.container.appendChild(this.attributesEl);

    // NPC presence indicators
    this.npcsEl = document.createElement('div');
    this.npcsEl.className = 'env-npcs';
    this.container.appendChild(this.npcsEl);

    // Interactive elements
    this.elementsEl = document.createElement('div');
    this.elementsEl.className = 'env-elements';
    this.container.appendChild(this.elementsEl);

    // Exits
    this.exitsEl = document.createElement('div');
    this.exitsEl.className = 'env-exits';
    this.container.appendChild(this.exitsEl);
  }

  setupEventListeners() {
    this.eventBus.on('room:entered', (data) => {
      this.setEnvironment(data.environment);
    });

    this.eventBus.on('npcs:updated', (data) => {
      this.updateNPCs(data.npcs);
    });

    // Click handlers for elements and exits
    this.elementsEl.addEventListener('click', (e) => {
      const item = e.target.closest('.element-item');
      if (item) {
        this.onElementClick(item.dataset.elementId);
      }
    });

    this.exitsEl.addEventListener('click', (e) => {
      const exit = e.target.closest('.exit-item');
      if (exit && !exit.classList.contains('locked')) {
        this.onExitClick(exit.dataset.destination);
      }
    });
  }

  /**
   * Set the current environment
   */
  setEnvironment(environment) {
    this.currentEnvironment = environment;
    
    const isFirstVisit = !this.visitedRooms.has(environment.id);
    this.visitedRooms.add(environment.id);

    this.render(isFirstVisit);
  }

  /**
   * Render the environment view
   */
  render(isFirstVisit = false) {
    if (!this.currentEnvironment) return;

    const env = this.currentEnvironment;

    // Header
    this.headerEl.innerHTML = `
      <h2 class="room-name">${env.name}</h2>
      <span class="room-type">${this.formatType(env.type)}</span>
    `;

    // Description (different for first visit vs return)
    const description = this.getDescription(env, isFirstVisit);
    this.descriptionEl.innerHTML = `<p>${description}</p>`;

    // Attributes
    this.renderAttributes(env.attributes);

    // Elements
    this.renderElements(env.elements);

    // Exits
    this.renderExits(env.exits);

    // NPCs (rendered separately when updated)
    this.updateNPCs(this.npcsInRoom);

    // Animation
    this.container.classList.add('entering');
    setTimeout(() => this.container.classList.remove('entering'), 300);
  }

  /**
   * Get description based on context
   */
  getDescription(env, isFirstVisit) {
    // Could be expanded to use narration.json
    let desc = env.description;

    if (this.npcsInRoom.length > 0) {
      const npcCount = this.npcsInRoom.length;
      if (npcCount === 1) {
        desc += ` ${this.getNPCPresenceText(this.npcsInRoom[0])}`;
      } else {
        desc += ` There are ${npcCount} people here.`;
      }
    }

    return desc;
  }

  /**
   * Get NPC presence text
   */
  getNPCPresenceText(npc) {
    const behaviors = {
      patrol: 'paces through the area',
      stationary: 'stands nearby',
      worker: 'is busy working',
      guard: 'watches the area carefully',
      wander: 'moves about aimlessly'
    };

    const behavior = behaviors[npc.behavior] || 'is here';
    return `A ${npc.type} ${behavior}.`;
  }

  /**
   * Render environment attributes
   */
  renderAttributes(attributes) {
    if (!attributes) {
      this.attributesEl.innerHTML = '';
      return;
    }

    const attrIcons = {
      lighting: { dark: '🌑', dim: '🌙', normal: '💡', bright: '☀️' },
      noise: { silent: '🔇', quiet: '🔈', normal: '🔉', loud: '🔊' },
      cover: { none: '🚫', sparse: '🌿', moderate: '🪴', heavy: '🌲' },
      security: { none: '🟢', low: '🟡', medium: '🟠', high: '🔴', maximum: '⛔' }
    };

    const items = [];
    for (const [attr, value] of Object.entries(attributes)) {
      const icons = attrIcons[attr];
      const icon = icons ? icons[value] || '❓' : '❓';
      items.push(`
        <div class="attribute-item" title="${this.formatAttribute(attr)}: ${value}">
          <span class="attr-icon">${icon}</span>
          <span class="attr-label">${this.formatAttribute(attr)}</span>
          <span class="attr-value">${value}</span>
        </div>
      `);
    }

    this.attributesEl.innerHTML = items.join('');
  }

  /**
   * Render interactive elements
   */
  renderElements(elements) {
    if (!elements || elements.length === 0) {
      this.elementsEl.innerHTML = '<div class="no-elements">Nothing of interest.</div>';
      return;
    }

    const interactiveElements = elements.filter(el => el.interactive);
    
    if (interactiveElements.length === 0) {
      this.elementsEl.innerHTML = '';
      return;
    }

    const items = interactiveElements.map(el => `
      <div class="element-item ${el.isObjective ? 'objective' : ''}" 
           data-element-id="${el.id}"
           title="${el.type}">
        <span class="element-icon">${this.getElementIcon(el.type)}</span>
        <span class="element-name">${el.name}</span>
        <span class="element-action">${el.defaultAction}</span>
        ${el.isObjective ? '<span class="objective-marker">★</span>' : ''}
      </div>
    `);

    this.elementsEl.innerHTML = `
      <div class="section-header">Points of Interest</div>
      <div class="elements-list">${items.join('')}</div>
    `;
  }

  /**
   * Render exits
   */
  renderExits(exits) {
    if (!exits || exits.length === 0) {
      this.exitsEl.innerHTML = '<div class="no-exits">No exits.</div>';
      return;
    }

    const items = exits.map(exit => `
      <div class="exit-item ${exit.locked ? 'locked' : ''}" 
           data-destination="${exit.destination}"
           title="${exit.locked ? 'Locked' : 'Unlocked'}">
        <span class="exit-icon">${this.getExitIcon(exit)}</span>
        <span class="exit-label">${exit.label}</span>
        ${exit.locked ? `<span class="lock-indicator">🔒 Lvl ${exit.keycardLevel || '?'}</span>` : ''}
      </div>
    `);

    this.exitsEl.innerHTML = `
      <div class="section-header">Exits</div>
      <div class="exits-list">${items.join('')}</div>
    `;
  }

  /**
   * Update NPC presence
   */
  updateNPCs(npcs) {
    this.npcsInRoom = npcs || [];

    if (this.npcsInRoom.length === 0) {
      this.npcsEl.innerHTML = '';
      return;
    }

    const items = this.npcsInRoom.map(npc => {
      const awarenessClass = this.getAwarenessClass(npc.awareness);
      return `
        <div class="npc-indicator ${awarenessClass}">
          <span class="npc-icon">${this.getNPCIcon(npc.type)}</span>
          <span class="npc-name">${npc.name}</span>
          <span class="npc-awareness">${this.formatAwareness(npc.awareness)}</span>
        </div>
      `;
    });

    this.npcsEl.innerHTML = `
      <div class="section-header">People Present</div>
      <div class="npcs-list">${items.join('')}</div>
    `;
  }

  /**
   * Handle element click
   */
  onElementClick(elementId) {
    const element = this.currentEnvironment.elements.find(el => el.id === elementId);
    if (!element) return;

    this.eventBus.emit('element:selected', { element });
    this.eventBus.emit('action:execute', {
      verb: element.defaultAction,
      target: elementId
    });
  }

  /**
   * Handle exit click
   */
  onExitClick(destination) {
    this.eventBus.emit('action:execute', {
      verb: 'move',
      target: destination
    });
  }

  /**
   * Get element icon
   */
  getElementIcon(type) {
    const icons = {
      computer: '💻',
      terminal: '🖥️',
      furniture: '🪑',
      door: '🚪',
      hazard: '⚠️',
      item: '📦',
      decoration: '🌿',
      container: '📦'
    };
    return icons[type] || '•';
  }

  /**
   * Get exit icon
   */
  getExitIcon(exit) {
    const icons = {
      door: '🚪',
      elevator: '🛗',
      stairs: '🪜',
      hatch: '🕳️',
      vent: '🔲',
      window: '🪟'
    };
    return icons[exit.type] || '→';
  }

  /**
   * Get NPC icon
   */
  getNPCIcon(type) {
    const icons = {
      guard: '💂',
      tech: '👨‍💻',
      receptionist: '🧑‍💼',
      executive: '👔',
      worker: '👷'
    };
    return icons[type] || '👤';
  }

  /**
   * Get awareness class for styling
   */
  getAwarenessClass(awareness) {
    const classes = {
      unaware: 'awareness-unaware',
      suspicious: 'awareness-suspicious',
      alert: 'awareness-alert',
      hostile: 'awareness-hostile',
      allied: 'awareness-allied',
      neutral: 'awareness-neutral'
    };
    return classes[awareness] || '';
  }

  /**
   * Format awareness for display
   */
  formatAwareness(awareness) {
    const labels = {
      unaware: 'Unaware',
      suspicious: '❓ Suspicious',
      alert: '❗ Alert',
      hostile: '⚔️ Hostile',
      allied: '✓ Friendly',
      neutral: '— Neutral'
    };
    return labels[awareness] || awareness;
  }

  /**
   * Format attribute name
   */
  formatAttribute(attr) {
    return attr.charAt(0).toUpperCase() + attr.slice(1);
  }

  /**
   * Format room type
   */
  formatType(type) {
    const types = {
      interior: 'Indoor',
      corridor: 'Corridor',
      exterior: 'Outdoor',
      stairwell: 'Stairs',
      elevator: 'Elevator'
    };
    return types[type] || type;
  }

  /**
   * Highlight an element
   */
  highlightElement(elementId) {
    const elements = this.elementsEl.querySelectorAll('.element-item');
    elements.forEach(el => el.classList.remove('highlighted'));

    const target = this.elementsEl.querySelector(`[data-element-id="${elementId}"]`);
    if (target) {
      target.classList.add('highlighted');
    }
  }

  /**
   * Apply visual state
   */
  applyState(state) {
    this.container.dataset.state = state;
  }

  /**
   * Destroy component
   */
  destroy() {
    this.container.innerHTML = '';
    this.eventBus.off('room:entered');
    this.eventBus.off('npcs:updated');
  }
}

export { EnvironmentView };
