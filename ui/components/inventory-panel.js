/**
 * INVENTORY PANEL COMPONENT
 * Equipment grid with item details and actions
 */

class InventoryPanel {
  constructor(container, eventBus, equipmentData) {
    this.container = container;
    this.eventBus = eventBus;
    this.equipmentData = equipmentData || {};
    
    this.items = [];
    this.selectedItem = null;
    this.maxSlots = 12;
    
    this.setupContainer();
    this.setupEventListeners();
  }

  setupContainer() {
    this.container.innerHTML = '';
    this.container.className = 'inventory-panel';

    // Header
    this.header = document.createElement('div');
    this.header.className = 'inventory-header';
    this.header.innerHTML = `
      <span class="inventory-title">Equipment</span>
      <span class="inventory-capacity">0/${this.maxSlots}</span>
    `;
    this.container.appendChild(this.header);

    // Grid
    this.grid = document.createElement('div');
    this.grid.className = 'inventory-grid';
    this.container.appendChild(this.grid);

    // Item detail panel
    this.detailPanel = document.createElement('div');
    this.detailPanel.className = 'item-detail-panel';
    this.detailPanel.style.display = 'none';
    this.container.appendChild(this.detailPanel);

    // Initialize empty slots
    this.renderSlots();
  }

  setupEventListeners() {
    this.grid.addEventListener('click', (e) => {
      const slot = e.target.closest('.inventory-slot');
      if (slot && slot.dataset.itemId) {
        this.selectItem(slot.dataset.itemId);
      }
    });

    this.grid.addEventListener('dblclick', (e) => {
      const slot = e.target.closest('.inventory-slot');
      if (slot && slot.dataset.itemId) {
        this.useItem(slot.dataset.itemId);
      }
    });

    this.detailPanel.addEventListener('click', (e) => {
      if (e.target.classList.contains('action-use')) {
        this.useItem(this.selectedItem);
      } else if (e.target.classList.contains('action-drop')) {
        this.dropItem(this.selectedItem);
      } else if (e.target.classList.contains('action-examine')) {
        this.examineItem(this.selectedItem);
      }
    });

    this.eventBus.on('inventory:updated', (data) => {
      this.updateItems(data.items);
    });

    this.eventBus.on('item:added', (data) => {
      this.addItem(data.itemId);
    });

    this.eventBus.on('item:removed', (data) => {
      this.removeItem(data.itemId);
    });
  }

  /**
   * Render empty inventory slots
   */
  renderSlots() {
    this.grid.innerHTML = '';

    for (let i = 0; i < this.maxSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'inventory-slot empty';
      slot.dataset.slotIndex = i;
      this.grid.appendChild(slot);
    }
  }

  /**
   * Update with full item list
   */
  updateItems(items) {
    this.items = items || [];
    this.render();
  }

  /**
   * Add a single item
   */
  addItem(itemId) {
    if (!this.items.includes(itemId)) {
      this.items.push(itemId);
      this.render();
      this.flashSlot(this.items.length - 1, 'add');
    }
  }

  /**
   * Remove a single item
   */
  removeItem(itemId) {
    const index = this.items.indexOf(itemId);
    if (index !== -1) {
      this.flashSlot(index, 'remove');
      this.items.splice(index, 1);
      setTimeout(() => this.render(), 200);
    }

    if (this.selectedItem === itemId) {
      this.selectedItem = null;
      this.hideDetail();
    }
  }

  /**
   * Render inventory with current items
   */
  render() {
    const slots = this.grid.querySelectorAll('.inventory-slot');

    slots.forEach((slot, index) => {
      slot.className = 'inventory-slot';
      slot.dataset.itemId = '';
      slot.innerHTML = '';

      if (index < this.items.length) {
        const itemId = this.items[index];
        const item = this.getItemData(itemId);

        slot.dataset.itemId = itemId;
        slot.classList.add('filled');
        slot.classList.add(`category-${item.category || 'misc'}`);

        if (this.selectedItem === itemId) {
          slot.classList.add('selected');
        }

        slot.innerHTML = `
          <span class="item-icon">${item.icon || '📦'}</span>
          <span class="item-name">${item.name || itemId}</span>
        `;

        if (item.quantity > 1) {
          slot.innerHTML += `<span class="item-quantity">${item.quantity}</span>`;
        }

        if (item.isObjective) {
          slot.classList.add('objective-item');
        }
      } else {
        slot.classList.add('empty');
      }
    });

    // Update capacity
    this.header.querySelector('.inventory-capacity').textContent = 
      `${this.items.length}/${this.maxSlots}`;

    // Check capacity warning
    if (this.items.length >= this.maxSlots) {
      this.header.classList.add('full');
    } else if (this.items.length >= this.maxSlots - 2) {
      this.header.classList.add('nearly-full');
      this.header.classList.remove('full');
    } else {
      this.header.classList.remove('full', 'nearly-full');
    }
  }

