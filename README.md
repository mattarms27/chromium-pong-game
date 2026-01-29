# Chromium Pong Game

Basically all you need to do is replace contents of the `components/neterror` file with the contents in this repo.

This directory contains the HTML template and resources displayed in the case of
network errors received when fetching the root document or iframes. These error
pages can be previewed by following the links listed to chrome://network-errors.

The same template is used across all desktop and mobile platforms and for main
frames and iframes.

This also includes the scripts and images for the offline Pong game.

## Pong Game

The classic Chrome dinosaur game has been replaced with a Pong game while
maintaining the original Google/Chrome visual aesthetic.

### How to Play

- **Space**: Start game / Restart after game over
- **Up/Down Arrow Keys**: Move the player paddle (left side)
- First player to 11 points wins
- The right paddle is controlled by the computer

### Files Changed

The following files were modified or created to implement the Pong game:

#### New Files

| File | Description |
|------|-------------|
| `resources/dino_game/paddle.ts` | Paddle entity with movement and collision detection |
| `resources/dino_game/ball.ts` | Ball entity with physics, wall bouncing, and paddle collision |
| `resources/dino_game/score_display.ts` | Score rendering using the existing sprite sheet digits |

#### Modified Files

| File | Description |
|------|-------------|
| `resources/dino_game/offline.ts` | Complete rewrite as the Pong game engine |
| `resources/dino_game/constants.ts` | Added `PONG_CONFIG` with game settings |

#### Unused Dino Game Files

The following files are no longer used but remain in the codebase:

- `trex.ts` - T-Rex player character
- `horizon.ts` - Scrolling horizon/environment
- `obstacle.ts` - Cactus and pterodactyl obstacles
- `cloud.ts` - Background clouds
- `night_mode.ts` - Night mode effects
- `background_el.ts` - Background elements
- `horizon_line.ts` - Ground line
- `game_over_panel.ts` - Original game over UI

### Visual Style

The Pong game maintains the Chrome/Google aesthetic:

- Background: `#f7f7f7` (light gray)
- Game elements: `#535353` (dark gray)
- Score display uses the existing sprite sheet digit graphics
- Dashed center line divides the play area

### Game Configuration

Game settings can be adjusted in `constants.ts`:

```typescript
export const PONG_CONFIG = {
  PADDLE_WIDTH: 10,
  PADDLE_HEIGHT: 40,
  PADDLE_SPEED: 5,
  PADDLE_MARGIN: 20,
  BALL_SIZE: 8,
  BALL_SPEED: 4,
  WINNING_SCORE: 11,
  AI_REACTION_SPEED: 0.85,
  SCORE_DELAY: 1000,
};
```

---

See also:
- [components/neterror/](components/neterror/) for the code that utilises this template
- [components/security_interstitials/core/common/resources/](components/security_interstitials/core/common/resources/) for commons CSS and JS files with security interstitials

# chromium-pong-game
