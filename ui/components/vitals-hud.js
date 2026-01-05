/**
 * VITALS HUD COMPONENT
 * Health, stamina, stress, and detection bars with condition indicators
 */

import { VITAL_THRESHOLDS } from '../../core/constants.js';

class VitalsHUD {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    
    this.vitals = {
      health: 100,
      stamina: 100,
      stress: 0,
      detection: 0
    };
    
    this.conditions = [];
    this.pulseRate = 72;
    this.animationFrame = null;
    
    this.setupContainer();
    this.setupEventListeners();
    this.startPulseAnimation();
  }

  setupContainer() {
    this.container.innerHTML = '';
    this.container.className = 'vitals-hud';

    // Health bar
    this.healthBar = this.createVitalBar('health', 'Health', '#00ff88', 100);
    this.container.appendChild(this.healthBar.container);

    // Stamina bar
    this.staminaBar = this.createVitalBar('stamina', 'Stamina', '#00d4ff', 100);
    this.container.appendChild(this.staminaBar.container);

    // Stress bar (inverted - low is good)
    this.stressBar = this.createVitalBar('stress', 'Stress', '#ff6b6b', 0);
    this.container.appendChild(this.stressBar.container);

    // Detection bar
    this.detectionBar = this.createVitalBar('detection', 'Detection', '#ffc107', 0);
    this.container.appendChild(this.detectionBar.container);

    // Condition icons
    this.conditionContainer = document.createElement('div');
    this.conditionContainer.className = 'condition-icons';
    this.container.appendChild(this.conditionContainer);

    // Pulse indicator
    this.pulseIndicator = document.createElement('div');
    this.pulseIndicator.className = 'pulse-indicator';
    this.pulseIndicator.innerHTML = `
      <span class="pulse-icon">❤</span>
      <span class="pulse-rate">${this.pulseRate}</span>
    `;
    this.container.appendChild(this.pulseIndicator);
  }

  createVitalBar(id, label, color, initialValue) {
    const container = document.createElement('div');
    container.className = `vital-bar vital-${id}`;
    container.dataset.vital = id;

    container.innerHTML = `
      <div class="vital-label">
        <span class="vital-name">${label}</span>
        <span class="vital-value">${initialValue}</span>
      </div>
      <div class="vital-track">
        <div class="vital-fill" style="width: ${initialValue}%; background: ${color}"></div>
        <div class="vital-thresholds"></div>
      </div>
    `;

    const fill = container.querySelector('.vital-fill');
    const value = container.querySelector('.vital-value');

    return {
      container,
      fill,
      value,
      color
    };
  }

  setupEventListeners() {
    this.eventBus.on('vitals:updated', (data) => {
      this.updateVitals(data);
    });

    this.eventBus.on('condition:added', (data) => {
      this.addCondition(data.conditionId);
    });

    this.eventBus.on('condition:removed', (data) => {
      this.removeCondition(data.conditionId);
    });

    this.eventBus.on('pulse:updated', (data) => {
      this.updatePulse(data.rate);
    });
  }

  /**
   * Update all vitals
   */
  updateVitals(vitals) {
    this.vitals = { ...this.vitals, ...vitals };
    
    this.updateBar(this.healthBar, this.vitals.health, 'health');
    this.updateBar(this.staminaBar, this.vitals.stamina, 'stamina');
    this.updateBar(this.stressBar, this.vitals.stress, 'stress');
    this.updateBar(this.detectionBar, this.vitals.detection, 'detection');

    // Update pulse based on stress
    this.pulseRate = 72 + Math.floor(this.vitals.stress * 0.8);
    this.updatePulse(this.pulseRate);
  }

  /**
   * Update a specific bar
   */
  updateBar(bar, value, type) {
    const clampedValue = Math.max(0, Math.min(100, value));
    
    // Animate the fill
    bar.fill.style.width = `${clampedValue}%`;
    bar.value.textContent = Math.round(clampedValue);

    // Update color based on thresholds
    const color = this.getBarColor(type, clampedValue);
    bar.fill.style.background = color;

    // Add warning class if critical
    const isCritical = this.isCritical(type, clampedValue);
    bar.container.classList.toggle('critical', isCritical);
    bar.container.classList.toggle('warning', this.isWarning(type, clampedValue) && !isCritical);
  }

  /**
   * Get bar color based on type and value
   */
  getBarColor(type, value) {
    const gradients = {
      health: [
        { threshold: 100, color: '#00ff88' },
        { threshold: 70, color: '#88ff00' },
        { threshold: 50, color: '#ffcc00' },
        { threshold: 30, color: '#ff6600' },
        { threshold: 0, color: '#ff0000' }
      ],
      stamina: [
        { threshold: 100, color: '#00d4ff' },
        { threshold: 50, color: '#0088ff' },
        { threshold: 20, color: '#6666ff' },
        { threshold: 0, color: '#9966ff' }
      ],
      stress: [
        { threshold: 0, color: '#00ff88' },
        { threshold: 30, color: '#88ff00' },
        { threshold: 50, color: '#ffcc00' },
        { threshold: 70, color: '#ff6600' },
        { threshold: 90, color: '#ff0000' }
      ],
      detection: [
        { threshold: 0, color: '#00ff88' },
        { threshold: 20, color: '#88ff00' },
        { threshold: 40, color: '#ffcc00' },
        { threshold: 60, color: '#ff9900' },
        { threshold: 80, color: '#ff4400' }
      ]
    };

    const thresholds = gradients[type] || gradients.health;
    
    // For inverted bars (stress, detection), higher is worse
    for (const t of thresholds) {
      if (type === 'health' || type === 'stamina') {
        if (value >= t.threshold) return t.color;
      } else {
        if (value <= t.threshold) return t.color;
      }
    }

    return thresholds[thresholds.length - 1].color;
  }

  /**
   * Check if value is critical
   */
  isCritical(type, value) {
    switch (type) {
      case 'health': return value <= VITAL_THRESHOLDS.HEALTH.CRITICAL;
      case 'stamina': return value <= 10;
      case 'stress': return value >= VITAL_THRESHOLDS.STRESS.CRITICAL;
      case 'detection': return value >= VITAL_THRESHOLDS.DETECTION.SPOTTED;
      default: return false;
    }
  }

  /**
   * Check if value is in warning range
   */
  isWarning(type, value) {
    switch (type) {
      case 'health': return value <= VITAL_THRESHOLDS.HEALTH.WOUNDED;
      case 'stamina': return value <= 30;
      case 'stress': return value >= VITAL_THRESHOLDS.STRESS.HIGH;
      case 'detection': return value >= VITAL_THRESHOLDS.DETECTION.SUSPICIOUS;
      default: return false;
    }
  }

  /**
   * Add a condition icon
   */
  addCondition(conditionId) {
    if (this.conditions.includes(conditionId)) return;

    this.conditions.push(conditionId);

    const icon = document.createElement('div');
    icon.className = `condition-icon condition-${conditionId}`;
    icon.dataset.condition = conditionId;
    icon.innerHTML = `
      <span class="icon">${this.getConditionIcon(conditionId)}</span>
      <span class="tooltip">${this.getConditionLabel(conditionId)}</span>
    `;

    this.conditionContainer.appendChild(icon);

    // Animate in
    requestAnimationFrame(() => {
      icon.classList.add('active');
    });
  }

  /**
   * Remove a condition icon
   */
  removeCondition(conditionId) {
    const index = this.conditions.indexOf(conditionId);
    if (index === -1) return;

    this.conditions.splice(index, 1);

    const icon = this.conditionContainer.querySelector(`[data-condition="${conditionId}"]`);
    if (icon) {
      icon.classList.remove('active');
      icon.classList.add('removing');
      setTimeout(() => icon.remove(), 300);
    }
  }

  /**
   * Get condition icon
   */
  getConditionIcon(conditionId) {
    const icons = {
      'high-stress': '😰',
      'panicked': '😱',
      'injured': '🩹',
      'critical': '💔',
      'exhausted': '😫',
      'hidden': '👁️‍🗨️',
      'spotted': '⚠️',
      'illuminated': '💡',
      'adrenaline': '⚡',
      'unconscious': '💤',
      'bleeding': '🩸',
      'sloan-static': '📡',
      'sloan-offline': '📵'
    };
    return icons[conditionId] || '❓';
  }

  /**
   * Get condition label
   */
  getConditionLabel(conditionId) {
    const labels = {
      'high-stress': 'High Stress',
      'panicked': 'Panicked',
      'injured': 'Injured',
      'critical': 'Critical',
      'exhausted': 'Exhausted',
      'hidden': 'Hidden',
      'spotted': 'Spotted',
      'illuminated': 'In Light',
      'adrenaline': 'Adrenaline Rush',
      'unconscious': 'Unconscious',
      'bleeding': 'Bleeding',
      'sloan-static': 'Sloan: Static',
      'sloan-offline': 'Sloan: Offline'
    };
    return labels[conditionId] || conditionId;
  }

  /**
   * Update pulse indicator
   */
  updatePulse(rate) {
    this.pulseRate = rate;
    const rateEl = this.pulseIndicator.querySelector('.pulse-rate');
    rateEl.textContent = Math.round(rate);

    // Update animation speed based on rate
    const duration = 60 / rate; // Convert BPM to seconds
    this.pulseIndicator.style.setProperty('--pulse-duration', `${duration}s`);

    // Color based on rate
    if (rate > 120) {
      this.pulseIndicator.className = 'pulse-indicator pulse-high';
    } else if (rate > 90) {
      this.pulseIndicator.className = 'pulse-indicator pulse-elevated';
    } else {
      this.pulseIndicator.className = 'pulse-indicator';
    }
  }

  /**
   * Start pulse animation
   */
  startPulseAnimation() {
    const icon = this.pulseIndicator.querySelector('.pulse-icon');
    
    const animate = () => {
      if (!this.pulseIndicator.isConnected) return;
      
      icon.classList.add('beat');
      setTimeout(() => icon.classList.remove('beat'), 100);
      
      const interval = 60000 / this.pulseRate;
      setTimeout(() => this.animationFrame = requestAnimationFrame(animate), interval);
    };

    animate();
  }

  /**
   * Flash a specific vital (for damage/healing effects)
   */
  flashVital(vitalId, color = '#ffffff') {
    const bar = this[`${vitalId}Bar`];
    if (!bar) return;

    bar.container.style.boxShadow = `0 0 10px ${color}`;
    setTimeout(() => {
      bar.container.style.boxShadow = '';
    }, 200);
  }

  /**
   * Update all conditions at once
   */
  setConditions(conditions) {
    // Remove conditions not in new list
    for (const existing of [...this.conditions]) {
      if (!conditions.includes(existing)) {
        this.removeCondition(existing);
      }
    }

    // Add new conditions
    for (const condition of conditions) {
      if (!this.conditions.includes(condition)) {
        this.addCondition(condition);
      }
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
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.container.innerHTML = '';
    this.eventBus.off('vitals:updated');
    this.eventBus.off('condition:added');
    this.eventBus.off('condition:removed');
    this.eventBus.off('pulse:updated');
  }
}

export { VitalsHUD };
