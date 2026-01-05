/**
 * SLOAN AI COMPANION SYSTEM
 * Pillar 7: Behavior model, triggers, voice, and optional LLM integration
 */

import { SLOAN_MODES, SLOAN_TRIGGERS } from '../core/constants.js';

/**
 * Sloan configuration
 */
const SloanConfig = {
  personality: {
    warmth: 0.7,
    humor: 0.4,
    caution: 0.6,
    verbosity: 0.5
  },
  minCooldown: 10,
  maxCooldown: 50,
  baseSpeakChance: 0.4,
  staticThreshold: 50,
  offlineThreshold: 20
};

/**
 * Scripted lines organized by trigger type and context
 */
const ScriptedLines = {
  [SLOAN_TRIGGERS.ENTER_ROOM]: {
    'lobby-main': [
      "Main lobby. Security desk straight ahead. Camera in the corner.",
      "Lots of open space here. Not much cover.",
      "Reception's quiet. That's either good or suspicious."
    ],
    'server-room-3': [
      "Server room. The terminal you need should be against the far wall.",
      "Loud in here. Might mask your footsteps.",
      "There. The admin terminal. That's your target."
    ],
    'hallway-east': [
      "Long corridor. Nowhere to hide if someone comes.",
      "I'm picking up patrol patterns on this floor. Stay alert.",
      "Keep moving. Hallways are exposed."
    ],
    'default': [
      "New room. Take a moment to look around.",
      "Scanning... looks clear for now.",
      "Watch your corners."
    ]
  },

  [SLOAN_TRIGGERS.SPOT_NPC]: {
    'guard': [
      "Guard. Stay back until you know their pattern.",
      "Security. Don't let them see you.",
      "Careful. That one's armed."
    ],
    'tech': [
      "Technician. Might have the access you need.",
      "Worker. They might not report you immediately if you look confident.",
      "Non-security. Still a risk, but less than a guard."
    ],
    'default': [
      "Someone's there. Be careful.",
      "Contact. Assess before acting.",
      "You're not alone in here."
    ]
  },

  [SLOAN_TRIGGERS.PLAYER_IDLE]: {
    'low_stress': [
      "Take your time. No rush.",
      "What's the plan?",
      "I'm here when you're ready."
    ],
    'medium_stress': [
      "We should keep moving.",
      "Don't freeze up on me.",
      "Focus. What's next?"
    ],
    'high_stress': [
      "Hey. Breathe. We've got this.",
      "One step at a time. What can you do right now?",
      "Stay with me. What do you see?"
    ]
  },

  [SLOAN_TRIGGERS.DANGER]: {
    'spotted': [
      "You've been seen! Move!",
      "Cover's blown. Go go go!",
      "They're onto you!"
    ],
    'alarm': [
      "Alarm's triggered. Time to improvise.",
      "That's not good. Find an exit.",
      "Security's incoming. You need to move."
    ],
    'combat': [
      "Engage or run. Your call.",
      "Make it quick. Noise attracts attention.",
      "Finish this and get out."
    ]
  },

  [SLOAN_TRIGGERS.OBJECTIVE_NEAR]: {
    'default': [
      "You're close. The objective should be nearby.",
      "Almost there. Stay focused.",
      "Target's in range. Finish the job."
    ]
  },

  [SLOAN_TRIGGERS.ACTION_RESULT]: {
    'success': ["Nice.", "Good work.", "That's the way."],
    'failure': ["Didn't work. Try something else.", "No luck. Think of another approach."],
    'partial': ["Partially successful. It's something.", "Progress, but not complete."]
  },

  [SLOAN_TRIGGERS.HINT_REQUEST]: {
    'stuck': [
      "Look around. There's usually another way.",
      "What do you have in your inventory? Something might help."
    ],
    'navigation': [
      "Check your map. I've marked what I know.",
      "Look for alternative routes. Vents, back doors, anything."
    ]
  },

  'static': [
    "...breaking up... stay...",
    "...can you... signal's...",
    "...rying to reach... hold on..."
  ],

  'reconnect': [
    "I'm back. Lost you for a second there.",
    "Connection restored. What'd I miss?"
  ]
};

