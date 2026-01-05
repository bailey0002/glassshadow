/**
 * GLASS SHADOW - MAIN ENTRY POINT
 * Infiltration game bootstrap and render loop
 * 
 * PATCHED: Detection grace period, incremental detection, iOS fixes
 */

import { GameEngine, EventBus } from './core/engine.js';
import { GameState } from './core/state.js';
import { DisplayManager } from './ui/display.js';
import { MapRenderer } from './ui/map-renderer.js';
import { PriorityManager } from './ui/priorities.js';
import { ModeManager, MODES } from './ui/modes.js';

// UI Components
import { ActionCard } from './ui/components/action-card.js';
import { SloanPanel } from './ui/components/sloan-panel.js';
import { VitalsHUD } from './ui/components/vitals-hud.js';
import { EnvironmentView } from './ui/components/environment-view.js';
import { InventoryPanel } from './ui/components/inventory-panel.js';
import { MapPanel } from './ui/components/map-panel.js';
import { DialoguePanel } from './ui/components/dialogue-panel.js';
import { MackPanel } from './ui/components/mack-panel.js';
import { ObjectivesPanel } from './ui/components/objectives-panel.js';

// Entity classes
import { Player } from './entities/player.js';
import { NPC, NPCTemplates } from './entities/npc.js';
import { Sloan } from './entities/sloan.js';
import { Mack } from './entities/mack.js';

// Pillar data - will be loaded via fetch
let environmentsData = null;
let equipmentData = null;

// ==============================================
// DETECTION SYSTEM CONSTANTS
// ==============================================
const DETECTION_GRACE_PERIOD = 3000; // 3 seconds before NPCs can detect player on room entry
const DETECTION_CHECK_INTERVAL = 1500; // Check detection every 1.5 seconds, not every frame
const DETECTION_BASE_CHANCE = 8; // 8% base chance per check
const DETECTION_INCREMENT = 5; // How much detection increases per successful spot

/**
 * Glass Shadow Game Application
 */
class GlassShadow {
  constructor() {
    this.eventBus = new EventBus();
    this.state = new GameState();
    this.engine = null;
    this.display = null;
    this.mapRenderer = null;
    this.priorityManager = null;
    this.modeManager = null;
    this.sloan = null;
    this.mack = null;
    
    // UI Components
    this.components = {};
    
    // Game data
    this.environments = new Map();
    this.equipment = new Map();
    
    // Animation frame
    this.animationId = null;
    this.lastFrameTime = 0;
    
    // ==============================================
    // DETECTION SYSTEM STATE
    // ==============================================
    this.detectionEnabled = false;
    this.roomEntryTime = 0;
    this.lastDetectionCheck = 0;
    
    // Initialization state
    this.initialized = false;
  }

  /**
   * Initialize the game
   */
  async init() {
    console.log('🎮 Initializing Glass Shadow...');

    try {
      // Load game data
      await this.loadGameData();

      // Setup DOM elements
      this.setupDOM();

      // Initialize systems
      this.initializeSystems();

      // Setup UI components
      this.setupComponents();

      // Setup event handlers
      this.setupEventHandlers();

      // Load default mission
      await this.loadMission('./missions/active/mission-001.json');

      this.initialized = true;
      console.log('✅ Glass Shadow initialized');

      // Start the game
      this.start();

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.showError('Failed to initialize game. Please refresh the page.');
    }
  }

  /**
   * Load game data (environments, equipment)
   */
  async loadGameData() {
    console.log('📦 Loading game data...');

    // Fetch JSON data
    const [envResponse, equipResponse] = await Promise.all([
      fetch('./pillars/environments.json'),
      fetch('./pillars/equipment.json')
    ]);

    if (!envResponse.ok || !equipResponse.ok) {
      throw new Error('Failed to load game data files');
    }

    environmentsData = await envResponse.json();
    equipmentData = await equipResponse.json();

    // Load environments
    for (const [id, env] of Object.entries(environmentsData.environments)) {
      this.environments.set(id, env);
    }

    // Load equipment - equipment.json uses a single 'equipment' object
    for (const [id, item] of Object.entries(equipmentData.equipment || {})) {
      this.equipment.set(id, item);
    }

    console.log(`  Loaded ${this.environments.size} environments`);
    console.log(`  Loaded ${this.equipment.size} equipment items`);
  }

