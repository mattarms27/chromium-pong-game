// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {PONG_CONFIG} from './constants.js';
import type {Paddle} from './paddle.js';

/**
 * Represents the ball in the Pong game.
 */
export class Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  private canvasWidth: number;
  private canvasHeight: number;
  private baseSpeed: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.size = PONG_CONFIG.BALL_SIZE;
    this.baseSpeed = PONG_CONFIG.BALL_SPEED;

    // Initialize at center
    this.x = canvasWidth / 2 - this.size / 2;
    this.y = canvasHeight / 2 - this.size / 2;
    this.vx = 0;
    this.vy = 0;
  }

  /**
   * Start ball movement in a random direction.
   */
  launch(towardPlayer: boolean = false) {
    // Random angle between -45 and 45 degrees
    const angle = (Math.random() - 0.5) * Math.PI / 2;
    const direction = towardPlayer ? -1 : 1;

    this.vx = Math.cos(angle) * this.baseSpeed * direction;
    this.vy = Math.sin(angle) * this.baseSpeed;
  }

  /**
   * Update ball position and handle wall collisions.
   * Returns: 'left' if ball went past left edge, 'right' if past right edge, null otherwise.
   */
  update(deltaTime: number): 'left' | 'right' | null {
    const timeScale = deltaTime / 16.67; // Normalize to ~60fps

    this.x += this.vx * timeScale;
    this.y += this.vy * timeScale;

    // Top wall collision
    if (this.y <= 0) {
      this.y = 0;
      this.vy = -this.vy;
    }

    // Bottom wall collision
    if (this.y + this.size >= this.canvasHeight) {
      this.y = this.canvasHeight - this.size;
      this.vy = -this.vy;
    }

    // Check if ball went past edges (scoring)
    if (this.x + this.size < 0) {
      return 'left'; // AI scores
    }
    if (this.x > this.canvasWidth) {
      return 'right'; // Player scores
    }

    return null;
  }

  /**
   * Check and handle collision with a paddle.
   * Returns true if collision occurred.
   */
  checkPaddleCollision(paddle: Paddle): boolean {
    const bounds = paddle.getBounds();

    // Check if ball overlaps with paddle
    if (
      this.x < bounds.x + bounds.width &&
      this.x + this.size > bounds.x &&
      this.y < bounds.y + bounds.height &&
      this.y + this.size > bounds.y
    ) {
      // Calculate where on the paddle the ball hit (-1 to 1)
      const paddleCenter = bounds.y + bounds.height / 2;
      const ballCenter = this.y + this.size / 2;
      const relativeIntersect = (ballCenter - paddleCenter) / (bounds.height / 2);

      // Bounce angle based on hit position (max 60 degrees)
      const bounceAngle = relativeIntersect * (Math.PI / 3);

      // Determine direction based on which paddle was hit
      const direction = this.vx > 0 ? -1 : 1;

      // Increase speed slightly with each hit (up to 1.5x base)
      const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const newSpeed = Math.min(currentSpeed * 1.05, this.baseSpeed * 1.5);

      this.vx = Math.cos(bounceAngle) * newSpeed * direction;
      this.vy = Math.sin(bounceAngle) * newSpeed;

      // Push ball out of paddle to prevent multiple collisions
      if (direction === -1) {
        this.x = bounds.x - this.size;
      } else {
        this.x = bounds.x + bounds.width;
      }

      return true;
    }

    return false;
  }

  /**
   * Draw the ball on the canvas.
   */
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#535353';
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }

  /**
   * Reset ball to center with no velocity.
   */
  reset() {
    this.x = this.canvasWidth / 2 - this.size / 2;
    this.y = this.canvasHeight / 2 - this.size / 2;
    this.vx = 0;
    this.vy = 0;
  }

  /**
   * Check if ball is moving (game is active).
   */
  isMoving(): boolean {
    return this.vx !== 0 || this.vy !== 0;
  }
}