/**
 * Sloan AI Companion class
 */
class Sloan {
  constructor(eventBus, config = {}) {
    this.eventBus = eventBus;
    this.config = { ...SloanConfig, ...config };
    
    this.mode = SLOAN_MODES.BALANCED;
    this.connectionQuality = 100;
    this.cooldown = 0;
    this.lastTrigger = null;
    this.messageHistory = [];
    
    // LLM integration settings
    this.llmEnabled = config.llmEnabled || false;
    this.llmEndpoint = config.llmEndpoint || null;
    this.llmApiKey = config.llmApiKey || null;
    this.llmModel = config.llmModel || 'gpt-4';
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.eventBus.on('room:entered', (data) => this.handleTrigger(SLOAN_TRIGGERS.ENTER_ROOM, data));
    this.eventBus.on('npc:spotted', (data) => this.handleTrigger(SLOAN_TRIGGERS.SPOT_NPC, data));
    this.eventBus.on('player:idle', (data) => this.handleTrigger(SLOAN_TRIGGERS.PLAYER_IDLE, data));
    this.eventBus.on('danger:detected', (data) => this.handleTrigger(SLOAN_TRIGGERS.DANGER, data));
    this.eventBus.on('objective:near', (data) => this.handleTrigger(SLOAN_TRIGGERS.OBJECTIVE_NEAR, data));
    this.eventBus.on('action:completed', (data) => this.handleTrigger(SLOAN_TRIGGERS.ACTION_RESULT, data));
    this.eventBus.on('player:hint', (data) => this.handleTrigger(SLOAN_TRIGGERS.HINT_REQUEST, data));
    this.eventBus.on('connection:changed', (data) => this.handleConnectionChange(data));
  }

  /**
   * Handle incoming triggers
   */
  async handleTrigger(triggerType, data) {
    // Check if on cooldown
    if (this.cooldown > 0) return;
    
    // Check connection quality
    if (this.connectionQuality < this.config.offlineThreshold) return;
    
    // Calculate speak chance based on mode and trigger importance
    const speakChance = this.calculateSpeakChance(triggerType);
    if (Math.random() > speakChance) return;
    
    // Get message
    let message;
    if (this.llmEnabled && this.shouldUseLLM(triggerType, data)) {
      message = await this.getLLMResponse(triggerType, data);
    } else {
      message = this.getScriptedResponse(triggerType, data);
    }
    
    if (!message) return;
    
    // Apply connection degradation effects
    message = this.applyConnectionEffects(message);
    
    // Send the message
    this.speak(message);
    
    // Set cooldown
    this.cooldown = this.calculateCooldown();
    this.lastTrigger = triggerType;
  }

  /**
   * Calculate probability of speaking based on context
   */
  calculateSpeakChance(triggerType) {
    let chance = this.config.baseSpeakChance;
    
    // Mode modifiers
    switch (this.mode) {
      case SLOAN_MODES.CAUTIOUS:
        chance *= 0.7;
        break;
      case SLOAN_MODES.AGGRESSIVE:
        chance *= 1.3;
        break;
    }
    
    // Trigger importance modifiers
    const highPriorityTriggers = [SLOAN_TRIGGERS.DANGER, SLOAN_TRIGGERS.OBJECTIVE_NEAR];
    if (highPriorityTriggers.includes(triggerType)) {
      chance = Math.min(1, chance * 2);
    }
    
    // Don't repeat same trigger type immediately
    if (triggerType === this.lastTrigger) {
      chance *= 0.3;
    }
    
    return chance;
  }

  /**
   * Get a scripted response
   */
  getScriptedResponse(triggerType, data) {
    const triggerLines = ScriptedLines[triggerType];
    if (!triggerLines) return null;
    
    // Try to get context-specific lines
    let lines;
    if (data.context && triggerLines[data.context]) {
      lines = triggerLines[data.context];
    } else if (data.type && triggerLines[data.type]) {
      lines = triggerLines[data.type];
    } else if (triggerLines['default']) {
      lines = triggerLines['default'];
    } else {
      lines = Object.values(triggerLines).flat();
    }
    
    // Pick random line
    return lines[Math.floor(Math.random() * lines.length)];
  }

