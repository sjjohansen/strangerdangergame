# Nightmare Rescue

An offline first-person horror game built with Babylon.js. Rescue people trapped inside a nightmare, fight supernatural creatures with your hands, and defeat the boss waiting at the end of each chapter.

## Chapters

- **Chapter 1 — The Butcher's Kitchen:** Follow the blue beacons, rescue three haunted souls, and defeat the Butcher Chef.
- **Chapter 2 — Nightmare High:** Unlock the school after completing Chapter 1, rescue three more souls, and defeat the Evil Principal.
- **Chapter 3 — The Rooftop:** Climb into the night after completing Chapter 2, rescue the rooftop souls, and defeat the hooded Stranger across two full boss-health bars. Depleting the first bar begins a faster, more dangerous final phase.

Completing Chapters 1 and 2 displays a five-second intermission. When the countdown finishes, the player can choose to start the next chapter.

## Gameplay

- First-person mouse look with pointer lock
- WASD movement and jumping
- Close-range hand combat
- Crosshair, enemy flash, recoil, and screen-jolt feedback on successful hits
- Enemies face the player while pursuing and immediately turn and become permanently aggressive when struck
- Health, rescue progress, objectives, and boss health displays
- Automatic rescue when the player approaches a trapped person
- Chapter completion, retry, and restart screens

## Run locally

```bash
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://127.0.0.1:5173`.

To create the production version:

```bash
npm run build
```

Serve the generated `dist/` directory with any local static server. Babylon.js and all game assets are bundled locally; the game uses no CDN and needs no network connection at runtime.

## Controls

- WASD: move
- Mouse: look
- Space: jump
- Left click: whack
- Escape: release the mouse
