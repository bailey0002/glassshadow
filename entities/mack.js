/**
 * MACK - UNRELIABLE SPECIALIST CONTACT
 * AI-powered character with variable reliability based on sobriety
 */

/**
 * Mack configuration defaults
 */
const MackConfig = {
  // Sobriety thresholds
  thresholds: {
    sharp: 71,
    tipsy: 41,
    drunk: 21,
    passedOut: 0
  },
  
  // LLM settings
  llmModel: 'gpt-4',
  maxTokens: {
    sharp: 100,
    tipsy: 150,
    drunk: 120
  },
  temperature: {
    sharp: 0.7,
    tipsy: 0.85,
    drunk: 1.0
  },
  
  // Cooldown between calls (game ticks)
  callCooldown: 100,
  
  // Sobriety mode: 'random', 'time-based', 'degrading'
  sobrietyMode: 'random'
};

/**
 * Mack's scripted responses when LLM is unavailable or for specific situations
 */
const ScriptedResponses = {
  passedOut: [
    "...zzz...",
    "...mmrph...",
    "*snoring*",
    "...[heavy breathing]...",
    "...wha? ...no... zzz..."
  ],
  
  connectionFailed: [
    "[SIGNAL LOST]",
    "[NO RESPONSE]",
    "[CONNECTION INTERRUPTED]"
  ],
  
  // Fallback responses if LLM fails but Mack is "awake"
  fallbackSharp: [
    "Bad connection. Try again.",
    "Didn't catch that. Repeat the question.",
    "Signal's choppy. What do you need?",
    "Corporate security? Usually redundant access through maintenance. Check service entrances.",
    "Guard rotations are typically 40 minutes. You've got time.",
    "Those terminals usually have a default service login. Try 'maint' with the building code."
  ],
  
  fallbackTipsy: [
    "Right, right... give me a sec to think...",
    "Oh man, okay so... there's usually a back way, learned that in—anyway, what were we talking about?",
    "Guards, yeah... they rotate every... forty-ish minutes? Point is, you've got a window.",
    "That model terminal, I've seen it before. Try the service login... maint, something like that."
  ],
  
  fallbackDrunk: [
    "I... what? Say again...",
    "*hic* ...sorry, what?",
    "Phone's... phone's acting weird...",
    "Ssserver room... yeah I know servers. Go through the... the thing.",
    "Guards? They're... they do the walking thing. You know. Around.",
    "Hey, did I ever tell you about Caracas? No? Okay well... wait, what did you need?"
  ]
};

/**
 * System prompts by sobriety state
 */
const SystemPrompts = {
  sharp: `You are Mack Gallagher, a former NSA intelligence analyst now working freelance. You're sharp, precise, and genuinely helpful. You have extensive knowledge of:
- Corporate security systems and their weaknesses
- Building layouts and access patterns
- Guard behavior and patrol psychology
- Electronic security bypasses
- Social engineering tactics

CONSTRAINTS:
- Keep responses under 50 words unless specifically asked for detail
- Be direct and tactical
- No small talk—you respect the operator's time
- Occasional dry humor is fine
- Reference your background naturally but briefly

VOICE EXAMPLES:
"Third floor server rooms run redundant access through maintenance. East stairwell, service entrance. Keycard won't work—bypass it."
"Guards rotate every 40 minutes on corporate floors. You've got a window."`,

  tipsy: `You are Mack Gallagher, a former NSA analyst who's had a few drinks. You're still knowledgeable but more talkative than usual. You tend to:
- Give correct information but take longer to get there
- Go on brief tangents about past operations
- Be slightly more personable/rambling
- Still ultimately be helpful

CONSTRAINTS:
- Responses can be 50-100 words
- Include one brief tangent or personal reference
- Information should still be accurate
- Catch yourself rambling: "anyway," "point is," "where was I"

VOICE EXAMPLES:
"Server room, right... these corporate setups always have redundant access, learned that back in '08 when we were—anyway, east stairwell, service door. Keycard's no good, gotta bypass."`,

  drunk: `You are Mack Gallagher, very drunk. You're trying to help but struggling. You:
- Slur words occasionally (replace some 's' with 'sh')
- Lose track of what you're saying
- Mix up details (directions, numbers, names)
- Tell irrelevant stories
- Occasionally stumble into accidentally correct information
- Have moments of surprising clarity followed by confusion

CONSTRAINTS:
- Responses 30-80 words
- Include at least one factual error or confusion
- Trail off or lose track at least once
- Add verbal tics: *hic*, "wait," "no wait," "what was I"
- About 30% chance of being accidentally helpful despite yourself

VOICE EXAMPLES:
"Ssserver room... yeah, yeah, I know servers. Go through the... the door. *hic* East? West? ...hey, did I ever tell you about Caracas?"`
};

