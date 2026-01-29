// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Pong game - A classic two-player paddle game.
// Transformed from the Chrome dinosaur game while maintaining the Google aesthetic.

import {assert} from 'chrome://resources/js/assert.js';
import {loadTimeData} from 'chrome://resources/js/load_time_data.js';

import {DEFAULT_DIMENSIONS, FPS, IS_HIDPI, IS_MOBILE, PONG_CONFIG} from './constants.js';
import type {Dimensions} from './dimensions.js';
import {Ball} from './ball.js';
import {Paddle} from './paddle.js';
import {ScoreDisplay} from './score_display.js';
import {spriteDefinitionByType} from './offline_sprite_definitions.js';
import {getTimeStamp} from './utils.js';

const RESOURCE_POSTFIX: string = 'offline-resources-';

/**
 * Game states.
 */
enum GameState {
  WAITING,    // Before first game
  PLAYING,    // Ball is in motion
  SCORED,     // Brief pause after scoring
  GAME_OVER,  // Game finished, showing winner
}

/**
 * CSS class names.
 */
enum PongClasses {
  CANVAS = 'runner-canvas',
  CONTAINER = 'runner-container',
}

/**
 * Key codes for input.
 */
const KEY_CODES = {
  UP: 38,
  DOWN: 40,
  SPACE: 32,
  W: 87,
  S: 83,
};

let gameInstance: PongGame | null = null;

/**
 * Pong game engine.
 */
export class PongGame {
  private outerContainerEl: HTMLElement;
  private containerEl: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private imageSprite: HTMLImageElement | null = null;

  private dimensions: Dimensions = DEFAULT_DIMENSIONS;
  private spriteDef = spriteDefinitionByType.original.ldpi;

  // Game entities
  private playerPaddle: Paddle | null = null;
  private aiPaddle: Paddle | null = null;
  private ball: Ball | null = null;
  private scoreDisplay: ScoreDisplay | null = null;

  // Game state
  private state: GameState = GameState.WAITING;
  private msPerFrame: number = 1000 / FPS;
  private time: number = 0;
  private raqId: number = 0;
  private updatePending: boolean = false;

  // Input state
  private keysPressed: Set<number> = new Set();

  // Score delay timer
  private scoreDelayTimer: number = 0;

  // Disabled state (for enterprise-managed devices)
  private isDisabled: boolean = loadTimeData.valueExists('disabledEasterEgg');

  /**
   * Initialize the singleton instance of PongGame.
   */
  static initializeInstance(outerContainerId: string): PongGame {
    assert(gameInstance === null);
    gameInstance = new PongGame(outerContainerId);
    if (!gameInstance.isDisabled) {
      gameInstance.loadImages();
    }
    return gameInstance;
  }

  static getInstance(): PongGame {
    assert(gameInstance);
    return gameInstance;
  }

  private constructor(outerContainerId: string) {
    const outerContainerElement =
        document.querySelector<HTMLElement>(outerContainerId);
    assert(outerContainerElement);
    this.outerContainerEl = outerContainerElement;

    if (this.isDisabled) {
      this.setupDisabledMessage();
    }
  }

