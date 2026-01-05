/**
 * OBJECTIVES PANEL COMPONENT
 * Displays mission objectives with completion status
 */

class ObjectivesPanel {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.objectives = [];
    
    this.setupContainer();
    this.setupEventListeners();
  }

  setupContainer() {
    this.container.innerHTML = '';
    this.container.className = 'objectives-panel';

    this.panel = document.createElement('div');
    this.panel.className = 'card objectives-card';
    this.panel.innerHTML = `
      <div class="card-header">
        <span class="card-icon">🎯</span>
        <span class="card-title">OBJECTIVES</span>
      </div>
      <div class="objectives-list"></div>
    `;
    
    this.container.appendChild(this.panel);
    this.listEl = this.panel.querySelector('.objectives-list');
  }

  setupEventListeners() {
    this.eventBus.on('objectives:updated', (data) => {
      this.setObjectives(data.objectives);
    });

    this.eventBus.on('objective:completed', (data) => {
      this.markComplete(data.objectiveId);
    });
  }

  /**
   * Set objectives list
   */
  setObjectives(objectives) {
    this.objectives = objectives || [];
    this.render();
  }

  /**
   * Mark an objective as complete
   */
  markComplete(objectiveId) {
    const obj = this.objectives.find(o => o.id === objectiveId);
    if (obj) {
      obj.completed = true;
      this.render();
      
      // Flash effect
      const el = this.listEl.querySelector(`[data-id="${objectiveId}"]`);
      if (el) {
        el.classList.add('just-completed');
        setTimeout(() => el.classList.remove('just-completed'), 1000);
      }
    }
  }

  /**
   * Render objectives list
   */
  render() {
    this.listEl.innerHTML = '';

    // Required objectives first
    const required = this.objectives.filter(o => !o.optional);
    const optional = this.objectives.filter(o => o.optional);

    if (required.length > 0) {
      const requiredSection = document.createElement('div');
      requiredSection.className = 'objectives-section';
      requiredSection.innerHTML = '<div class="section-label">Required</div>';
      
      for (const obj of required) {
        requiredSection.appendChild(this.createObjectiveItem(obj));
      }
      
      this.listEl.appendChild(requiredSection);
    }

    if (optional.length > 0) {
      const optionalSection = document.createElement('div');
      optionalSection.className = 'objectives-section optional';
      optionalSection.innerHTML = '<div class="section-label">Bonus</div>';
      
      for (const obj of optional) {
        optionalSection.appendChild(this.createObjectiveItem(obj));
      }
      
      this.listEl.appendChild(optionalSection);
    }
  }

  /**
   * Create objective item element
   */
  createObjectiveItem(objective) {
    const item = document.createElement('div');
    item.className = 'objective-item';
    item.dataset.id = objective.id;
    
    if (objective.completed) {
      item.classList.add('completed');
    }
    if (objective.optional) {
      item.classList.add('optional');
    }

    item.innerHTML = `
      <span class="objective-check">${objective.completed ? '✓' : '○'}</span>
      <span class="objective-text">${objective.description}</span>
    `;

    return item;
  }

  /**
   * Get completion stats
   */
  getStats() {
    const required = this.objectives.filter(o => !o.optional);
    const optional = this.objectives.filter(o => o.optional);
    
    return {
      requiredComplete: required.filter(o => o.completed).length,
      requiredTotal: required.length,
      optionalComplete: optional.filter(o => o.completed).length,
      optionalTotal: optional.length,
      allRequiredComplete: required.every(o => o.completed)
    };
  }

  /**
   * Apply visual state
   */
  applyState(state) {
    this.container.dataset.cardState = state;
  }

  /**
   * Set visibility
   */
  setVisible(visible) {
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * Destroy component
   */
  destroy() {
    this.container.innerHTML = '';
  }
}

export { ObjectivesPanel };