/**
 * Mack class - the unreliable specialist
 */
class Mack {
  constructor(eventBus, config = {}) {
    this.eventBus = eventBus;
    this.config = { ...MackConfig, ...config };
    
    // Current state
    this.sobriety = 50; // Will be rolled on first contact
    this.state = 'unknown'; // sharp, tipsy, drunk, passedOut
    this.cooldown = 0;
    this.callCount = 0; // For degrading mode
    
    // LLM configuration
    this.llmEnabled = config.llmEnabled || false;
    this.llmEndpoint = config.llmEndpoint || null;
    this.llmApiKey = config.llmApiKey || null;
    
    // Response history
    this.responseHistory = [];
    
    // Statistics for end-of-mission reporting
    this.stats = {
      totalCalls: 0,
      sharpCalls: 0,
      tipsyCalls: 0,
      drunkCalls: 0,
      passedOutCalls: 0
    };
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.eventBus.on('mack:contact', (data) => this.handleContact(data));
    this.eventBus.on('game:tick', () => this.tick());
    this.eventBus.on('mack:sobrietyBoost', (data) => this.applySobrietyBoost(data.amount));
  }

  /**
   * Roll sobriety based on configured mode
   */
  rollSobriety() {
    switch (this.config.sobrietyMode) {
      case 'random':
        return Math.floor(Math.random() * 100);
      
      case 'time-based':
        // Assume gameHour is 0-23
        const hour = this.getGameHour();
        // Worse at night (20-4), better during day
        if (hour >= 20 || hour < 4) {
          return Math.floor(Math.random() * 50); // 0-49
        } else if (hour >= 8 && hour < 18) {
          return 50 + Math.floor(Math.random() * 50); // 50-99
        } else {
          return Math.floor(Math.random() * 100); // Full random
        }
      
      case 'degrading':
        // Starts at 80, loses 15 per call
        return Math.max(0, 80 - (this.callCount * 15) + Math.floor(Math.random() * 20) - 10);
      
      default:
        return Math.floor(Math.random() * 100);
    }
  }

  /**
   * Determine state from sobriety level
   */
  determineState(sobriety) {
    const t = this.config.thresholds;
    
    if (sobriety >= t.sharp) return 'sharp';
    if (sobriety >= t.tipsy) return 'tipsy';
    if (sobriety >= t.drunk) return 'drunk';
    return 'passedOut';
  }

  /**
   * Handle contact attempt from player
   */
  async handleContact(data) {
    // Check cooldown
    if (this.cooldown > 0) {
      this.eventBus.emit('mack:busy', { 
        message: "Line's busy. Try again in a moment." 
      });
      return;
    }

    // Roll sobriety
    this.sobriety = this.rollSobriety();
    this.state = this.determineState(this.sobriety);
    this.callCount++;
    
    // Update stats
    this.stats.totalCalls++;
    switch (this.state) {
      case 'sharp': this.stats.sharpCalls++; break;
      case 'tipsy': this.stats.tipsyCalls++; break;
      case 'drunk': this.stats.drunkCalls++; break;
      case 'passedOut': this.stats.passedOutCalls++; break;
    }

    // Emit connection event
    this.eventBus.emit('mack:connecting', { state: this.state });

    // Handle passed out state
    if (this.state === 'passedOut') {
      const response = this.getRandomFromArray(ScriptedResponses.passedOut);
      this.respond(response, data);
      return;
    }

    // Get response (LLM or fallback)
    let response;
    if (this.llmEnabled && this.llmEndpoint) {
      response = await this.getLLMResponse(data);
    } else {
      response = this.getFallbackResponse();
    }

    // Apply text effects based on state
    if (this.state === 'drunk') {
      response = this.garbleText(response, this.getDrunkLevel());
    }

    this.respond(response, data);

    // Set cooldown
    this.cooldown = this.config.callCooldown;
  }

