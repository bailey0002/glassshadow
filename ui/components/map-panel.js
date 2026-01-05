/**
 * MAP PANEL COMPONENT
 * Toggle between overview and blueprint views with pan/zoom controls
 */

class MapPanel {
  constructor(container, eventBus, mapRenderer) {
    this.container = container;
    this.eventBus = eventBus;
    this.mapRenderer = mapRenderer;
    
    this.viewMode = 'blueprint'; // 'overview' or 'blueprint'
    this.isPanning = false;
    this.lastPanPosition = null;
    
    this.setupContainer();
    this.setupEventListeners();
  }

  setupContainer() {
    this.container.innerHTML = '';
    this.container.className = 'map-panel';

    // Header with controls
    this.header = document.createElement('div');
    this.header.className = 'map-header';
    this.header.innerHTML = `
      <div class="map-title">
        <span class="title-icon">🗺️</span>
        <span class="title-text">Map</span>
      </div>
      <div class="map-controls">
        <button class="view-toggle" data-view="blueprint" title="Room View">
          <span class="btn-icon">📐</span>
        </button>
        <button class="view-toggle" data-view="overview" title="Facility View">
          <span class="btn-icon">🏢</span>
        </button>
        <button class="zoom-btn" data-zoom="in" title="Zoom In">+</button>
        <button class="zoom-btn" data-zoom="out" title="Zoom Out">−</button>
        <button class="reset-btn" title="Reset View">⌖</button>
      </div>
    `;
    this.container.appendChild(this.header);

    // Canvas container
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'map-canvas-container';
    this.container.appendChild(this.canvasContainer);

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'map-canvas';
    this.canvas.width = 400;
    this.canvas.height = 300;
    this.canvasContainer.appendChild(this.canvas);

    // Legend
    this.legend = document.createElement('div');
    this.legend.className = 'map-legend';
    this.container.appendChild(this.legend);

    // Objective markers overlay
    this.markersOverlay = document.createElement('div');
    this.markersOverlay.className = 'map-markers-overlay';
    this.canvasContainer.appendChild(this.markersOverlay);

    // Initialize map renderer with this canvas
    if (this.mapRenderer) {
      this.mapRenderer.canvas = this.canvas;
      this.mapRenderer.ctx = this.canvas.getContext('2d');
    }

    this.updateViewToggle();
  }

