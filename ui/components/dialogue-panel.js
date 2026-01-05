/**
 * DIALOGUE PANEL COMPONENT
 * NPC conversation interface with portrait, text, and response options
 */

class DialoguePanel {
  constructor(container, eventBus) {
    this.container = container;
    this.eventBus = eventBus;
    
    this.currentNPC = null;
    this.currentDialogue = null;
    this.dialogueHistory = [];
    this.isTyping = false;
    this.typewriterSpeed = 25;
    
    this.setupContainer();
    this.setupEventListeners();
  }

  setupContainer() {
    this.container.innerHTML = '';
    this.container.className = 'dialogue-panel';
    this.container.style.display = 'none';

    // NPC info section
    this.npcInfo = document.createElement('div');
    this.npcInfo.className = 'npc-info';
    this.npcInfo.innerHTML = `
      <div class="npc-portrait"></div>
      <div class="npc-details">
        <span class="npc-name">Unknown</span>
        <div class="npc-disposition"></div>
      </div>
    `;
    this.container.appendChild(this.npcInfo);

    // Dialogue text area
    this.dialogueArea = document.createElement('div');
    this.dialogueArea.className = 'dialogue-area';
    this.container.appendChild(this.dialogueArea);

    // Response options
    this.responseArea = document.createElement('div');
    this.responseArea.className = 'response-area';
    this.container.appendChild(this.responseArea);

    // Skip indicator
    this.skipIndicator = document.createElement('div');
    this.skipIndicator.className = 'skip-indicator';
    this.skipIndicator.textContent = 'Click to skip';
    this.skipIndicator.style.display = 'none';
    this.container.appendChild(this.skipIndicator);
  }

  setupEventListeners() {
    // Click to skip typing
    this.dialogueArea.addEventListener('click', () => {
      if (this.isTyping) {
        this.finishTyping();
      }
    });

    // Response selection
    this.responseArea.addEventListener('click', (e) => {
      const responseBtn = e.target.closest('.response-option');
      if (responseBtn && !responseBtn.classList.contains('disabled')) {
        this.selectResponse(responseBtn.dataset.responseIndex);
      }
    });

    // Event bus
    this.eventBus.on('dialogue:start', (data) => {
      this.startDialogue(data.npc, data.dialogueData);
    });

    this.eventBus.on('dialogue:end', () => {
      this.endDialogue();
    });

    this.eventBus.on('dialogue:advance', (data) => {
      this.showDialogue(data.nodeId);
    });
  }

  /**
   * Start a dialogue with an NPC
   */
  startDialogue(npc, dialogueData) {
    this.currentNPC = npc;
    this.currentDialogue = dialogueData;
    this.dialogueHistory = [];

    // Show panel
    this.container.style.display = 'flex';

    // Update NPC info
    this.updateNPCInfo(npc);

    // Start with greeting
    this.showDialogue('greeting');

    this.eventBus.emit('mode:changed', { to: 'dialogue' });
  }

  /**
   * Update NPC information display
   */
  updateNPCInfo(npc) {
    const portrait = this.npcInfo.querySelector('.npc-portrait');
    const name = this.npcInfo.querySelector('.npc-name');
    const disposition = this.npcInfo.querySelector('.npc-disposition');

    // Portrait (would be an actual image in production)
    portrait.innerHTML = `<span class="portrait-icon">${this.getNPCIcon(npc.type)}</span>`;
    portrait.className = `npc-portrait type-${npc.type}`;

    // Name
    name.textContent = npc.name;

    // Disposition
    const disp = this.getDisposition(npc);
    disposition.innerHTML = `
      <span class="disposition-icon">${disp.icon}</span>
      <span class="disposition-label">${disp.label}</span>
    `;
    disposition.className = `npc-disposition disposition-${disp.type}`;
  }

  /**
   * Get disposition info for NPC
   */
  getDisposition(npc) {
    const dispositions = {
      hostile: { icon: '😠', label: 'Hostile', type: 'hostile' },
      suspicious: { icon: '🤨', label: 'Suspicious', type: 'suspicious' },
      neutral: { icon: '😐', label: 'Neutral', type: 'neutral' },
      friendly: { icon: '😊', label: 'Friendly', type: 'friendly' },
      allied: { icon: '🤝', label: 'Allied', type: 'allied' }
    };

    // Map awareness to disposition
    const awarenessToDisposition = {
      hostile: 'hostile',
      alert: 'suspicious',
      suspicious: 'suspicious',
      unaware: 'neutral',
      neutral: 'neutral',
      allied: 'allied'
    };

    const dispType = awarenessToDisposition[npc.awareness] || 'neutral';
    return dispositions[dispType];
  }

  /**
   * Show a dialogue node
   */
  showDialogue(nodeId) {
    if (!this.currentDialogue || !this.currentDialogue[nodeId]) {
      this.endDialogue();
      return;
    }

    const node = this.currentDialogue[nodeId];
    this.dialogueHistory.push(nodeId);

    // Clear previous content
    this.dialogueArea.innerHTML = '';
    this.responseArea.innerHTML = '';

    // Create dialogue text element
    const textEl = document.createElement('div');
    textEl.className = 'dialogue-text';
    this.dialogueArea.appendChild(textEl);

    // Typewriter effect
    this.typewriterEffect(textEl, node.text, () => {
      this.showResponses(node.responses);
    });
  }

