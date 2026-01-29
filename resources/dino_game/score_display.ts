// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {IS_HIDPI} from './constants.js';
import type {SpritePosition} from './sprite_position.js';

/**
 * Dimensions of each digit character in pixels.
 */
const DIGIT_WIDTH = 10;
const DIGIT_HEIGHT = 13;
const DIGIT_DEST_WIDTH = 11;

/**
 * Displays the score for both players in a Pong game.
 * Format: "P1_SCORE - P2_SCORE" centered at top of canvas.
 */
export class ScoreDisplay {
  private canvas: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private image: CanvasImageSource;
  private spritePos: SpritePosition;
  private canvasWidth: number;
  private canvasHeight: number;

  private playerScore: number = 0;
  private aiScore: number = 0;

  private flashTimer: number = 0;
  private flashDuration: number = 150;
  private isFlashing: boolean = false;
  private flashingSide: 'player' | 'ai' | null = null;

  constructor(
      canvas: HTMLCanvasElement,
      spritePos: SpritePosition,
      canvasWidth: number,
      canvasHeight: number,
      image: CanvasImageSource) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    this.canvasCtx = ctx;
    this.image = image;
    this.spritePos = spritePos;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  /**
   * Set player score and trigger flash animation.
   */
  setPlayerScore(score: number) {
    if (score !== this.playerScore) {
      this.playerScore = score;
      this.startFlash('player');
    }
  }

  /**
   * Set AI score and trigger flash animation.
   */
  setAiScore(score: number) {
    if (score !== this.aiScore) {
      this.aiScore = score;
      this.startFlash('ai');
    }
  }

  /**
   * Get current player score.
   */
  getPlayerScore(): number {
    return this.playerScore;
  }

  /**
   * Get current AI score.
   */
  getAiScore(): number {
    return this.aiScore;
  }

  /**
   * Start flash animation for a score.
   */
  private startFlash(side: 'player' | 'ai') {
    this.isFlashing = true;
    this.flashingSide = side;
    this.flashTimer = 0;
  }

  /**
   * Update flash animation state.
   */
  update(deltaTime: number) {
    if (this.isFlashing) {
      this.flashTimer += deltaTime;
      if (this.flashTimer >= this.flashDuration * 6) { // 3 flashes
        this.isFlashing = false;
        this.flashingSide = null;
        this.flashTimer = 0;
      }
    }
  }

  /**
   * Draw a single digit at the specified position.
   */
  private drawDigit(digit: number, x: number, y: number) {
    let sourceWidth = DIGIT_WIDTH;
    let sourceHeight = DIGIT_HEIGHT;
    let sourceX = DIGIT_WIDTH * digit;
    let sourceY = 0;

    if (IS_HIDPI) {
      sourceWidth *= 2;
      sourceHeight *= 2;
      sourceX *= 2;
    }

    sourceX += this.spritePos.x;
    sourceY += this.spritePos.y;

    this.canvasCtx.drawImage(
        this.image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x,
        y,
        DIGIT_WIDTH,
        DIGIT_HEIGHT);
  }

  /**
   * Draw the scores on the canvas.
   */
  draw() {
    const y = 10; // Top margin

    // Determine if we should hide the flashing score
    const hideFlashing = this.isFlashing &&
        Math.floor(this.flashTimer / this.flashDuration) % 2 === 1;

    // Format scores as 2-digit strings
    const playerStr = this.playerScore.toString().padStart(2, '0');
    const aiStr = this.aiScore.toString().padStart(2, '0');

    // Calculate total width: "00 - 00" = 7 characters worth
    // 2 digits + space + dash + space + 2 digits
    const dashWidth = DIGIT_DEST_WIDTH;
    const spaceWidth = DIGIT_DEST_WIDTH / 2;
    const totalWidth = (4 * DIGIT_DEST_WIDTH) + (2 * spaceWidth) + dashWidth;
    const startX = (this.canvasWidth - totalWidth) / 2;

    let currentX = startX;

    // Draw player score (left side)
    if (!(hideFlashing && this.flashingSide === 'player')) {
      for (let i = 0; i < playerStr.length; i++) {
        this.drawDigit(parseInt(playerStr[i]!, 10), currentX, y);
        currentX += DIGIT_DEST_WIDTH;
      }
    } else {
      currentX += DIGIT_DEST_WIDTH * 2;
    }

    // Draw separator " - "
    currentX += spaceWidth;
    this.drawDash(currentX, y + 5); // Centered vertically
    currentX += dashWidth + spaceWidth;

    // Draw AI score (right side)
    if (!(hideFlashing && this.flashingSide === 'ai')) {
      for (let i = 0; i < aiStr.length; i++) {
        this.drawDigit(parseInt(aiStr[i]!, 10), currentX, y);
        currentX += DIGIT_DEST_WIDTH;
      }
    }
  }

  /**
   * Draw a dash/minus sign.
   */
  private drawDash(x: number, y: number) {
    this.canvasCtx.fillStyle = '#535353';
    this.canvasCtx.fillRect(x + 2, y, DIGIT_WIDTH - 4, 3);
  }

  /**
   * Draw game over message.
   */
  drawGameOver(playerWon: boolean) {
    const message = playerWon ? 'YOU WIN!' : 'CPU WINS';
    const y = this.canvasHeight / 2 - 10;

    this.canvasCtx.save();
    this.canvasCtx.fillStyle = '#535353';
    this.canvasCtx.font = 'bold 20px Arial, sans-serif';
    this.canvasCtx.textAlign = 'center';
    this.canvasCtx.fillText(message, this.canvasWidth / 2, y);

    this.canvasCtx.font = '12px Arial, sans-serif';
    this.canvasCtx.fillText('Press SPACE to play again', this.canvasWidth / 2, y + 25);
    this.canvasCtx.restore();
  }

  /**
   * Draw start message.
   */
  drawStartMessage() {
    const y = this.canvasHeight / 2 + 20;

    this.canvasCtx.save();
    this.canvasCtx.fillStyle = '#535353';
    this.canvasCtx.font = '12px Arial, sans-serif';
    this.canvasCtx.textAlign = 'center';
    this.canvasCtx.fillText('Press SPACE to start', this.canvasWidth / 2, y);
    this.canvasCtx.restore();
  }

  /**
   * Reset scores to zero.
   */
  reset() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.isFlashing = false;
    this.flashingSide = null;
    this.flashTimer = 0;
  }
}
