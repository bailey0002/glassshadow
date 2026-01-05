/**
 * MACK PANEL COMPONENT
 * UI component for Mack's communications - unreliable specialist
 */

class MackPanel {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    this.visible = false;
    this.currentState = null;
    this.typewriterSpeed = 60; // Slower than Sloan - Mack rambles
    this.currentTypingMessage = null;
    
    this.render();
    this.setupEventListeners();
  }

  render() {
    this.container.innerHTML = '';
    this.container.className = 'mack-panel-container';

    this.panel = document.createElement('div');
    this.panel.className = 'mack-panel';
    this.panel.dataset.visible = 'false';
    this.panel.dataset.state = 'unknown';

    this.panel.innerHTML = `
      <div class="mack-header">
        <div class="mack-identity">
          <span class="mack-icon">🥃</span>
          <span class="mack-name">MACK</span>
        </div>
        <div class="mack-status-container">
          <span class="mack-status"></span>
          <span class="mack-signal">📶</span>
        </div>
      </div>
      <div class="mack-content">
        <div class="mack-message"></div>
      </div>
      <div class="mack-static-overlay"></div>
    `;
    
    this.container.appendChild(this.panel);

    // Cache elements
    this.statusEl = this.panel.querySelector('.mack-status');
    this.messageEl = this.panel.querySelector('.mack-message');
    this.staticOverlay = this.panel.querySelector('.mack-static-overlay');
  }

  setupEventListeners() {
    this.eventBus.on('mack:connecting', (data) => this.showConnecting(data));
    this.eventBus.on('mack:response', (data) => this.showResponse(data));
    this.eventBus.on('mack:busy', (data) => this.showBusy(data));
    this.eventBus.on('mack:soberedUp', (data) => this.showSoberedUp(data));
  }

  showConnecting(data) {
    this.show();
    this.currentState = data.state;
    this.statusEl.textContent = 'CONNECTING...';
    this.messageEl.textContent = '';
    this.applyStateEffects('connecting');
    
    // Show connecting animation
    this.panel.classList.add('connecting');
    setTimeout(() => this.panel.classList.remove('connecting'), 1000);
  }

  showResponse(data) {
    this.currentState = data.state;
    this.statusEl.textContent = this.getStatusText(data.state);
    this.applyStateEffects(data.state);
    
    // Typewriter effect
    this.typeMessage(data.message);
    
    // Auto-hide after delay (longer for drunk messages - they take time to parse)
    const hideDelay = data.state === 'drunk' ? 8000 : 6000;
    setTimeout(() => {
      if (this.visible) {
        this.hide();
      }
    }, hideDelay);
  }

  showBusy(data) {
    this.show();
    this.statusEl.textContent = 'BUSY';
    this.messageEl.textContent = data.message;
    
    setTimeout(() => this.hide(), 2000);
  }

  showSoberedUp(data) {
    // Flash effect when coffee/energy drink is used
    this.panel.classList.add('sobriety-boost');
    setTimeout(() => this.panel.classList.remove('sobriety-boost'), 500);
    
    // Update status
    this.statusEl.textContent = this.getStatusText(data.newState);
    this.applyStateEffects(data.newState);
  }

  typeMessage(message) {
    // Cancel any current typing
    if (this.currentTypingMessage) {
      this.finishTyping();
    }

    this.messageEl.textContent = '';
    let index = 0;
    
    // Slower typing for drunk state
    const typeSpeed = this.currentState === 'drunk' ? 80 : 
                     this.currentState === 'tipsy' ? 50 : 40;
    
    this.currentTypingMessage = { message, index };

    const type = () => {
      if (!this.currentTypingMessage || index >= message.length) {
        this.currentTypingMessage = null;
        return;
      }
      
      // Random pauses for drunk state
      if (this.currentState === 'drunk' && Math.random() < 0.1) {
        setTimeout(type, 300);
        return;
      }
      
      this.messageEl.textContent += message[index];
      index++;
      this.currentTypingMessage.index = index;
      setTimeout(type, typeSpeed + (Math.random() * 20));
    };
    
    type();
  }

  finishTyping() {
    if (this.currentTypingMessage) {
      this.messageEl.textContent = this.currentTypingMessage.message;
      this.currentTypingMessage = null;
    }
  }

  getStatusText(state) {
    switch (state) {
      case 'sharp': return '🟢 CLEAR';
      case 'tipsy': return '🟡 FUZZY';
      case 'drunk': return '🟠 IMPAIRED';
      case 'passedOut': return '🔴 OFFLINE';
      default: return '⚪ UNKNOWN';
    }
  }

  applyStateEffects(state) {
    this.panel.dataset.state = state;
    
    // Static overlay intensity
    switch (state) {
      case 'connecting':
        this.staticOverlay.style.opacity = '0.3';
        break;
      case 'sharp':
        this.staticOverlay.style.opacity = '0.05';
        break;
      case 'tipsy':
        this.staticOverlay.style.opacity = '0.15';
        break;
      case 'drunk':
        this.staticOverlay.style.opacity = '0.35';
        break;
      case 'passedOut':
        this.staticOverlay.style.opacity = '0.6';
        break;
    }
  }

  show() {
    this.visible = true;
    this.panel.dataset.visible = 'true';
  }

  hide() {
    this.visible = false;
    this.panel.dataset.visible = 'false';
    this.currentTypingMessage = null;
  }

  setVisible(visible) {
    if (visible) {
      this.show();
    } else {
      this.hide();
    }
  }

  applyState(state) {
    this.container.dataset.cardState = state;
  }

  destroy() {
    this.finishTyping();
    this.container.innerHTML = '';
  }
}

export { MackPanel };