  setupEventListeners() {
    // View toggle buttons
    this.header.querySelectorAll('.view-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setViewMode(btn.dataset.view);
      });
    });

    // Zoom buttons
    this.header.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.zoom(btn.dataset.zoom === 'in' ? 1.2 : 0.8);
      });
    });

    // Reset button
    this.header.querySelector('.reset-btn').addEventListener('click', () => {
      this.resetView();
    });

    // Pan functionality
    this.canvas.addEventListener('mousedown', (e) => this.startPan(e));
    this.canvas.addEventListener('mousemove', (e) => this.doPan(e));
    this.canvas.addEventListener('mouseup', () => this.endPan());
    this.canvas.addEventListener('mouseleave', () => this.endPan());

    // Wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(e.deltaY < 0 ? 1.1 : 0.9);
    });

    // Double click to center on location
    this.canvas.addEventListener('dblclick', (e) => {
      this.centerOnClick(e);
    });

    // Event bus listeners
    this.eventBus.on('room:entered', (data) => {
      if (this.mapRenderer) {
        this.mapRenderer.markVisited(data.environment.id);
      }
      this.render();
    });

    this.eventBus.on('map:update', () => {
      this.render();
    });
  }

  /**
   * Set view mode
   */
  setViewMode(mode) {
    if (mode !== 'overview' && mode !== 'blueprint') return;
    
    this.viewMode = mode;
    this.updateViewToggle();
    
    if (this.mapRenderer) {
      this.mapRenderer.setViewMode(mode);
    }
    
    this.render();
    
    this.eventBus.emit('map:viewChanged', { mode });
  }

  /**
   * Update view toggle button states
   */
  updateViewToggle() {
    this.header.querySelectorAll('.view-toggle').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.viewMode);
    });
  }

  /**
   * Zoom in or out
   */
  zoom(factor) {
    if (!this.mapRenderer) return;
    
    const newZoom = Math.max(0.5, Math.min(3, this.mapRenderer.zoom * factor));
    this.mapRenderer.zoom = newZoom;
    this.render();
  }

  /**
   * Reset view to default
   */
  resetView() {
    if (!this.mapRenderer) return;
    
    this.mapRenderer.zoom = 1;
    this.mapRenderer.offset = { x: 0, y: 0 };
    this.render();
  }

  /**
   * Start panning
   */
  startPan(e) {
    this.isPanning = true;
    this.lastPanPosition = { x: e.clientX, y: e.clientY };
    this.canvas.style.cursor = 'grabbing';
  }

  /**
   * Continue panning
   */
  doPan(e) {
    if (!this.isPanning || !this.mapRenderer) return;
    
    const dx = e.clientX - this.lastPanPosition.x;
    const dy = e.clientY - this.lastPanPosition.y;
    
    this.mapRenderer.offset.x += dx;
    this.mapRenderer.offset.y += dy;
    
    this.lastPanPosition = { x: e.clientX, y: e.clientY };
    this.render();
  }

  /**
   * End panning
   */
  endPan() {
    this.isPanning = false;
    this.canvas.style.cursor = 'grab';
  }

  /**
   * Center on clicked location
   */
  centerOnClick(e) {
    if (!this.mapRenderer) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate offset to center this point
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    this.mapRenderer.offset.x += centerX - x;
    this.mapRenderer.offset.y += centerY - y;
    
    this.render();
  }

  /**
   * Render the map
   */
  render(environments, gameState, npcs) {
    if (!this.mapRenderer) return;
    
    if (this.viewMode === 'overview' && environments) {
      this.mapRenderer.renderOverview(environments, [], gameState);
      this.updateLegend('overview');
    } else if (this.viewMode === 'blueprint' && gameState) {
      const currentEnv = environments?.get?.(gameState.currentEnvironment) || 
                        environments?.[gameState.currentEnvironment];
      if (currentEnv) {
        this.mapRenderer.renderBlueprint(currentEnv, gameState, npcs || []);
        this.updateLegend('blueprint', currentEnv);
      }
    }
    
    this.updateMarkers(gameState);
  }

  /**
   * Update legend based on view mode
   */
  updateLegend(mode, environment) {
    if (mode === 'overview') {
      this.legend.innerHTML = `
        <div class="legend-item"><span class="legend-color" style="background: #00ff88"></span>Current</div>
        <div class="legend-item"><span class="legend-color" style="background: #16213e"></span>Visited</div>
        <div class="legend-item"><span class="legend-color" style="background: #ffc107"></span>Objective</div>
      `;
    } else {
      this.legend.innerHTML = `
        <div class="legend-item"><span class="legend-color" style="background: #00ff88"></span>You</div>
        <div class="legend-item"><span class="legend-color" style="background: #888888"></span>NPC</div>
        <div class="legend-item"><span class="legend-color" style="background: #ff4444"></span>Hostile</div>
        <div class="legend-item"><span class="legend-color" style="background: #ffc107"></span>Objective</div>
      `;
    }
  }

  /**
   * Update objective markers
   */
  updateMarkers(gameState) {
    if (!gameState || !gameState.objectives) {
      this.markersOverlay.innerHTML = '';
      return;
    }
    
    // Markers would be positioned based on canvas coordinates
    // This is a simplified version
    const activeObjectives = gameState.objectives.filter(obj => !obj.completed);
    
    this.markersOverlay.innerHTML = activeObjectives.map(obj => `
      <div class="objective-marker" title="${obj.description}">
        <span class="marker-icon">★</span>
      </div>
    `).join('');
  }

  /**
   * Highlight a specific room on the map
   */
  highlightRoom(roomId) {
    // Store highlight state for rendering
    this.highlightedRoom = roomId;
    this.render();
    
    // Clear highlight after a delay
    setTimeout(() => {
      this.highlightedRoom = null;
      this.render();
    }, 2000);
  }

  /**
   * Resize canvas to fit container
   */
  resize() {
    const rect = this.canvasContainer.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.render();
  }

  /**
   * Apply visual state
   */
  applyState(state) {
    this.container.dataset.state = state;
    
    if (state === 'minimized') {
      this.canvas.width = 150;
      this.canvas.height = 100;
    } else {
      this.resize();
    }
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {
    this.container.classList.toggle('fullscreen');
    this.resize();
  }

  /**
   * Destroy component
   */
  destroy() {
    this.container.innerHTML = '';
    this.eventBus.off('room:entered');
    this.eventBus.off('map:update');
  }
}

export { MapPanel };