  /**
   * Show disabled message for managed devices.
   */
  private setupDisabledMessage() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'snackbar';
    this.containerEl.textContent = loadTimeData.getValue('disabledEasterEgg');
    this.outerContainerEl.appendChild(this.containerEl);
  }

  /**
   * Load the sprite sheet image.
   */
  private loadImages() {
    let scale = '1x';
    this.spriteDef = spriteDefinitionByType.original.ldpi;
    if (IS_HIDPI) {
      scale = '2x';
      this.spriteDef = spriteDefinitionByType.original.hdpi;
    }

    const imageSpriteElement = document.querySelector<HTMLImageElement>(
        `#${RESOURCE_POSTFIX + scale}`);
    assert(imageSpriteElement);
    this.imageSprite = imageSpriteElement;

    if (this.imageSprite.complete) {
      this.init();
    } else {
      this.imageSprite.addEventListener('load', this.init.bind(this));
    }
  }

  /**
   * Initialize the game.
   */
  private init() {
    // Hide the static offline icon
    const iconElement = document.querySelector<HTMLElement>('.icon-offline');
    if (iconElement) {
      iconElement.style.visibility = 'hidden';
    }

    this.adjustDimensions();

    // Create container
    this.containerEl = document.createElement('div');
    this.containerEl.setAttribute('role', 'application');
    this.containerEl.setAttribute('tabindex', '0');
    this.containerEl.setAttribute('title', 'Pong Game');
    this.containerEl.setAttribute('aria-label', 'Pong Game - Press Space to start');
    this.containerEl.className = PongClasses.CONTAINER;

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = PongClasses.CANVAS;
    this.canvas.width = this.dimensions.width;
    this.canvas.height = this.dimensions.height;
    this.containerEl.appendChild(this.canvas);

    const canvasContext = this.canvas.getContext('2d');
    assert(canvasContext);
    this.canvasCtx = canvasContext;

    this.updateCanvasScaling();

    // Initialize game entities
    this.playerPaddle = new Paddle(
        PONG_CONFIG.PADDLE_MARGIN,
        this.dimensions.height);

    this.aiPaddle = new Paddle(
        this.dimensions.width - PONG_CONFIG.PADDLE_MARGIN - PONG_CONFIG.PADDLE_WIDTH,
        this.dimensions.height);

    this.ball = new Ball(this.dimensions.width, this.dimensions.height);

    assert(this.imageSprite);
    this.scoreDisplay = new ScoreDisplay(
        this.canvas,
        this.spriteDef.textSprite,
        this.dimensions.width,
        this.dimensions.height,
        this.imageSprite);

    this.outerContainerEl.appendChild(this.containerEl);

    // Add instructions below the game
    const instructions = document.createElement('div');
    instructions.className = 'pong-instructions';
    instructions.textContent = 'Press space to start. Use arrow keys to control the paddle.';
    instructions.style.cssText = 'color: #757575; font-size: 12px; margin-top: 10px; text-align: center;';
    this.outerContainerEl.appendChild(instructions);

    // Start listening for input
    this.startListening();

    // Start the game loop
    this.update();

    // Handle window resize
    window.addEventListener('resize', this.debounceResize.bind(this));
  }

  /**
   * Update canvas scaling for HiDPI displays.
   */
  private updateCanvasScaling() {
    assert(this.canvas);
    assert(this.canvasCtx);

    const devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
    if (devicePixelRatio !== 1) {
      const oldWidth = this.canvas.width;
      const oldHeight = this.canvas.height;

      this.canvas.width = oldWidth * devicePixelRatio;
      this.canvas.height = oldHeight * devicePixelRatio;
      this.canvas.style.width = oldWidth + 'px';
      this.canvas.style.height = oldHeight + 'px';

      this.canvasCtx.scale(devicePixelRatio, devicePixelRatio);
    }
  }

  private resizeTimerId?: number;

  /**
   * Debounce resize events.
   */
  private debounceResize() {
    if (this.resizeTimerId === undefined) {
      this.resizeTimerId = window.setInterval(
          this.adjustDimensions.bind(this), 250);
    }
  }

  /**
   * Adjust dimensions on window resize.
   */
  private adjustDimensions() {
    clearInterval(this.resizeTimerId);
    this.resizeTimerId = undefined;

    const boxStyles = window.getComputedStyle(this.outerContainerEl);
    const padding = Number(
        boxStyles.paddingLeft.substr(0, boxStyles.paddingLeft.length - 2));

    this.dimensions.width = Math.min(
        DEFAULT_DIMENSIONS.width,
        this.outerContainerEl.offsetWidth - padding * 2);

    if (this.canvas) {
      this.canvas.width = this.dimensions.width;
      this.canvas.height = this.dimensions.height;
      this.updateCanvasScaling();

      // Update AI paddle position for new width
      if (this.aiPaddle) {
        this.aiPaddle.x = this.dimensions.width - PONG_CONFIG.PADDLE_MARGIN -
            PONG_CONFIG.PADDLE_WIDTH;
      }

      // Update ball canvas dimensions
      if (this.ball) {
        this.ball = new Ball(this.dimensions.width, this.dimensions.height);
      }

      // Update score display dimensions
      if (this.scoreDisplay && this.imageSprite) {
        this.scoreDisplay = new ScoreDisplay(
            this.canvas,
            this.spriteDef.textSprite,
            this.dimensions.width,
            this.dimensions.height,
            this.imageSprite);
      }
    }
  }

  /**
   * Start listening for keyboard input.
   */
  private startListening() {
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    // Touch controls for mobile
    if (IS_MOBILE && this.containerEl) {
      this.containerEl.addEventListener('touchstart', this.onTouchStart.bind(this));
      this.containerEl.addEventListener('touchmove', this.onTouchMove.bind(this));
      this.containerEl.addEventListener('touchend', this.onTouchEnd.bind(this));
    }
  }

  private touchY: number | null = null;

  /**
   * Handle touch start.
   */
  private onTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (this.state === GameState.WAITING || this.state === GameState.GAME_OVER) {
      this.startGame();
    }
    this.touchY = e.touches[0]?.clientY ?? null;
  }

  /**
   * Handle touch move for paddle control.
   */
  private onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (this.touchY !== null && this.playerPaddle && this.canvas) {
      const currentY = e.touches[0]?.clientY;
      if (currentY !== undefined) {
        const canvasRect = this.canvas.getBoundingClientRect();
        const relativeY = currentY - canvasRect.top;
        this.playerPaddle.y = Math.max(
            0,
            Math.min(
                this.dimensions.height - this.playerPaddle.height,
                relativeY - this.playerPaddle.height / 2));
      }
    }
  }

  /**
   * Handle touch end.
   */
  private onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    this.touchY = null;
  }

  /**
   * Handle key down events.
   */
  private onKeyDown(e: KeyboardEvent) {
    const keyCode = e.keyCode;

    if (keyCode === KEY_CODES.SPACE) {
      e.preventDefault();
      if (this.state === GameState.WAITING || this.state === GameState.GAME_OVER) {
        this.startGame();
      }
    }

    if (keyCode === KEY_CODES.UP || keyCode === KEY_CODES.DOWN ||
        keyCode === KEY_CODES.W || keyCode === KEY_CODES.S) {
      e.preventDefault();
      this.keysPressed.add(keyCode);
    }
  }

  /**
   * Handle key up events.
   */
  private onKeyUp(e: KeyboardEvent) {
    this.keysPressed.delete(e.keyCode);
  }

  /**
   * Start a new game.
   */
  private startGame() {
    if (this.state === GameState.GAME_OVER) {
      // Reset scores for new game
      this.scoreDisplay?.reset();
    }

    this.state = GameState.PLAYING;
    this.ball?.reset();
    this.playerPaddle?.reset();
    this.aiPaddle?.reset();

    // Launch ball after a short delay
    setTimeout(() => {
      if (this.state === GameState.PLAYING) {
        this.ball?.launch(Math.random() > 0.5);
      }
    }, 500);
  }

  /**
   * Clear the canvas.
   */
  private clearCanvas() {
    assert(this.canvasCtx);
    this.canvasCtx.fillStyle = '#f7f7f7';
    this.canvasCtx.fillRect(0, 0, this.dimensions.width, this.dimensions.height);
  }

  /**
   * Main game loop.
   */
  private update() {
    this.updatePending = false;

    const now = getTimeStamp();
    const deltaTime = now - (this.time || now);
    this.time = now;

    this.clearCanvas();

    assert(this.playerPaddle);
    assert(this.aiPaddle);
    assert(this.ball);
    assert(this.scoreDisplay);

    // Handle player input
    if (this.keysPressed.has(KEY_CODES.UP) || this.keysPressed.has(KEY_CODES.W)) {
      this.playerPaddle.moveUp(deltaTime);
    }
    if (this.keysPressed.has(KEY_CODES.DOWN) || this.keysPressed.has(KEY_CODES.S)) {
      this.playerPaddle.moveDown(deltaTime);
    }

    // Update game based on state
    if (this.state === GameState.PLAYING) {
      this.updatePlaying(deltaTime);
    } else if (this.state === GameState.SCORED) {
      this.updateScored(deltaTime);
    }

    // Update score display animation
    this.scoreDisplay.update(deltaTime);

    // Draw everything
    this.draw();

    // Schedule next frame
    this.scheduleNextUpdate();
  }

  /**
   * Update game logic while playing.
   */
  private updatePlaying(deltaTime: number) {
    assert(this.ball);
    assert(this.playerPaddle);
    assert(this.aiPaddle);
    assert(this.scoreDisplay);

    // Update AI paddle
    this.updateAI(deltaTime);

    // Update ball and check for scoring
    const scored = this.ball.update(deltaTime);

    // Check paddle collisions
    this.ball.checkPaddleCollision(this.playerPaddle);
    this.ball.checkPaddleCollision(this.aiPaddle);

    // Handle scoring
    if (scored) {
      if (scored === 'left') {
        // AI scores (ball went past player)
        this.scoreDisplay.setAiScore(this.scoreDisplay.getAiScore() + 1);
      } else {
        // Player scores (ball went past AI)
        this.scoreDisplay.setPlayerScore(this.scoreDisplay.getPlayerScore() + 1);
      }

      // Check for game over
      if (this.scoreDisplay.getPlayerScore() >= PONG_CONFIG.WINNING_SCORE ||
          this.scoreDisplay.getAiScore() >= PONG_CONFIG.WINNING_SCORE) {
        this.state = GameState.GAME_OVER;
      } else {
        this.state = GameState.SCORED;
        this.scoreDelayTimer = 0;
        this.ball.reset();
      }
    }
  }

  /**
   * Update AI paddle movement.
   */
  private updateAI(deltaTime: number) {
    assert(this.ball);
    assert(this.aiPaddle);

    // Only move if ball is heading toward AI
    if (this.ball.vx > 0) {
      // Predict where ball will be when it reaches AI paddle
      const timeToReach = (this.aiPaddle.x - this.ball.x) / this.ball.vx;
      let predictedY = this.ball.y + this.ball.vy * timeToReach;

      // Account for bounces
      while (predictedY < 0 || predictedY > this.dimensions.height) {
        if (predictedY < 0) {
          predictedY = -predictedY;
        }
        if (predictedY > this.dimensions.height) {
          predictedY = 2 * this.dimensions.height - predictedY;
        }
      }

      // Add some randomness to make AI beatable
      const randomOffset = (Math.random() - 0.5) * 20;
      predictedY += randomOffset;

      this.aiPaddle.moveToward(
          predictedY,
          deltaTime,
          PONG_CONFIG.AI_REACTION_SPEED);
    } else {
      // Ball moving away, move toward center
      this.aiPaddle.moveToward(
          this.dimensions.height / 2,
          deltaTime,
          PONG_CONFIG.AI_REACTION_SPEED * 0.5);
    }
  }

  /**
   * Update after scoring (delay before ball launch).
   */
  private updateScored(deltaTime: number) {
    this.scoreDelayTimer += deltaTime;

    if (this.scoreDelayTimer >= PONG_CONFIG.SCORE_DELAY) {
      this.state = GameState.PLAYING;
      this.ball?.launch(Math.random() > 0.5);
    }
  }

  /**
   * Draw all game entities.
   */
  private draw() {
    assert(this.canvasCtx);
    assert(this.playerPaddle);
    assert(this.aiPaddle);
    assert(this.ball);
    assert(this.scoreDisplay);

    // Draw center line (dashed)
    this.drawCenterLine();

    // Draw paddles
    this.playerPaddle.draw(this.canvasCtx);
    this.aiPaddle.draw(this.canvasCtx);

    // Draw ball
    this.ball.draw(this.canvasCtx);

    // Draw scores
    this.scoreDisplay.draw();

    // Draw state-specific messages
    if (this.state === GameState.WAITING) {
      this.scoreDisplay.drawStartMessage();
    } else if (this.state === GameState.GAME_OVER) {
      const playerWon =
          this.scoreDisplay.getPlayerScore() >= PONG_CONFIG.WINNING_SCORE;
      this.scoreDisplay.drawGameOver(playerWon);
    }
  }

  /**
   * Draw the center line.
   */
  private drawCenterLine() {
    assert(this.canvasCtx);

    this.canvasCtx.save();
    this.canvasCtx.strokeStyle = '#535353';
    this.canvasCtx.lineWidth = 2;
    this.canvasCtx.setLineDash([10, 10]);

    const centerX = this.dimensions.width / 2;
    this.canvasCtx.beginPath();
    this.canvasCtx.moveTo(centerX, 0);
    this.canvasCtx.lineTo(centerX, this.dimensions.height);
    this.canvasCtx.stroke();

    this.canvasCtx.restore();
  }

  /**
   * Schedule the next frame update.
   */
  private scheduleNextUpdate() {
    if (!this.updatePending) {
      this.updatePending = true;
      this.raqId = requestAnimationFrame(this.update.bind(this));
    }
  }
}

// Also export as Runner for compatibility with existing code that might reference it
export { PongGame as Runner };