  /**
   * Get item data from equipment database
   */
  getItemData(itemId) {
    // Check equipment data
    if (this.equipmentData[itemId]) {
      return this.equipmentData[itemId];
    }

    // Fallback to generated data
    return {
      id: itemId,
      name: this.formatItemName(itemId),
      icon: this.getDefaultIcon(itemId),
      description: `A ${this.formatItemName(itemId).toLowerCase()}.`,
      category: 'misc'
    };
  }

  /**
   * Select an item
   */
  selectItem(itemId) {
    this.selectedItem = itemId;
    this.render();
    this.showDetail(itemId);
  }

  /**
   * Show item detail panel
   */
  showDetail(itemId) {
    const item = this.getItemData(itemId);

    this.detailPanel.innerHTML = `
      <div class="detail-header">
        <span class="detail-icon">${item.icon || '📦'}</span>
        <h3 class="detail-name">${item.name}</h3>
      </div>
      <div class="detail-category">${this.formatCategory(item.category)}</div>
      <p class="detail-description">${item.description || 'No description.'}</p>
      ${item.stats ? this.renderStats(item.stats) : ''}
      <div class="detail-actions">
        ${item.usable !== false ? '<button class="action-use">Use</button>' : ''}
        <button class="action-examine">Examine</button>
        ${item.droppable !== false ? '<button class="action-drop">Drop</button>' : ''}
      </div>
    `;

    this.detailPanel.style.display = 'block';
  }

  /**
   * Render item stats
   */
  renderStats(stats) {
    const items = Object.entries(stats).map(([key, value]) => 
      `<div class="stat-item">
        <span class="stat-label">${this.formatStatName(key)}</span>
        <span class="stat-value">${value}</span>
      </div>`
    );

    return `<div class="detail-stats">${items.join('')}</div>`;
  }

  /**
   * Hide detail panel
   */
  hideDetail() {
    this.detailPanel.style.display = 'none';
    this.selectedItem = null;
    this.render();
  }

  /**
   * Use an item
   */
  useItem(itemId) {
    if (!itemId) return;

    const item = this.getItemData(itemId);
    if (item.usable === false) return;

    this.eventBus.emit('action:execute', {
      verb: 'use',
      target: itemId
    });

    this.flashSlot(this.items.indexOf(itemId), 'use');
  }

  /**
   * Drop an item
   */
  dropItem(itemId) {
    if (!itemId) return;

    const item = this.getItemData(itemId);
    if (item.droppable === false) return;

    this.eventBus.emit('action:execute', {
      verb: 'drop',
      target: itemId
    });
  }

  /**
   * Examine an item
   */
  examineItem(itemId) {
    if (!itemId) return;

    this.eventBus.emit('action:execute', {
      verb: 'examine',
      target: itemId
    });
  }

  /**
   * Flash a slot for feedback
   */
  flashSlot(index, type) {
    const slot = this.grid.querySelector(`[data-slot-index="${index}"]`);
    if (!slot) return;

    const flashClass = `flash-${type}`;
    slot.classList.add(flashClass);
    setTimeout(() => slot.classList.remove(flashClass), 300);
  }

  /**
   * Format item name from ID
   */
  formatItemName(itemId) {
    return itemId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get default icon for item
   */
  getDefaultIcon(itemId) {
    const patterns = [
      { match: /key|card/, icon: '🔑' },
      { match: /knife|blade/, icon: '🔪' },
      { match: /gun|pistol/, icon: '🔫' },
      { match: /flash|light/, icon: '🔦' },
      { match: /map/, icon: '🗺️' },
      { match: /vest|armor/, icon: '🦺' },
      { match: /ear|radio|comm/, icon: '🎧' },
      { match: /usb|drive|disk/, icon: '💾' },
      { match: /med|kit|heal/, icon: '🩹' },
      { match: /taser/, icon: '⚡' },
      { match: /lock|pick/, icon: '🔧' },
      { match: /log|record|file/, icon: '📄' }
    ];

    for (const pattern of patterns) {
      if (pattern.match.test(itemId)) {
        return pattern.icon;
      }
    }

    return '📦';
  }

  /**
   * Format category name
   */
  formatCategory(category) {
    const categories = {
      tool: '🔧 Tool',
      weapon: '⚔️ Weapon',
      tech: '💻 Tech',
      key: '🔑 Key Item',
      intel: '📄 Intel',
      consumable: '💊 Consumable',
      clothing: '👔 Clothing',
      misc: '📦 Misc'
    };
    return categories[category] || category;
  }

  /**
   * Format stat name
   */
  formatStatName(stat) {
    return stat.charAt(0).toUpperCase() + stat.slice(1).replace(/([A-Z])/g, ' $1');
  }

  /**
   * Check if inventory is full
   */
  isFull() {
    return this.items.length >= this.maxSlots;
  }

  /**
   * Check if player has item
   */
  hasItem(itemId) {
    return this.items.includes(itemId);
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
    this.eventBus.off('inventory:updated');
    this.eventBus.off('item:added');
    this.eventBus.off('item:removed');
  }
}

export { InventoryPanel };