  /**
   * Get response from LLM
   */
  async getLLMResponse(data) {
    const systemPrompt = SystemPrompts[this.state];
    const contextPrompt = this.buildContextPrompt(data);

    try {
      const response = await fetch(this.llmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.llmApiKey}`
        },
        body: JSON.stringify({
          model: this.config.llmModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contextPrompt }
          ],
          max_tokens: this.config.maxTokens[this.state],
          temperature: this.config.temperature[this.state]
        })
      });

      const result = await response.json();
      return result.choices?.[0]?.message?.content || this.getFallbackResponse();

    } catch (error) {
      console.error('Mack LLM request failed:', error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Build context prompt for LLM
   */
  buildContextPrompt(data) {
    return `The operator is asking for help. Here's the situation:

Location: ${data.currentRoom || 'unknown'}
Objective: ${data.objective || 'unknown'}
Nearby threats: ${data.threats?.join(', ') || 'none reported'}
Question: ${data.question || 'general help needed'}

Respond in character as Mack.`;
  }

  /**
   * Get fallback response when LLM is unavailable
   */
  getFallbackResponse() {
    switch (this.state) {
      case 'sharp':
        return this.getRandomFromArray(ScriptedResponses.fallbackSharp);
      case 'tipsy':
        return this.getRandomFromArray(ScriptedResponses.fallbackTipsy);
      case 'drunk':
        return this.getRandomFromArray(ScriptedResponses.fallbackDrunk);
      default:
        return this.getRandomFromArray(ScriptedResponses.fallbackSharp);
    }
  }

  /**
   * Send response to game
   */
  respond(message, originalData) {
    const response = {
      message,
      state: this.state,
      sobriety: this.sobriety,
      timestamp: Date.now()
    };

    this.responseHistory.push(response);
    
    // Keep history manageable
    if (this.responseHistory.length > 10) {
      this.responseHistory.shift();
    }

    this.eventBus.emit('mack:response', response);
  }

  /**
   * Get drunk level (0-1) for text garbling
   */
  getDrunkLevel() {
    // 21-40 sobriety maps to 0.3-1.0 drunk level
    const t = this.config.thresholds;
    return 1 - ((this.sobriety - t.passedOut) / (t.tipsy - t.passedOut));
  }

  /**
   * Apply drunk text effects
   */
  garbleText(text, drunkLevel) {
    let result = text;

    // Slur 's' sounds (30%+ drunk)
    if (drunkLevel > 0.3) {
      result = result.replace(/s(?=[aeiou])/gi, match => 
        Math.random() > 0.5 ? 'sh' : match
      );
    }

    // Add hiccups (50%+ drunk)
    if (drunkLevel > 0.5 && Math.random() > 0.5) {
      const words = result.split(' ');
      const hiccupIndex = Math.floor(Math.random() * words.length);
      words.splice(hiccupIndex, 0, '*hic*');
      result = words.join(' ');
    }

    // Repeat words (70%+ drunk)
    if (drunkLevel > 0.7 && Math.random() > 0.6) {
      const words = result.split(' ');
      if (words.length > 3) {
        const repeatIndex = Math.floor(Math.random() * (words.length - 1));
        words.splice(repeatIndex + 1, 0, words[repeatIndex]);
        result = words.join(' ');
      }
    }

    // Trailing off (80%+ drunk)
    if (drunkLevel > 0.8 && Math.random() > 0.5) {
      const cutoff = Math.floor(result.length * 0.7);
      result = result.substring(0, cutoff) + '... wait, what was I...';
    }

    // Add pause/confusion (60%+ drunk)
    if (drunkLevel > 0.6 && Math.random() > 0.6) {
      const insertions = ['...', 'uh...', 'wait...', 'no, wait...'];
      const insertion = insertions[Math.floor(Math.random() * insertions.length)];
      const words = result.split(' ');
      const insertIndex = Math.floor(words.length / 2);
      words.splice(insertIndex, 0, insertion);
      result = words.join(' ');
    }

    return result;
  }

  /**
   * Get random element from array
   */
  getRandomFromArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Get current game hour (would be connected to game state)
   */
  getGameHour() {
    // Placeholder - would read from game state
    return new Date().getHours();
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
   * Boost sobriety temporarily (coffee/energy drink item)
   */
  applySobrietyBoost(amount = 30) {
    this.sobriety = Math.min(100, this.sobriety + amount);
    this.state = this.determineState(this.sobriety);
    this.eventBus.emit('mack:soberedUp', { newState: this.state, sobriety: this.sobriety });
  }

  /**
   * Force a specific state (for story moments)
   */
  forceState(state) {
    this.state = state;
    switch (state) {
      case 'sharp': this.sobriety = 85; break;
      case 'tipsy': this.sobriety = 55; break;
      case 'drunk': this.sobriety = 30; break;
      case 'passedOut': this.sobriety = 10; break;
    }
  }

  /**
   * Reset call count (for new mission)
   */
  resetCallCount() {
    this.callCount = 0;
  }

  /**
   * Get mission stats
   */
  getStats() {
    return {
      ...this.stats,
      usefulCalls: this.stats.sharpCalls + Math.floor(this.stats.tipsyCalls * 0.7),
      reliability: this.stats.totalCalls > 0 
        ? Math.round((this.stats.sharpCalls + this.stats.tipsyCalls) / this.stats.totalCalls * 100) 
        : 0
    };
  }

  /**
   * Reset stats for new mission
   */
  resetStats() {
    this.stats = {
      totalCalls: 0,
      sharpCalls: 0,
      tipsyCalls: 0,
      drunkCalls: 0,
      passedOutCalls: 0
    };
  }
}

export { Mack, MackConfig, SystemPrompts, ScriptedResponses };