  /**
   * Setup DOM structure
   */
  setupDOM() {
    console.log('🖼️ Setting up DOM...');

    const app = document.getElementById('app');
    if (!app) {
      throw new Error('App container not found');
    }

    app.innerHTML = `
      <div id="game-container" class="game-container">
        <!-- Map area -->
        <div id="map-container" class="map-container">
          <canvas id="map-canvas" width="600" height="400"></canvas>
        </div>

        <!-- UI Overlay -->
        <div id="ui-overlay" class="ui-overlay">
          <!-- Top HUD -->
          <div id="top-hud" class="hud-section top-hud">
            <div id="vitals-container" class="card-container"></div>
            <div id="sloan-container" class="card-container"></div>
            <div id="mack-container" class="card-container"></div>
          </div>

          <!-- Left Panel -->
          <div id="left-panel" class="hud-section left-panel">
            <div id="environment-container" class="card-container"></div>
            <div id="actions-container" class="card-container"></div>
          </div>

          <!-- Right Panel -->
          <div id="right-panel" class="hud-section right-panel">
            <div id="mini-map-container" class="card-container"></div>
            <div id="inventory-container" class="card-container"></div>
          </div>

          <!-- Bottom HUD -->
          <div id="bottom-hud" class="hud-section bottom-hud">
            <div id="objectives-container" class="card-container"></div>
          </div>

          <!-- Center overlay (for dialogue, menus) -->
          <div id="center-overlay" class="center-overlay">
            <div id="dialogue-container" class="card-container"></div>
          </div>
        </div>

        <!-- Loading overlay -->
        <div id="loading-overlay" class="loading-overlay">
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading...</div>
          </div>
        </div>

        <!-- Error overlay -->
        <div id="error-overlay" class="error-overlay" style="display: none;">
          <div class="error-content">
            <div class="error-icon">⚠️</div>
            <div class="error-text"></div>
            <button class="retry-button" onclick="location.reload()">TRY AGAIN</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Initialize game systems
   */
  initializeSystems() {
    console.log('⚙️ Initializing systems...');

    // Map renderer
    const canvas = document.getElementById('map-canvas');
    this.mapRenderer = new MapRenderer(canvas);

    // Display manager
    this.display = new DisplayManager(this.eventBus);

    // Priority manager
    this.priorityManager = new PriorityManager();

    // Mode manager
    this.modeManager = new ModeManager(this.eventBus);

    // Sloan AI
    this.sloan = new Sloan(this.eventBus, {
      llmEnabled: false // Disable LLM for now
    });

    // Mack - Unreliable Specialist
    this.mack = new Mack(this.eventBus, {
      llmEnabled: false, // Disable LLM for now
      sobrietyMode: 'random' // random, time-based, or degrading
    });
  }

  /**
   * Setup UI components
   */
  setupComponents() {
    console.log('🎛️ Setting up UI components...');

    // Vitals HUD
    this.components.vitals = new VitalsHUD(
      document.getElementById('vitals-container'),
      this.eventBus
    );

    // Sloan Panel
    this.components.sloan = new SloanPanel(
      document.getElementById('sloan-container'),
      this.eventBus
    );

    // Mack Panel - Unreliable Specialist
    this.components.mack = new MackPanel(
      document.getElementById('mack-container'),
      this.eventBus
    );

    // Environment View
    this.components.environment = new EnvironmentView(
      document.getElementById('environment-container'),
      this.eventBus
    );

    // Action Card
    this.components.actions = new ActionCard(
      document.getElementById('actions-container'),
      this.eventBus
    );

    // Mini Map
    this.components.map = new MapPanel(
      document.getElementById('mini-map-container'),
      this.eventBus,
      this.mapRenderer
    );

    // Inventory
    this.components.inventory = new InventoryPanel(
      document.getElementById('inventory-container'),
      this.eventBus,
      Object.fromEntries(this.equipment)
    );

    // Dialogue Panel
    this.components.dialogue = new DialoguePanel(
      document.getElementById('dialogue-container'),
      this.eventBus
    );

    // Objectives Panel
    this.components.objectives = new ObjectivesPanel(
      document.getElementById('objectives-container'),
      this.eventBus
    );
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    console.log('📡 Setting up event handlers...');

    // Action execution
    this.eventBus.on('action:execute', (data) => {
      this.executeAction(data);
    });

    // Mode changes
    this.eventBus.on('mode:changed', (data) => {
      this.handleModeChange(data);
    });

    // Dialogue events
    this.eventBus.on('dialogue:ended', () => {
      this.modeManager.returnToPrevious();
    });
    
    // Dialogue failure - don't instant fail
    this.eventBus.on('dialogue:failed', (data) => {
      this.handleDialogueFailed(data.npc);
    });

    // Priority updates
    this.eventBus.on('priorities:updated', (priorities) => {
      this.handlePriorityUpdate(priorities);
    });

    // Mack events
    this.eventBus.on('mack:response', (data) => {
      // Sloan reacts to Mack's response
      this.sloan.reactToMack(data);
    });

    this.eventBus.on('sloan:mackOffered', (data) => {
      // Player can choose to connect to Mack
      console.log('Mack connection offered', data);
    });

    // Keyboard input
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });
    
    // Touch input for mobile
    document.addEventListener('touchstart', (e) => {
      // Prevent default only on game UI, not inputs
      if (e.target.closest('.action-button, .response-button')) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  /**
   * Load a mission
   */
  async loadMission(missionPath) {
    console.log(`📋 Loading mission: ${missionPath}`);
    this.showLoading('Loading mission...');

    try {
      const response = await fetch(missionPath);
      if (!response.ok) throw new Error('Mission not found');
      
      const mission = await response.json();

      // Setup player
      this.state.player.equipment = [...mission.starting_equipment];
      this.state.player.position = { ...mission.startingPosition };
      this.state.currentEnvironment = mission.startingEnvironment;

      // Setup NPCs
      this.state.npcs.clear();
      for (const npcDef of mission.npcs) {
        const template = NPCTemplates[npcDef.type] || {};
        const env = this.environments.get(npcDef.location);
        const slot = env?.npcSlots?.find(s => s.id === npcDef.slot);
        
        const npc = new NPC({
          ...template,
          ...npcDef,
          position: slot?.position || { x: 0, y: 0 },
          facing: slot?.facingDirection || 'south',
          behavior: slot?.defaultBehavior || 'stationary',
          patrolPath: slot?.patrolPath,
          workStations: slot?.workStations
        });
        
        this.state.npcs.set(npc.id, npc);
      }

      // Setup objectives
      this.state.objectives = mission.objectives;

      // Setup Sloan mode
      this.sloan.setMode(mission.sloan_mode || 'balanced');

      // Mark starting room as visited
      this.mapRenderer.markVisited(mission.startingEnvironment);

      // Trigger initial events
      this.enterRoom(mission.startingEnvironment);

      // Update UI
      this.updateUI();
      
      // Update objectives display
      this.eventBus.emit('objectives:updated', { objectives: this.state.objectives });

      this.hideLoading();
      console.log(`✅ Mission loaded: ${mission.title}`);

      // Show briefing (Sloan speaks)
      setTimeout(() => {
        this.sloan.forceSpeech("You're in. Keep your head down and find that server room.");
      }, 1000);

    } catch (error) {
      console.error('Failed to load mission:', error);
      this.showError('Failed to load mission');
    }
  }

  /**
   * Enter a room
   */
  enterRoom(roomId) {
    const environment = this.environments.get(roomId);
    if (!environment) {
      console.error(`Room not found: ${roomId}`);
      return;
    }

    this.state.currentEnvironment = roomId;
    this.mapRenderer.markVisited(roomId);

    // ==============================================
    // RESET DETECTION GRACE PERIOD ON ROOM ENTRY
    // ==============================================
    this.detectionEnabled = false;
    this.roomEntryTime = Date.now();
    
    // Reset NPC spotted flags for this room
    for (const npc of this.state.npcs.values()) {
      if (npc.location === roomId) {
        npc._alreadySpotted = false;
        npc._engagementHandled = false;
      }
    }
    
    // Enable detection after grace period
    setTimeout(() => {
      this.detectionEnabled = true;
      console.log(`Detection enabled for room: ${roomId}`);
    }, DETECTION_GRACE_PERIOD);

    // Get NPCs in room
    const npcsInRoom = Array.from(this.state.npcs.values())
      .filter(npc => npc.location === roomId);

    // Emit events
    this.eventBus.emit('room:entered', { 
      environment,
      npcs: npcsInRoom 
    });

    // Trigger Sloan
    this.eventBus.emit('room:entered', {
      context: roomId
    });

    // Check for objective proximity
    const hasObjective = environment.elements?.some(el => el.isObjective);
    if (hasObjective) {
      this.eventBus.emit('objective:near', { context: 'default' });
    }
  }

  /**
   * Execute a player action
   */
  executeAction(data) {
    console.log('Action:', data.verb, data.target);

    const { verb, target } = data;

    switch (verb) {
      case 'move':
        this.moveToRoom(target);
        break;
      case 'sneak':
        this.sneakToRoom(target);
        break;
      case 'examine':
        this.examineElement(target);
        break;
      case 'take':
        this.takeItem(target);
        break;
      case 'use':
        this.useItem(target);
        break;
      case 'hack':
        this.hackTerminal(target);
        break;
      case 'talk':
        this.startDialogue(target);
        break;
      case 'look':
        this.surveyRoom();
        break;
      case 'listen':
        this.listenForSounds();
        break;
      case 'wait':
        this.waitAction();
        break;
      case 'contact-mack':
        this.contactMack(data);
        break;
      case 'contact-sloan':
        // Sloan can offer to connect to Mack for complex questions
        this.sloan.offerMackConnection(data);
        break;
      case 'subdue':
        this.attemptSubdue(target);
        break;
      case 'flee':
        this.attemptFlee();
        break;
      case 'attack':
        this.attemptAttack(target);
        break;
      default:
        console.log(`Action not implemented: ${verb}`);
    }
  }

  /**
   * Wait action - recover stress/stamina, pass time
   */
  waitAction() {
    this.state.updateVitals({ stress: -10, stamina: 5 });
    this.sloan.forceSpeech("Taking a moment. Stay alert.");
    this.updateUI();
  }

  /**
   * Handle dialogue failure - incremental consequences, not instant fail
   */
  handleDialogueFailed(npc) {
    // Increase detection significantly but don't instant fail
    const currentDetection = this.state.player.vitals.detection || 0;
    this.state.updateVitals({ detection: 30, stress: 20 });
    
    // Check for mission fail
    if (currentDetection + 30 >= 100) {
      this.handleGameOver('You were caught by security.');
    } else {
      // NPC becomes hostile but player can still flee
      if (npc) {
        npc.awareness = 'hostile';
        npc.engaged = true;
      }
      this.modeManager.transitionTo('combat', { pushToStack: true });
      this.sloan.forceSpeech("That didn't work. You need to deal with this or run!");
    }
    
    this.updateUI();
  }

  /**
   * Attempt to subdue an NPC (non-lethal takedown)
   */
  attemptSubdue(npcId) {
    const npc = this.state.npcs.get(npcId);
    if (!npc) return;

    // Check stamina
    if (this.state.player.vitals.stamina < 30) {
      this.sloan.forceSpeech("You're too tired for that.");
      return;
    }

    // Perform skill check
    const combatSkill = 40; // Base player combat skill
    const roll = Math.random() * 100;
    const difficulty = npc.awareness === 'hostile' ? 60 : 40;
    
    this.state.updateVitals({ stamina: -30, stress: 15 });

    if (roll < combatSkill + 20 - difficulty) {
      // Success
      const droppedItems = npc.subdue();
      this.sloan.forceSpeech("Target down. Grab what you can and move.");
      
      // Add dropped items to room for pickup
      for (const item of droppedItems) {
        this.eventBus.emit('item:dropped', { itemId: item, location: this.state.currentEnvironment });
      }
      
      // Exit combat mode
      this.modeManager.returnToPrevious();
      this.updateUI();
    } else {
      // Failed - NPC fights back
      this.sloan.forceSpeech("Didn't work! They're fighting back!");
      this.state.updateVitals({ health: -20, stress: 25 });
      
      // NPC becomes hostile if not already
      npc.awareness = 'hostile';
      npc.vitals?.addSuspicion(100);
    }
  }

  /**
   * Attempt to flee from combat
   */
  attemptFlee() {
    const currentEnv = this.environments.get(this.state.currentEnvironment);
    const exits = currentEnv?.exits?.filter(e => !e.locked) || [];
    
    if (exits.length === 0) {
      this.sloan.forceSpeech("No way out! You have to deal with this!");
      return;
    }

    // Check stamina
    if (this.state.player.vitals.stamina < 25) {
      this.sloan.forceSpeech("You're too exhausted to run!");
      return;
    }

    this.state.updateVitals({ stamina: -25, stress: 20, detection: 15 }); // Reduced detection penalty
    
    // Disengage all NPCs
    for (const npc of this.state.npcs.values()) {
      if (npc.location === this.state.currentEnvironment) {
        npc.engaged = false;
        npc._engagementHandled = false;
      }
    }
    
    // Move to nearest exit
    const nearestExit = exits[0];
    this.sloan.forceSpeech("Go go go! Get out of there!");
    
    this.modeManager.returnToPrevious();
    this.enterRoom(nearestExit.destination);
    this.updateUI();
  }

  /**
   * Attempt to attack an NPC (lethal)
   */
  attemptAttack(npcId) {
    const npc = this.state.npcs.get(npcId);
    if (!npc) return;

    // Check for weapon
    const hasWeapon = this.state.player.equipment.some(item => 
      ['knife', 'taser', 'fire-extinguisher'].includes(item)
    );
    
    const damage = hasWeapon ? 40 : 20;
    
    this.state.updateVitals({ stamina: -20, stress: 30 });
    
    // Apply damage to NPC
    npc.takeDamage(damage);
    
    if (npc.vitals?.health <= 0) {
      this.sloan.forceSpeech("Target neutralized. That's going to leave a trail.");
      
      // Drop inventory
      const droppedItems = npc.inventory || [];
      for (const item of droppedItems) {
        this.eventBus.emit('item:dropped', { itemId: item, location: this.state.currentEnvironment });
      }
      
      this.modeManager.returnToPrevious();
    } else {
      // NPC retaliates
      this.sloan.forceSpeech("They're still up! Watch yourself!");
      this.state.updateVitals({ health: -15 });
    }
    
    this.updateUI();
  }

  /**
   * Move to a different room
   */
  moveToRoom(roomId) {
    const currentEnv = this.environments.get(this.state.currentEnvironment);
    const exit = currentEnv?.exits?.find(e => e.destination === roomId);

    if (!exit) {
      console.log('Cannot move there');
      return;
    }

    if (exit.locked) {
      // Check for keycard
      const hasKey = this.state.player.equipment.some(item => {
        const match = item.match(/keycard-level(\d+)/);
        return match && parseInt(match[1]) >= exit.keycardLevel;
      });

      if (!hasKey) {
        this.sloan.forceSpeech(`Locked. Need a Level ${exit.keycardLevel} keycard.`);
        return;
      }
    }

    // Apply movement cost
    this.state.updateVitals({ stamina: -5 });

    // Move
    this.enterRoom(roomId);
    this.updateUI();
  }

  /**
   * Sneak to a room (quieter but costs more stamina)
   */
  sneakToRoom(roomId) {
    this.state.updateVitals({ stamina: -10 });
    // Lower detection risk
    this.enterRoom(roomId);
    this.updateUI();
  }

  /**
   * Examine an element
   */
  examineElement(elementId) {
    const env = this.environments.get(this.state.currentEnvironment);
    const element = env?.elements?.find(e => e.id === elementId);

    if (!element) return;

    this.sloan.forceSpeech(`${element.name}. ${element.description || 'Nothing special.'}`);
  }

  /**
   * Take an item
   */
  takeItem(itemId) {
    if (!this.state.player.equipment.includes(itemId)) {
      this.state.addEquipment(itemId);
      this.eventBus.emit('item:added', { itemId });
      this.sloan.forceSpeech('Got it.');
      
      // Check if this is an objective item
      if (itemId === 'access-logs') {
        this.state.setFlag('logs_acquired', true);
        const obj = this.state.objectives?.find(o => o.id === 'obj-extract-logs');
        if (obj) {
          obj.completed = true;
          this.eventBus.emit('objectives:updated', { objectives: this.state.objectives });
        }
        this.sloan.forceSpeech("That's the package. Now get to the exit.");
      }
    }
  }

  /**
   * Use an item
   */
  useItem(itemId) {
    console.log('Using item:', itemId);
    
    const item = this.equipment.get(itemId);
    if (!item) return;

    // Handle Mack sobriety boost items
    if (item.effect?.type === 'mack-sobriety-boost') {
      this.eventBus.emit('mack:sobrietyBoost', { amount: item.effect.amount });
      this.sloan.forceSpeech("Sent it to Mack. Hopefully it helps.");
      
      // Consume the item if it has uses
      if (item.uses) {
        // Remove item from inventory
        this.state.removeEquipment(itemId);
        this.eventBus.emit('item:removed', { itemId });
      }
      return;
    }

    // Handle healing items
    if (item.healAmount) {
      this.state.updateVitals({ health: item.healAmount });
      this.sloan.forceSpeech("That should help.");
      
      if (item.uses) {
        item.uses--;
        if (item.uses <= 0) {
          this.state.removeEquipment(itemId);
          this.eventBus.emit('item:removed', { itemId });
        }
      }
      return;
    }
  }

  /**
   * Contact Mack (called when player requests specialist help)
   */
  contactMack(data = {}) {
    const currentEnv = this.environments.get(this.state.currentEnvironment);
    const npcsInRoom = Array.from(this.state.npcs.values())
      .filter(npc => npc.location === this.state.currentEnvironment);

    // Build context for Mack
    const mackData = {
      currentRoom: currentEnv?.name || 'Unknown',
      objective: this.state.objectives?.find(o => !o.completed)?.description || 'Unknown',
      threats: npcsInRoom.map(npc => npc.name),
      question: data.question || 'Need help with the current situation.'
    };

    // Sloan patches through to Mack
    this.sloan.connectToMack(mackData);
  }

  /**
   * Hack a terminal
   */
  hackTerminal(terminalId) {
    const env = this.environments.get(this.state.currentEnvironment);
    const terminal = env?.elements?.find(e => e.id === terminalId);

    if (!terminal) return;

    this.state.updateVitals({ stamina: -15, stress: 10 });

    // Simulate hacking
    this.sloan.forceSpeech("Working on it... stay alert.");

    setTimeout(() => {
      // Success
      if (terminal.contents) {
        for (const item of terminal.contents) {
          this.takeItem(item);
        }
      }
      this.sloan.forceSpeech("Got it. Now get out of there.");
      this.updateUI();
    }, 2000);
  }

  /**
   * Start dialogue with NPC
   */
  startDialogue(npcId) {
    const npc = this.state.npcs.get(npcId);
    if (!npc) return;

    // Load dialogue data
    const dialogueData = this.getDialogueForNPC(npc);

    this.eventBus.emit('dialogue:start', {
      npc: npc.getState(),
      dialogueData
    });
  }

  /**
   * Get dialogue data for NPC
   */
  getDialogueForNPC(npc) {
    // Would load from scripts/dialogue.json
    // For now, return default dialogue
    return {
      greeting: {
        text: "Hey, you're not supposed to be here after hours.",
        responses: [
          { text: "I'm with IT, server emergency.", next: "it-excuse", check: "persuasion:40" },
          { text: "Sorry, wrong floor.", next: "leave", effect: "increase-suspicion:20" },
          { text: "[Attack]", next: "combat", action: "initiate-combat" }
        ]
      },
      'it-excuse': {
        text: "IT, huh? Fine, but make it quick.",
        responses: [
          { text: "Thanks.", next: "end" }
        ]
      },
      leave: {
        text: "Yeah, you better get out of here.",
        responses: []
      }
    };
  }

  /**
   * Survey the room
   */
  surveyRoom() {
    const env = this.environments.get(this.state.currentEnvironment);
    if (!env) return;

    const interactives = env.elements?.filter(e => e.interactive) || [];
    if (interactives.length > 0) {
      this.sloan.forceSpeech(`I see ${interactives.length} things worth checking out.`);
    } else {
      this.sloan.forceSpeech("Nothing stands out.");
    }
  }

  /**
   * Listen for sounds
   */
  listenForSounds() {
    const npcsInRoom = Array.from(this.state.npcs.values())
      .filter(npc => npc.location === this.state.currentEnvironment);

    if (npcsInRoom.length > 0) {
      this.sloan.forceSpeech("Footsteps. Someone's nearby.");
    } else {
      this.sloan.forceSpeech("All quiet.");
    }
  }

  /**
   * Handle mode change
   */
  handleModeChange(data) {
    const cardStates = MODES[data.to]?.cardStates;
    if (cardStates) {
      // Apply card states
      for (const [cardId, state] of Object.entries(cardStates)) {
        const component = this.components[cardId.replace('-panel', '').replace('-card', '')];
        if (component?.applyState) {
          component.applyState(state);
        }
      }
    }
  }

  /**
   * Handle priority update
   */
  handlePriorityUpdate(priorities) {
    // Update action availability based on priorities
    const topPriority = priorities[0];
    if (topPriority?.type === 'npc-interaction') {
      // Restrict to social/combat actions
    }
  }

  /**
   * Handle keyboard input
   */
  handleKeyboard(e) {
    // Don't handle if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'Escape':
        if (this.components.dialogue?.isActive()) {
          this.eventBus.emit('dialogue:end');
        }
        break;
      case 'm':
      case 'M':
        this.components.map?.toggleFullscreen();
        break;
      case 'i':
      case 'I':
        // Toggle inventory
        break;
      case ' ':
        // Skip dialogue
        if (this.components.dialogue?.isActive()) {
          this.components.dialogue.finishTyping();
        }
        break;
    }
  }

  /**
   * Update UI components
   */
  updateUI() {
    const state = this.state.getSnapshot();
    const currentEnv = this.environments.get(state.environment);
    const npcsInRoom = state.npcsInRoom || [];

    // Update vitals
    this.components.vitals?.updateVitals(state.player.vitals);
    this.components.vitals?.setConditions(state.player.conditions);

    // Update inventory
    this.components.inventory?.updateItems(state.player.equipment);

    // Update environment
    if (currentEnv) {
      this.components.environment?.setEnvironment(currentEnv);
      this.components.environment?.updateNPCs(npcsInRoom.map(npc => npc.getState?.() || npc));
    }

    // Update actions
    const actions = this.priorityManager.getEnvironmentActions(state, currentEnv);
    this.components.actions?.update(actions, state.player.vitals);

    // Update map
    this.components.map?.render(
      Object.fromEntries(this.environments),
      state,
      npcsInRoom
    );

    // Render main map
    if (currentEnv) {
      this.mapRenderer.renderBlueprint(
        currentEnv,
        state,
        npcsInRoom.map(npc => npc.getState?.() || npc)
      );
    }
  }

  /**
   * Start the game loop
   */
  start() {
    console.log('🚀 Starting game loop');
    this.hideLoading();
    this.gameLoop();
  }

  /**
   * Main game loop
   */
  gameLoop() {
    this.animationId = requestAnimationFrame((timestamp) => {
      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      // Update game state
      this.update(deltaTime);

      // Render
      this.render();

      // Continue loop
      this.gameLoop();
    });
  }

  /**
   * Update game state
   */
  update(deltaTime) {
    // ==============================================
    // DETECTION SYSTEM - THROTTLED & GATED
    // ==============================================
    const now = Date.now();
    
    // Only check detection if:
    // 1. Detection is enabled (grace period passed)
    // 2. Enough time since last check
    // 3. Not already in combat/dialogue mode
    const currentMode = this.modeManager?.getCurrentMode?.() || 'exploration';
    const canCheckDetection = this.detectionEnabled && 
                              (now - this.lastDetectionCheck) > DETECTION_CHECK_INTERVAL &&
                              !['combat', 'dialogue'].includes(currentMode);
    
    if (canCheckDetection) {
      this.lastDetectionCheck = now;
      this.checkNPCDetection();
    }

    // Update NPCs (patrol, etc) - but NOT detection
    for (const npc of this.state.npcs.values()) {
      npc.tick(this.state);
    }

    // Update Sloan
    this.sloan.tick();

    // Update Mack
    this.mack.tick();
    
    // Check win/lose conditions
    this.checkWinLoseConditions();

    // Update display transitions
    this.display.update(deltaTime);

    // Evaluate priorities
    const priorities = this.priorityManager.evaluate(
      this.state,
      this.environments,
      this.state.npcs
    );
    this.eventBus.emit('priorities:updated', priorities);
  }

  /**
   * Check NPC detection - THROTTLED VERSION
   */
  checkNPCDetection() {
    const currentEnv = this.environments.get(this.state.currentEnvironment);
    if (!currentEnv) return;
    
    const envNoise = currentEnv?.attributes?.noise || 'normal';
    
    for (const npc of this.state.npcs.values()) {
      // Only check NPCs in current room
      if (npc.location !== this.state.currentEnvironment) continue;
      
      // Skip unconscious/subdued NPCs
      if (npc.state === 'unconscious' || npc.state === 'subdued') continue;
      
      // Skip if already engaged
      if (npc.engaged) continue;
      
      // Calculate detection chance
      let detectChance = DETECTION_BASE_CHANCE;
      
      // Modifiers
      if (npc.awareness === 'alert') detectChance += 10;
      if (npc.awareness === 'hostile') detectChance += 20;
      if (currentEnv.attributes?.lighting === 'bright') detectChance += 5;
      if (currentEnv.attributes?.lighting === 'dim') detectChance -= 5;
      if (this.state.player.conditions?.includes('hidden')) detectChance -= 15;
      if (this.state.player.vitals.stress > 50) detectChance += 5; // Nervous behavior visible
      
      // Noise modifier
      if (envNoise === 'loud') detectChance -= 5;
      if (envNoise === 'silent') detectChance += 10;
      
      // Roll
      const roll = Math.random() * 100;
      
      if (roll < detectChance) {
        // Detection successful - INCREMENT, don't instant fail
        const currentDetection = this.state.player.vitals.detection || 0;
        const newDetection = Math.min(100, currentDetection + DETECTION_INCREMENT);
        this.state.player.vitals.detection = newDetection;
        
        console.log(`NPC ${npc.id} detected player. Detection: ${currentDetection} -> ${newDetection}`);
        
        // Emit event for UI update
        this.eventBus.emit('detection:increased', { 
          level: newDetection,
          npc: npc.id 
        });
        
        // Threshold responses
        if (newDetection >= 100) {
          // Mission fail at 100
          this.handleGameOver('You were caught by security.');
          return;
        } else if (newDetection >= 80 && !npc._engagementHandled) {
          // Engage at 80+
          npc.engaged = true;
          npc._engagementHandled = true;
          this.handleNPCEngagement(npc);
        } else if (newDetection >= 50 && npc.awareness !== 'suspicious') {
          // Suspicious at 50+
          npc.awareness = 'suspicious';
          if (!npc._alreadySpotted) {
            this.eventBus.emit('npc:spotted', { npc: npc.getState(), type: npc.type });
            this.sloan.forceSpeech("They're getting suspicious. Be careful.");
            npc._alreadySpotted = true;
          }
        } else if (newDetection >= 30 && !npc._alreadySpotted) {
          // First alert at 30+
          npc.awareness = 'alert';
          this.sloan.forceSpeech("Watch it. Someone's looking around.");
          npc._alreadySpotted = true;
        }
      }
    }
  }

  /**
   * Handle NPC engaging the player
   */
  handleNPCEngagement(npc) {
    if (npc.awareness === 'hostile') {
      // Enter combat mode
      this.modeManager.transitionTo('combat', { pushToStack: true });
      this.eventBus.emit('danger:detected', { type: 'combat', npc: npc.getState() });
      this.sloan.forceSpeech("Contact! You've been made!");
    } else if (npc.dialogueId || npc.type === 'guard') {
      // Enter dialogue mode
      this.modeManager.transitionTo('dialogue', { pushToStack: true });
      this.startDialogue(npc.id);
    }
  }

  /**
   * Check win/lose conditions
   */
  checkWinLoseConditions() {
    // Prevent multiple triggers
    if (this.state.hasFlag('game_over') || this.state.hasFlag('mission_complete')) return;
    
    // Check lose conditions
    if (this.state.player.vitals.health <= 0) {
      this.handleGameOver('You were killed.');
      return;
    }
    
    // Detection checked in checkNPCDetection now
    
    // Check for alarm (would be set by NPC actions)
    if (this.state.hasFlag('alarm_triggered')) {
      this.handleGameOver('The alarm was triggered. Evidence will be destroyed.');
      return;
    }
    
    // Check win conditions
    const hasLogs = this.state.player.equipment.includes('access-logs');
    const atExit = this.state.currentEnvironment === 'lobby-main';
    
    if (hasLogs && atExit && this.state.hasFlag('logs_acquired')) {
      // Mark objectives complete
      const exitObj = this.state.objectives?.find(o => o.id === 'obj-extract-exit');
      if (exitObj && !exitObj.completed) {
        exitObj.completed = true;
        this.handleMissionComplete();
      }
    }
  }

  /**
   * Handle game over
   */
  handleGameOver(reason) {
    if (this.state.hasFlag('game_over')) return; // Prevent multiple triggers
    this.state.setFlag('game_over', true);
    
    console.log('GAME OVER:', reason);
    this.sloan.forceSpeech("We've lost contact. Mission failed.");
    
    // Stop the game loop
    this.stop();
    
    // Show game over screen
    this.showError(`MISSION FAILED\n\n${reason}`);
  }

  /**
   * Handle mission complete
   */
  handleMissionComplete() {
    if (this.state.hasFlag('mission_complete')) return;
    this.state.setFlag('mission_complete', true);
    
    console.log('MISSION COMPLETE!');
    this.sloan.forceSpeech("You're out. Good work. We got what we needed.");
    
    // Calculate stats
    const optionalComplete = this.state.objectives?.filter(o => o.optional && o.completed).length || 0;
    const ghosted = this.state.player.vitals.detection < 20;
    const mackStats = this.mack.getStats();
    
    // Stop the game loop
    this.stop();
    
    // Show victory screen
    const stats = `
MISSION COMPLETE: The Quiet Floor

Objectives: All required complete
Bonus objectives: ${optionalComplete}
Ghost rating: ${ghosted ? 'UNDETECTED ✓' : 'Detected'}
Mack consultations: ${mackStats.totalCalls} (${mackStats.sharpCalls} useful, ${mackStats.drunkCalls} drunk, ${mackStats.passedOutCalls} unconscious)
    `.trim();
    
    this.showError(stats); // Reusing error overlay for now
  }

  /**
   * Render the game
   */
  render() {
    // Map is rendered continuously via updateUI calls
    // UI components update via events
  }

  /**
   * Show loading overlay
   */
  showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const text = overlay?.querySelector('.loading-text');
    if (text) text.textContent = message;
    if (overlay) overlay.style.display = 'flex';
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  /**
   * Show error overlay
   */
  showError(message) {
    const overlay = document.getElementById('error-overlay');
    const text = overlay?.querySelector('.error-text');
    if (text) text.textContent = message;
    if (overlay) overlay.style.display = 'flex';
  }

  /**
   * Stop the game
   */
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Destroy the game
   */
  destroy() {
    this.stop();
    for (const component of Object.values(this.components)) {
      component?.destroy?.();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.game = new GlassShadow();
  window.game.init();
});

export { GlassShadow };
