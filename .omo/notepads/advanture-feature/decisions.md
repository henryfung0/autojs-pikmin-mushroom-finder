# Decisions — Adventure Feature

## Architecture
- Create parallel module structure to mushroom_finder/ in new advanture/ directory
- Follow same patterns: state checking, flow logic, main entry point

## State Checking
- `isOnMainPage()`: placeholder/stub — user will provide exact logic later
- `isOnAdvanturePage()`: placeholder/stub — user will provide exact logic later

## Priority Matching
- When scrolling and detecting items: gift > plant > fruit
- If multiple items of the same type match, pick the highest confidence

## Flow
- Single continuous loop: scroll → detect → click → start → auto → wait → repeat
- No zigzag pattern needed — simple scroll down to reveal items