  /**
   * Determine if LLM should be used for this response
   */
  shouldUseLLM(triggerType, data) {
    // Use LLM for complex situations or hint requests
    const llmTriggers = [SLOAN_TRIGGERS.HINT_REQUEST, SLOAN_TRIGGERS.PLAYER_IDLE];
    return llmTriggers.includes(triggerType) && data.complex;
  }

  /**
   * Get response from LLM API
   */
  async getLLMResponse(triggerType, data) {
    if (!this.llmEndpoint || !this.llmApiKey) {
      return this.getScriptedResponse(triggerType, data);
    }
    
    const prompt = this.buildLLMPrompt(triggerType, data);
    
    try {
      const response = await fetch(this.llmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmApiKey}`
        },
        body: JSON.stringify({
          model: this.llmModel,
          messages: [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.7
        })
      });
      
      const result = await response.json();
      return result.choices?.[0]?.message?.content || this.getScriptedResponse(triggerType, data);
      
    } catch (error) {
      console.error('LLM request failed:', error);
      return this.getScriptedResponse(triggerType, data);
    }
  }

  /**
   * Build the system prompt for LLM
   */
  getSystemPrompt() {
    return `You are Sloan, a remote handler providing tactical support to an operative on an infiltration mission. Your communication is through an earpiece.

PERSONALITY:
- Professional but warm
- Calm under pressure
- Occasionally dry humor
- Never condescending
- Supportive without hand-holding

CONSTRAINTS:
- Keep responses under 20 words
- No exposition or backstory
- React to immediate situation only
- Use contractions naturally
- Never break character

VOICE EXAMPLES:
"Stay low. Two guards ahead, maybe three."
"Nice work. Now get out of there."
"Breathe. We've handled worse."
"That terminal's your best bet. I'll walk you through it."`;
  }

  /**
   * Build context prompt for LLM
   */
  buildLLMPrompt(triggerType, data) {
    const context = {
      trigger: triggerType,
      playerStress: data.playerStress || 'normal',
      currentRoom: data.currentRoom || 'unknown',
      nearbyThreats: data.threats || [],
      objective: data.objective || 'unknown',
      recentActions: this.messageHistory.slice(-3)
    };
    
    return `Current situation:
- Trigger: ${context.trigger}
- Player stress: ${context.playerStress}
- Location: ${context.currentRoom}
- Threats: ${context.nearbyThreats.join(', ') || 'none visible'}
- Objective: ${context.objective}

Respond as Sloan with a single line of dialogue.`;
  }

  /**
   * Apply connection quality effects to message
   */
  applyConnectionEffects(message) {
    if (this.connectionQuality > this.config.staticThreshold) {
      return message;
    }
    
    // Apply static/garbling based on connection quality
    const garbleRatio = 1 - (this.connectionQuality / this.config.staticThreshold);
    
    return message.split('').map(char => {
      if (Math.random() < garbleRatio * 0.3) {
        return '...';
      }
      return char;
    }).join('').replace(/\.{4,}/g, '...');
  }

  /**
   * Send a message to the UI
   */
  speak(message) {
    this.messageHistory.push({
      text: message,
      timestamp: Date.now(),
      connectionQuality: this.connectionQuality
    });
    
    // Keep history manageable
    if (this.messageHistory.length > 20) {
      this.messageHistory.shift();
    }
    
    this.eventBus.emit('sloan:speak', {
      message,
      connectionQuality: this.connectionQuality,
      mode: this.mode
    });
  }

  /**
   * Handle connection quality changes
   */
  handleConnectionChange(data) {
    const wasOffline = this.connectionQuality < this.config.offlineThreshold;
    this.connectionQuality = data.quality;
    const isOffline = this.connectionQuality < this.config.offlineThreshold;
    
    // Reconnection message
    if (wasOffline && !isOffline) {
      const line = ScriptedLines['reconnect'][
        Math.floor(Math.random() * ScriptedLines['reconnect'].length)
      ];
      this.speak(line);
    }
  }

  /**
   * Calculate cooldown based on mode
   */
  calculateCooldown() {
    let base = (this.config.minCooldown + this.config.maxCooldown) / 2;
    
    switch (this.mode) {
      case SLOAN_MODES.CAUTIOUS:
        base *= 1.5;
        break;
      case SLOAN_MODES.AGGRESSIVE:
        base *= 0.7;
        break;
    }
    
    // Add some randomness
    return Math.floor(base * (0.8 + Math.random() * 0.4));
  }

  /**
   * Tick - decrease cooldown
   */
  tick() {
    if (this.cooldown > 0) {
      this.cooldown--;
    }
  }

  /**
   * Set Sloan's behavioral mode
   */
  setMode(mode) {
    if (Object.values(SLOAN_MODES).includes(mode)) {
      this.mode = mode;
      this.eventBus.emit('sloan:modeChanged', { mode });
    }
  }

  /**
   * Update connection quality (called from game state)
   */
  setConnectionQuality(quality) {
    const oldQuality = this.connectionQuality;
    this.connectionQuality = Math.max(0, Math.min(100, quality));
    
    if (oldQuality !== this.connectionQuality) {
      this.eventBus.emit('connection:changed', { quality: this.connectionQuality });
    }
  }

  /**
   * Force Sloan to speak (for critical moments)
   */
  forceSpeech(message) {
    this.cooldown = 0;
    this.speak(message);
    this.cooldown = this.config.minCooldown;
  }

  // ========== MACK INTEGRATION ==========

  /**
   * Offer to connect to Mack
   */
  offerMackConnection(data) {
    const lines = [
      "I know a guy. He's... unreliable. But he might know something.",
      "There's someone who could help. If he's conscious.",
      "Want me to try Mack? Fair warning.",
      "I can patch you through to a specialist. No guarantees on his condition."
    ];
    
    const line = lines[Math.floor(Math.random() * lines.length)];
    this.speak(line);
    
    this.eventBus.emit('sloan:mackOffered', { originalRequest: data });
  }

  /**
   * Connect to Mack
   */
  connectToMack(data) {
    const lines = [
      "Patching you through. Good luck.",
      "Alright, connecting. Don't say I didn't warn you.",
      "Here goes nothing.",
      "Connecting... and remember, I tried to help first."
    ];
    
    const line = lines[Math.floor(Math.random() * lines.length)];
    this.speak(line);
    
    // Emit contact event for Mack
    this.eventBus.emit('mack:contact', data);
  }

  /**
   * React to Mack's response
   */
  reactToMack(mackResponse) {
    let lines;
    
    switch (mackResponse.state) {
      case 'sharp':
        lines = [
          "Huh. Caught him on a good day.",
          "See? He's useful sometimes.",
          "Write that down before he forgets it."
        ];
        break;
      
      case 'tipsy':
        lines = [
          "Somewhere in there is good advice.",
          "He's... trying.",
          "Parse through the rambling, there's something there."
        ];
        break;
      
      case 'drunk':
        lines = [
          "...yeah. That's Mack.",
          "I'd apologize, but you knew the risk.",
          "Let's pretend that didn't happen.",
          "And that's why I tried to help you myself first."
        ];
        break;
      
      case 'passedOut':
        lines = [
          "And he's out. Shocking.",
          "Well. That was a waste of time.",
          "I'll try him again later. Maybe.",
          "Told you."
        ];
        break;
      
      default:
        lines = ["...huh."];
    }
    
    const line = lines[Math.floor(Math.random() * lines.length)];
    
    // Delay Sloan's reaction slightly
    setTimeout(() => this.speak(line), 1500);
  }
}

export { Sloan, SloanConfig, ScriptedLines };
