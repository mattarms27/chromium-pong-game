// Copyright 2024 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {PONG_CONFIG} from './constants.js';

/**
 * Represents a paddle in the Pong game.
 */
export class Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  private canvasHeight: number;

  constructor(x: number, canvasHeight: number) {
    this.x = x;
    this.canvasHeight = canvasHeight;
    this.width = PONG_CONFIG.PADDLE_WIDTH;
    this.height = PONG_CONFIG.PADDLE_HEIGHT;
    this.speed = PONG_CONFIG.PADDLE_SPEED;
    // Center paddle vertically
    this.y = (canvasHeight - this.height) / 2;
  }

  /**
   * Move paddle up.
   */
  moveUp(deltaTime: number) {
    const movement = this.speed * (deltaTime / 16.67); // Normalize to ~60fps
    this.y = Math.max(0, this.y - movement);
  }

  /**
   * Move paddle down.
   */
  moveDown(deltaTime: number) {
    const movement = this.speed * (deltaTime / 16.67);
    this.y = Math.min(this.canvasHeight - this.height, this.y + movement);
  }

  /**
   * Move paddle toward a target Y position (for AI).
   */
  moveToward(targetY: number, deltaTime: number, reactionSpeed: number) {
    const paddleCenter = this.y + this.height / 2;
    const diff = targetY - paddleCenter;
    const movement = this.speed * reactionSpeed * (deltaTime / 16.67);

    if (Math.abs(diff) > movement) {
      if (diff > 0) {
        this.moveDown(deltaTime * reactionSpeed);
      } else {
        this.moveUp(deltaTime * reactionSpeed);
      }
    }
  }

  /**
   * Draw the paddle on the canvas.
   */
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#535353';
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  /**
   * Reset paddle to center position.
   */
  reset() {
    this.y = (this.canvasHeight - this.height) / 2;
  }

  /**
   * Get the collision bounds of the paddle.
   */
  getBounds(): {x: number, y: number, width: number, height: number} {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    };
  }
}
