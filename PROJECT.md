# Online Checkers

## Project status
Playable local MVP with a computer opponent, two selectable rulesets, and best-move hints. Online multiplayer is deferred until the rules engine and browser interaction are stable.

## Goal
Build a browser-based checkers game that begins as a reliable human-versus-computer experience and can later evolve into online multiplayer.

## Implemented MVP
- Render an 8×8 checkers board.
- Place pieces in the standard starting positions.
- Let the human play red against a computer opponent playing black.
- Switch between English checkers and Russian-mode rules.
- Validate legal diagonal moves.
- Support captures.
- Enforce mandatory captures.
- Support multi-capture sequences.
- Promote pieces to kings.
- Highlight all legal targets for the selected piece.
- Highlight the suggested best target with a different color.
- Detect wins when a side has no pieces or no legal moves.
- Show whose turn it is.
- Block human input while the computer is thinking.
- Provide a restart button.

## Move hints
- Yellow squares show all legal targets for the selected piece.
- Green squares show the suggested best target or targets.
- The suggestion is calculated from the board evaluation after the human move and the likely computer reply.

## Rulesets
### English checkers
- Regular pieces move diagonally forward by one square.
- Regular pieces capture diagonally forward.
- Kings move and capture one square diagonally in either direction.
- Captures are mandatory.
- Multi-capture sequences must be completed.

### Russian mode
- Regular pieces move diagonally forward by one square.
- Regular pieces capture diagonally forward only.
- Kings move any number of free squares diagonally.
- Kings capture across distance and may land on any free square beyond the captured piece.
- Captures are mandatory.
- Multi-capture sequences must be completed.

## Computer opponent
The computer:
- Generates complete legal turns, including forced multi-capture sequences.
- Uses the active ruleset when generating moves.
- Evaluates board positions using material, king value, progress, center control, and mobility.
- Looks one human reply ahead before selecting a move.
- Breaks ties randomly so repeated games are not fully deterministic.

## Out of scope for this MVP
- Online multiplayer.
- User accounts.
- Matchmaking.
- Rating system.
- Chat.
- Persistent game history.
- Advanced difficulty levels.

## Later milestones
### Milestone 2 — Browser testing and deployment
- Run manual browser tests for captures, promotions, blocked positions, restart behavior, rule switching, move hints, and mobile layout.
- Publish through GitHub Pages.

### Milestone 3 — Online multiplayer
- Create and join rooms.
- Synchronize moves through WebSocket transport.
- Handle disconnects and reconnects.
- Validate moves on the server.

### Milestone 4 — Product layer
- User accounts.
- Match history.
- Ratings.
- Public and private games.
- Basic moderation tools.

## Technical direction
Keep the first version intentionally small:
- HTML
- CSS
- JavaScript
- No framework until the local rules engine is stable

## Repository entrypoint
Start here when working on the project.
