# Online Checkers

Browser-based checkers game with selectable rulesets.

You play red against a computer opponent playing black. Online multiplayer will be added only after the rules engine and browser interaction are stable.

## Current MVP
- 8×8 board
- Standard piece placement
- Human versus computer mode
- English checkers mode
- Russian mode
- Mandatory captures
- Multi-capture sequences
- King promotion
- Win detection when a side has no pieces or no legal moves
- Restart button

## Rulesets
### English checkers
- Regular pieces move and capture diagonally forward.
- Kings move and capture one square diagonally in either direction.
- Captures are mandatory.

### Russian mode
- Regular pieces move and capture diagonally forward only.
- Kings move any number of free squares diagonally.
- Kings capture across distance and may land on any free square beyond the captured piece.
- Captures are mandatory.

## Computer opponent
The computer generates complete legal turns, handles forced multi-captures, evaluates positions, and looks one human reply ahead using the active ruleset.

## Project entrypoint
Read [`PROJECT.md`](./PROJECT.md) before starting implementation work.