  /**
   * Typewriter effect for dialogue
   */
  typewriterEffect(element, text, callback) {
    this.isTyping = true;
    this.skipIndicator.style.display = 'block';
    this.currentTypingData = { element, text, index: 0, callback };

    const type = () => {
      if (!this.currentTypingData) return;

      const { element, text, index, callback } = this.currentTypingData;

      if (index < text.length) {
        element.textContent += text[index];
        this.currentTypingData.index++;
        setTimeout(type, this.typewriterSpeed);
      } else {
        this.isTyping = false;
        this.skipIndicator.style.display = 'none';
        this.currentTypingData = null;
        if (callback) callback();
      }
    };

    type();
  }

  /**
   * Finish typing immediately
   */
  finishTyping() {
    if (!this.currentTypingData) return;

    const { element, text, callback } = this.currentTypingData;
    element.textContent = text;
    this.isTyping = false;
    this.skipIndicator.style.display = 'none';
    this.currentTypingData = null;
    if (callback) callback();
  }

  /**
   * Show response options
   */
  showResponses(responses) {
    if (!responses || responses.length === 0) {
      // No responses - show continue button
      this.responseArea.innerHTML = `
        <button class="response-option continue-btn" data-response-index="-1">
          <span class="response-text">[Continue]</span>
        </button>
      `;
      return;
    }

    const responseHTML = responses.map((response, index) => {
      const checkResult = this.evaluateCheck(response.check);
      const disabled = checkResult === false;

      return `
        <button class="response-option ${disabled ? 'disabled' : ''}" 
                data-response-index="${index}"
                ${disabled ? 'disabled' : ''}>
          ${response.check ? `<span class="response-check">[${this.formatCheck(response.check)}]</span>` : ''}
          <span class="response-text">${response.text}</span>
          ${disabled ? '<span class="response-blocked">✗</span>' : ''}
        </button>
      `;
    });

    this.responseArea.innerHTML = responseHTML.join('');

    // Animate in
    const buttons = this.responseArea.querySelectorAll('.response-option');
    buttons.forEach((btn, index) => {
      btn.style.animationDelay = `${index * 100}ms`;
      btn.classList.add('fade-in');
    });
  }

  /**
   * Select a response
   */
  selectResponse(index) {
    const idx = parseInt(index);

    if (idx === -1) {
      // Continue/end dialogue
      this.endDialogue();
      return;
    }

    const node = this.currentDialogue[this.dialogueHistory[this.dialogueHistory.length - 1]];
    const response = node.responses[idx];

    if (!response) return;

    // Show player's response briefly
    this.showPlayerResponse(response.text);

    // Process effects
    if (response.effect) {
      this.processEffect(response.effect);
    }

    // Process action
    if (response.action) {
      this.processAction(response.action);
    }

    // Advance to next node
    setTimeout(() => {
      if (response.next) {
        if (response.next === 'end' || response.next === 'leave') {
          this.endDialogue();
        } else {
          this.showDialogue(response.next);
        }
      } else {
        this.endDialogue();
      }
    }, 800);
  }

  /**
   * Show player's chosen response
   */
  showPlayerResponse(text) {
    this.responseArea.innerHTML = '';
    
    const playerText = document.createElement('div');
    playerText.className = 'player-response';
    playerText.textContent = `"${text}"`;
    this.dialogueArea.appendChild(playerText);
  }

  /**
   * Evaluate a skill check
   */
  evaluateCheck(check) {
    if (!check) return true;

    // Format: "skill:difficulty" e.g. "persuasion:40"
    const [skill, difficultyStr] = check.split(':');
    const difficulty = parseInt(difficultyStr);

    // Would check player skills here
    // For now, return random success weighted by difficulty
    return Math.random() * 100 > difficulty;
  }

  /**
   * Format check for display
   */
  formatCheck(check) {
    if (!check) return '';
    
    const [skill, difficulty] = check.split(':');
    return `${skill.charAt(0).toUpperCase() + skill.slice(1)} ${difficulty}%`;
  }

  /**
   * Process dialogue effect
   */
  processEffect(effect) {
    // Format: "effect-type:value" e.g. "increase-suspicion:20"
    const [type, value] = effect.split(':');

    this.eventBus.emit('dialogue:effect', {
      type,
      value: parseInt(value),
      npc: this.currentNPC
    });
  }

  /**
   * Process dialogue action
   */
  processAction(action) {
    this.eventBus.emit('dialogue:action', {
      action,
      npc: this.currentNPC
    });
  }

  /**
   * End the dialogue
   */
  endDialogue() {
    this.finishTyping();
    
    // Fade out
    this.container.classList.add('closing');
    
    setTimeout(() => {
      this.container.style.display = 'none';
      this.container.classList.remove('closing');
      
      this.currentNPC = null;
      this.currentDialogue = null;
      this.dialogueHistory = [];

      this.eventBus.emit('dialogue:ended');
      this.eventBus.emit('mode:changed', { to: 'exploration' });
    }, 300);
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
   * Check if dialogue is active
   */
  isActive() {
    return this.container.style.display !== 'none';
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
    this.eventBus.off('dialogue:start');
    this.eventBus.off('dialogue:end');
    this.eventBus.off('dialogue:advance');
  }
}

export { DialoguePanel };
