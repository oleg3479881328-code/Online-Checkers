# Online Checkers

## Project status
Bootstrap phase. The repository is being prepared for a first playable local MVP before online multiplayer is added.

## Goal
Build a browser-based checkers game that starts as a reliable local two-player experience and can later evolve into online multiplayer.

## MVP scope
The first milestone is a playable local game in the browser.

### Required for MVP
- Render an 8×8 checkers board.
- Place pieces in the standard starting positions.
- Allow two players to take turns on one device.
- Validate legal diagonal moves.
- Support captures.
- Enforce forced captures when available.
- Support multi-capture sequences.
- Promote pieces to kings.
- Detect win conditions.
- Show whose turn it is.
- Provide a restart button.

### Out of scope for MVP
- Online multiplayer.
- User accounts.
- Matchmaking.
- Rating system.
- Chat.
- Persistent game history.

## Later milestones
### Milestone 2 — Online multiplayer
- Create and join rooms.
- Synchronize moves through WebSocket transport.
- Handle disconnects and reconnects.
- Validate moves on the server.

### Milestone 3 — Product layer
- User accounts.
- Match history.
- Ratings.
- Public and private games.
- Basic moderation tools.

## Initial technical direction
Keep the first version intentionally small:
- HTML
- CSS
- JavaScript
- No framework until the local rules engine is stable

## Repository entrypoint
Start here when working on the project.

## Next implementation task
Create the local playable MVP with:
- `index.html`
- `styles.css`
- `app.js`
