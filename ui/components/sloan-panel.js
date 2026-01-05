/**
 * SLOAN PANEL COMPONENT
 * Message display with typewriter effect and connection quality indicator
 */

class SloanPanel {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    
    this.messages = [];
    this.maxMessages = 10;
    this.connectionQuality = 100;
    this.isTyping = false;
    this.typewriterSpeed = 30; // ms per character
    this.currentTypingMessage = null;
    
    this.setupContainer();
    this.setupEventListeners();
  }

  setupContainer() {
    this.container.innerHTML = '';
    this.container.className = 'sloan-panel';

    // Header with connection indicator
    this.header = document.createElement('div');
    this.header.className = 'sloan-header';
    this.header.innerHTML = `
      <div class="sloan-identity">
        <span class="sloan-icon">📡</span>
        <span class="sloan-name">SLOAN</span>
      </div>
      <div class="connection-indicator">
        <div class="connection-bars">
          <span class="bar bar-1"></span>
          <span class="bar bar-2"></span>
          <span class="bar bar-3"></span>
          <span class="bar bar-4"></span>
        </div>
        <span class="connection-label">CONNECTED</span>
      </div>
    `;
    this.container.appendChild(this.header);

    // Message area
    this.messageArea = document.createElement('div');
    this.messageArea.className = 'sloan-messages';
    this.container.appendChild(this.messageArea);

    // Static overlay for degraded connection
    this.staticOverlay = document.createElement('div');
    this.staticOverlay.className = 'static-overlay';
    this.container.appendChild(this.staticOverlay);
  }

  setupEventListeners() {
    this.eventBus.on('sloan:speak', (data) => {
      this.addMessage(data.message, data.connectionQuality);
    });

    this.eventBus.on('connection:changed', (data) => {
      this.updateConnectionQuality(data.quality);
    });

    this.eventBus.on('sloan:modeChanged', (data) => {
      this.showModeIndicator(data.mode);
    });
  }

  /**
   * Add a new message with typewriter effect
   */
  addMessage(text, quality = 100) {
    // Cancel any current typing
    if (this.currentTypingMessage) {
      this.finishTyping();
    }

    const message = {
      id: Date.now(),
      text,
      quality,
      timestamp: new Date()
    };

    this.messages.push(message);

    // Trim old messages
    while (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    this.renderNewMessage(message);
  }

  /**
   * Render a new message with typewriter effect
   */
  renderNewMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'sloan-message';
    messageEl.dataset.id = message.id;

    // Time indicator
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = this.formatTime(message.timestamp);
    messageEl.appendChild(time);

    // Message text
    const textEl = document.createElement('span');
    textEl.className = 'message-text';
    messageEl.appendChild(textEl);

    // Add to message area
    this.messageArea.appendChild(messageEl);
    this.messageArea.scrollTop = this.messageArea.scrollHeight;

    // Apply static effect if low quality
    if (message.quality < 50) {
      messageEl.classList.add('degraded');
    }

    // Typewriter effect
    this.typewriterEffect(textEl, message.text);
  }

  /**
   * Typewriter effect for message text
   */
  typewriterEffect(element, text) {
    this.isTyping = true;
    this.currentTypingMessage = { element, text, index: 0 };

    const type = () => {
      if (!this.currentTypingMessage) return;
      
      const { element, text, index } = this.currentTypingMessage;
      
      if (index < text.length) {
        // Add static glitch occasionally during low connection
        if (this.connectionQuality < 50 && Math.random() < 0.1) {
          element.textContent += this.getStaticChar();
          setTimeout(() => {
            element.textContent = element.textContent.slice(0, -1);
            element.textContent += text[index];
            this.currentTypingMessage.index++;
            setTimeout(type, this.typewriterSpeed);
          }, 50);
        } else {
          element.textContent += text[index];
          this.currentTypingMessage.index++;
          setTimeout(type, this.typewriterSpeed);
        }
      } else {
        this.isTyping = false;
        this.currentTypingMessage = null;
        element.parentElement.classList.add('complete');
      }
    };

    // Slight delay before starting
    setTimeout(type, 200);
  }

  /**
   * Finish typing immediately
   */
  finishTyping() {
    if (this.currentTypingMessage) {
      const { element, text } = this.currentTypingMessage;
      element.textContent = text;
      element.parentElement.classList.add('complete');
      this.isTyping = false;
      this.currentTypingMessage = null;
    }
  }

  /**
   * Update connection quality indicator
   */
  updateConnectionQuality(quality) {
    this.connectionQuality = quality;

    const bars = this.container.querySelectorAll('.bar');
    const label = this.container.querySelector('.connection-label');
    const indicator = this.container.querySelector('.connection-indicator');

    // Update bars
    bars.forEach((bar, index) => {
      const threshold = (index + 1) * 25;
      bar.classList.toggle('active', quality >= threshold);
    });

    // Update label and class
    if (quality >= 75) {
      label.textContent = 'CONNECTED';
      indicator.className = 'connection-indicator quality-good';
    } else if (quality >= 50) {
      label.textContent = 'WEAK SIGNAL';
      indicator.className = 'connection-indicator quality-weak';
    } else if (quality >= 20) {
      label.textContent = 'STATIC';
      indicator.className = 'connection-indicator quality-static';
    } else {
      label.textContent = 'OFFLINE';
      indicator.className = 'connection-indicator quality-offline';
    }

    // Show/hide static overlay
    this.staticOverlay.style.opacity = quality < 50 ? ((50 - quality) / 100) : 0;
  }

  /**
   * Show mode indicator briefly
   */
  showModeIndicator(mode) {
    const modeLabels = {
      cautious: '⚠️ CAUTIOUS MODE',
      balanced: '⚖️ BALANCED MODE',
      aggressive: '⚡ AGGRESSIVE MODE'
    };

    const indicator = document.createElement('div');
    indicator.className = 'mode-indicator';
    indicator.textContent = modeLabels[mode] || mode;
    
    this.container.appendChild(indicator);

    setTimeout(() => {
      indicator.classList.add('fade-out');
      setTimeout(() => indicator.remove(), 300);
    }, 2000);
  }

  /**
   * Get a random static character
   */
  getStaticChar() {
    const chars = '█▓▒░╔╗╚╝║═┌┐└┘├┤┬┴┼';
    return chars[Math.floor(Math.random() * chars.length)];
  }

  /**
   * Format timestamp
   */
  formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Clear all messages
   */
  clearMessages() {
    this.messages = [];
    this.messageArea.innerHTML = '';
  }

  /**
   * Force Sloan to display a message immediately
   */
  forceMessage(text) {
    this.addMessage(text, this.connectionQuality);
  }

  /**
   * Update panel visibility
   */
  setVisible(visible) {
    this.container.style.display = visible ? 'flex' : 'none';
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
    this.finishTyping();
    this.container.innerHTML = '';
    this.eventBus.off('sloan:speak');
    this.eventBus.off('connection:changed');
    this.eventBus.off('sloan:modeChanged');
  }
}

export { SloanPanel };
