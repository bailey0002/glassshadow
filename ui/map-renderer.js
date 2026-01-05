/**
 * MAP RENDERING SYSTEM
 * Handles facility overview map and room blueprints
 */

import { MAP_CONFIG } from '../core/constants.js';

/**
 * Map Renderer - creates visual representations of environments
 */
class MapRenderer {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = { ...MAP_CONFIG, ...config };
    
    // Current view state
    this.viewMode = 'overview'; // 'overview' or 'blueprint'
    this.currentEnvironment = null;
    this.visitedEnvironments = new Set();
    this.fogOfWar = config.fogOfWar ?? true;
    
    // Pan and zoom
    this.offset = { x: 0, y: 0 };
    this.zoom = 1;
    
    // Animation state
    this.playerBlinkPhase = 0;
    this.npcAnimations = new Map();
  }

  /**
   * Render the overview map showing all environments
   */
  renderOverview(environments, connections, gameState) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.save();
    ctx.translate(this.offset.x, this.offset.y);
    ctx.scale(this.zoom, this.zoom);
    
    // Draw background grid
    this.drawGrid();
    
    // Draw connections between rooms
    this.drawConnections(connections, environments);
    
    // Draw each environment as a box
    for (const [envId, env] of Object.entries(environments)) {
      const visited = this.visitedEnvironments.has(envId);
      const current = gameState.currentEnvironment === envId;
      const hasObjective = this.checkForObjective(env, gameState);
      
      this.drawEnvironmentBox(env, { visited, current, hasObjective });
    }
    
    // Draw player position indicator
    if (gameState.currentEnvironment) {
      const currentEnv = environments[gameState.currentEnvironment];
      this.drawPlayerMarker(currentEnv);
    }
    
    // Draw objective markers
    this.drawObjectiveMarkers(environments, gameState);
    
    ctx.restore();
  }

  /**
   * Render a detailed blueprint of a single room
   */
  renderBlueprint(environment, gameState, npcs) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const blueprint = environment.blueprint;
    if (!blueprint) {
      this.renderSimpleRoom(environment, gameState, npcs);
      return;
    }
    
    ctx.save();
    
    // Center the blueprint
    const roomWidth = environment.dimensions.width * this.config.TILE_SIZE;
    const roomHeight = environment.dimensions.height * this.config.TILE_SIZE;
    const offsetX = (this.canvas.width - roomWidth) / 2;
    const offsetY = (this.canvas.height - roomHeight) / 2;
    
    ctx.translate(offsetX, offsetY);
    
    // Draw floor
    ctx.fillStyle = this.config.COLORS.FLOOR;
    ctx.fillRect(0, 0, roomWidth, roomHeight);
    
    // Parse and draw ASCII blueprint
    const lines = blueprint.ascii;
    for (let y = 0; y < lines.length; y++) {
      for (let x = 0; x < lines[y].length; x++) {
        const char = lines[y][x];
        const tile = blueprint.legend[char];
        this.drawTile(x, y, tile, char);
      }
    }
    
    // Draw interactive elements with detail
    for (const element of environment.elements) {
      this.drawElement(element, gameState);
    }
    
    // Draw NPCs
    for (const npc of npcs) {
      this.drawNPC(npc);
    }
    
    // Draw player
    this.drawPlayer(gameState.player);
    
    // Draw exits
    for (const exit of environment.exits) {
      this.drawExit(exit);
    }
    
    ctx.restore();
    
    // Draw legend
    this.drawLegend(environment);
  }

  /**
   * Draw a single tile based on type
   */
  drawTile(x, y, tileType, char) {
    const ctx = this.ctx;
    const size = this.config.TILE_SIZE;
    const px = x * size;
    const py = y * size;
    
    switch (tileType) {
      case 'wall':
        ctx.fillStyle = this.config.COLORS.WALL;
        ctx.fillRect(px, py, size, size);
        // Add wall texture
        ctx.strokeStyle = '#2a2a4e';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
        break;
      
      case 'floor':
        // Already drawn as background
        // Add subtle grid
        ctx.strokeStyle = '#1e2d4d';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, size, size);
        break;
      
      case 'door':
        ctx.fillStyle = this.config.COLORS.DOOR;
        ctx.fillRect(px + 2, py + size/3, size - 4, size/3);
        break;
      
      case 'desk':
      case 'furniture':
        ctx.fillStyle = this.config.COLORS.FURNITURE;
        ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
        break;
      
      case 'cover':
        ctx.fillStyle = this.config.COLORS.COVER;
        ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
        // Cover indicator
        ctx.strokeStyle = '#3d5a80';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 4, py + 4, size - 8, size - 8);
        break;
      
      case 'server-rack':
        ctx.fillStyle = '#0a192f';
        ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
        // Blinking lights
        const blinkOffset = Math.sin(Date.now() / 200 + x + y) > 0;
        ctx.fillStyle = blinkOffset ? '#00ff88' : '#004422';
        ctx.fillRect(px + size - 8, py + 4, 3, 3);
        ctx.fillRect(px + size - 8, py + 10, 3, 3);
        break;
      
      case 'terminal':
      case 'computer':
        ctx.fillStyle = this.config.COLORS.COMPUTER;
        ctx.fillRect(px + 4, py + 4, size - 8, size - 8);
        // Screen glow
        ctx.fillStyle = '#00ffff44';
        ctx.fillRect(px + 6, py + 6, size - 12, size - 12);
        break;
      
      case 'camera':
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(px + size/2, py + size/2, size/4, 0, Math.PI * 2);
        ctx.fill();
        // Blinking recording light
        if (Math.sin(Date.now() / 500) > 0) {
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(px + size/2, py + size/2, size/8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      
      case 'elevator':
        ctx.fillStyle = '#334455';
        ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
        // Elevator doors
        ctx.strokeStyle = '#556677';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + size/2, py + 4);
        ctx.lineTo(px + size/2, py + size - 4);
        ctx.stroke();
        break;
    }
  }

  /**
   * Draw an interactive element with detail
   */
  drawElement(element, gameState) {
    const ctx = this.ctx;
    const size = this.config.TILE_SIZE;
    const px = element.position.x * size;
    const py = element.position.y * size;
    const w = (element.size?.w || 1) * size;
    const h = (element.size?.h || 1) * size;
    
    // Highlight if interactive
    if (element.interactive) {
      ctx.strokeStyle = '#ffff0066';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(px - 2, py - 2, w + 4, h + 4);
      ctx.setLineDash([]);
    }
    
    // Highlight if objective
    if (element.isObjective) {
      ctx.strokeStyle = this.config.COLORS.OBJECTIVE;
      ctx.lineWidth = 3;
      const pulseScale = 1 + Math.sin(Date.now() / 300) * 0.1;
      ctx.strokeRect(
        px - 4 * pulseScale, 
        py - 4 * pulseScale, 
        w + 8 * pulseScale, 
        h + 8 * pulseScale
      );
    }
  }

  /**
   * Draw an NPC
   */
  drawNPC(npc) {
    const ctx = this.ctx;
    const size = this.config.TILE_SIZE;
    const px = npc.position.x * size + size/2;
    const py = npc.position.y * size + size/2;
    
    // Determine color based on awareness
    let color;
    switch (npc.awareness) {
      case 'hostile':
        color = this.config.COLORS.NPC_HOSTILE;
        break;
      case 'alert':
      case 'suspicious':
        color = '#ffaa00';
        break;
      case 'allied':
        color = this.config.COLORS.NPC_ALLIED;
        break;
      default:
        color = this.config.COLORS.NPC_NEUTRAL;
    }
    
    // Draw NPC body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, size/3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw facing direction indicator
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    const facingOffset = this.getFacingOffset(npc.facing, size/2);
    ctx.lineTo(px + facingOffset.x, py + facingOffset.y);
    ctx.stroke();
    
    // Draw vision cone for aware NPCs
    if (npc.awareness !== 'unaware') {
      this.drawVisionCone(px, py, npc.facing, color);
    }
    
    // Draw awareness indicator
    if (npc.awareness === 'suspicious') {
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('?', px - 4, py - size/2);
    } else if (npc.awareness === 'alert' || npc.awareness === 'hostile') {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('!', px - 4, py - size/2);
    }
  }

  /**
   * Draw player
   */
  drawPlayer(player) {
    const ctx = this.ctx;
    const size = this.config.TILE_SIZE;
    const px = player.position.x * size + size/2;
    const py = player.position.y * size + size/2;
    
    // Pulsing effect
    this.playerBlinkPhase += 0.1;
    const pulse = 1 + Math.sin(this.playerBlinkPhase) * 0.1;
    
    // Draw player
    ctx.fillStyle = this.config.COLORS.PLAYER;
    ctx.beginPath();
    ctx.arc(px, py, (size/3) * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw facing direction
    ctx.strokeStyle = this.config.COLORS.PLAYER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, py);
    const facingOffset = this.getFacingOffset(player.facing, size/2);
    ctx.lineTo(px + facingOffset.x, py + facingOffset.y);
    ctx.stroke();
    
    // Hidden indicator
    if (player.hidden) {
      ctx.strokeStyle = '#00ff8866';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.arc(px, py, size/2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /**
   * Draw exit/door
   */
  drawExit(exit) {
    const ctx = this.ctx;
    const size = this.config.TILE_SIZE;
    const px = exit.position.x * size;
    const py = exit.position.y * size;
    
    // Door frame
    ctx.fillStyle = exit.locked ? '#660000' : this.config.COLORS.DOOR;
    ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
    
    // Lock indicator
    if (exit.locked) {
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(px + size/2, py + size/2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Label
    ctx.fillStyle = '#ffffff88';
    ctx.font = '8px monospace';
    ctx.fillText(exit.label.substring(0, 8), px + 2, py + size + 10);
  }

  /**
   * Draw vision cone
   */
  drawVisionCone(x, y, facing, color) {
    const ctx = this.ctx;
    const length = this.config.TILE_SIZE * 3;
    const angle = Math.PI / 3; // 60 degree cone
    
    const baseAngle = this.getFacingAngle(facing);
    
    ctx.fillStyle = color + '22';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, length, baseAngle - angle/2, baseAngle + angle/2);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Get offset for facing direction
   */
  getFacingOffset(facing, distance) {
    switch (facing) {
      case 'north': return { x: 0, y: -distance };
      case 'south': return { x: 0, y: distance };
      case 'east': return { x: distance, y: 0 };
      case 'west': return { x: -distance, y: 0 };
      default: return { x: 0, y: distance };
    }
  }

  /**
   * Get angle for facing direction
   */
  getFacingAngle(facing) {
    switch (facing) {
      case 'north': return -Math.PI / 2;
      case 'south': return Math.PI / 2;
      case 'east': return 0;
      case 'west': return Math.PI;
      default: return Math.PI / 2;
    }
  }

  /**
   * Draw grid background
   */
  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = '#1a1a2e44';
    ctx.lineWidth = 0.5;
    
    const gridSize = 50;
    for (let x = 0; x < this.canvas.width * 2; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height * 2);
      ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height * 2; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width * 2, y);
      ctx.stroke();
    }
  }

  /**
   * Draw environment box on overview map
   */
  drawEnvironmentBox(env, options) {
    const ctx = this.ctx;
    
    // Would need position data from a layout system
    // For now, using a simple grid layout based on env id
    const pos = this.getEnvironmentPosition(env.id);
    const width = 80;
    const height = 50;
    
    // Background
    if (options.current) {
      ctx.fillStyle = '#00ff8844';
    } else if (options.visited) {
      ctx.fillStyle = '#16213e';
    } else {
      ctx.fillStyle = '#0a0a1566';
    }
    ctx.fillRect(pos.x, pos.y, width, height);
    
    // Border
    ctx.strokeStyle = options.current ? '#00ff88' : (options.visited ? '#334466' : '#1a1a2e');
    ctx.lineWidth = options.current ? 2 : 1;
    ctx.strokeRect(pos.x, pos.y, width, height);
    
    // Label
    ctx.fillStyle = options.visited ? '#ffffff' : '#666666';
    ctx.font = '10px monospace';
    ctx.fillText(env.name.substring(0, 12), pos.x + 4, pos.y + 14);
    
    // Objective marker
    if (options.hasObjective) {
      ctx.fillStyle = this.config.COLORS.OBJECTIVE;
      ctx.beginPath();
      ctx.arc(pos.x + width - 10, pos.y + 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Get position for environment on overview map
   */
  getEnvironmentPosition(envId) {
    // Simple layout - would be defined in map config for real use
    const layout = {
      'lobby-main': { x: 100, y: 200 },
      'hallway-east': { x: 200, y: 150 },
      'server-room-3': { x: 300, y: 150 },
      'stairwell-b': { x: 200, y: 250 }
    };
    
    return layout[envId] || { x: 100, y: 100 };
  }

  /**
   * Draw connections between environments
   */
  drawConnections(connections, environments) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#334466';
    ctx.lineWidth = 2;
    
    // Would iterate through defined connections
    // For demo, connecting based on exits
    for (const env of Object.values(environments)) {
      const fromPos = this.getEnvironmentPosition(env.id);
      
      for (const exit of env.exits || []) {
        const toPos = this.getEnvironmentPosition(exit.destination);
        if (!toPos) continue;
        
        ctx.beginPath();
        ctx.moveTo(fromPos.x + 40, fromPos.y + 25);
        ctx.lineTo(toPos.x + 40, toPos.y + 25);
        ctx.stroke();
      }
    }
  }

  /**
   * Draw legend for current view
   */
  drawLegend(environment) {
    const ctx = this.ctx;
    const startX = 10;
    const startY = this.canvas.height - 80;
    
    ctx.fillStyle = '#00000088';
    ctx.fillRect(startX, startY, 150, 70);
    
    ctx.font = '10px monospace';
    
    const items = [
      { color: this.config.COLORS.PLAYER, label: 'You' },
      { color: this.config.COLORS.NPC_NEUTRAL, label: 'NPC' },
      { color: this.config.COLORS.NPC_HOSTILE, label: 'Hostile' },
      { color: this.config.COLORS.OBJECTIVE, label: 'Objective' }
    ];
    
    items.forEach((item, i) => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(startX + 15, startY + 15 + i * 15, 5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(item.label, startX + 30, startY + 18 + i * 15);
    });
  }

  checkForObjective(env, gameState) {
    return env.elements?.some(el => el.isObjective) || false;
  }

  /**
   * Mark environment as visited
   */
  markVisited(envId) {
    this.visitedEnvironments.add(envId);
  }

  /**
   * Switch view mode
   */
  setViewMode(mode, environment = null) {
    this.viewMode = mode;
    if (environment) {
      this.currentEnvironment = environment;
    }
  }
}

export { MapRenderer };
