# Online Checkers

Browser-based English checkers game.

You play red against a computer opponent playing black. Online multiplayer will be added only after the rules engine and browser interaction are stable.

## Current MVP
- 8×8 board
- Standard piece placement
- Human versus computer mode
- Legal diagonal moves
- Mandatory captures
- Multi-capture sequences
- King promotion
- Win detection when a side has no pieces or no legal moves
- Restart button

## Ruleset
This MVP uses English checkers rules:
- Regular pieces move and capture diagonally forward.
- Kings move and capture one square diagonally in either direction.
- Captures are mandatory.

## Computer opponent
The computer generates complete legal turns, handles forced multi-captures, evaluates positions, and looks one human reply ahead.

## Project entrypoint
Read [`PROJECT.md`](./PROJECT.md) before starting implementation work.
