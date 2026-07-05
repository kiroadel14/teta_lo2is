# Teta Lo2is (تيتا لوئيس) 🏎️📚

## Overview

**Teta Lo2is** (Grandma Lo2is) is an engaging, Arabic-language educational game built with React, Vite, and Tailwind CSS. Originally a car racing game, it has evolved into a multi-mode adventure (car racing, river boating, and airplane flying) combined with interactive learning. It is designed to help kids learn Old Testament Bible stories while enjoying fast-paced arcade action.

## Features

- **Multiple Game Modes:** 
  - **Lane Racing:** Classic 3-lane dodging (Levels 2 & 5).
  - **Free Steering:** Steer a boat freely across a river (Levels 1 & 4).
  - **Flappy Mode:** Tap-to-fly mechanics dodging pipes (Levels 3 & 6).
- **Educational Gameplay:** Answer multiple-choice questions about Biblical stories mid-level to refuel and survive.
- **Story Integration:** Each level begins with a YouTube story video.
- **Audio Support:** Full Arabic voiceovers for questions, plus background music and SFX.
- **Global Leaderboard:** Firebase-powered top 10 player rankings.
- **Cloud Progress:** Auto-saves unlocked levels, stars, and scores in Firestore.

## Tech Stack

- **Framework:** React 18.3.1 + Vite 8
- **Styling:** Tailwind CSS v4 + Inline SVG 3D projections
- **Animations:** Framer Motion (motion v12)
- **UI Components:** Radix UI (shadcn wrappers)
- **Backend:** Firebase v12 (Auth + Firestore)
- **Deployment:** GitHub Pages

## Folder Structure

```text
teta_lo2is/
├── public/                 # Static assets (Audio, Logos)
├── src/
│   ├── app/                # Main application logic
│   │   ├── components/     # Game screens (RaceScreen, LevelSelect, etc.)
│   │   └── data/           # Level configurations and questions
│   ├── styles/             # Global CSS and Tailwind directives
│   ├── firebase.ts         # Firebase configuration and initialization
│   └── main.tsx            # React entry point
├── package.json            # Dependencies and scripts
└── vite.config.ts          # Vite build config
```

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd teta_lo2is
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

## Running Locally

To start the local development server:
```bash
npm start
```

*Note: Make sure your Firebase credentials are appropriately set up if developing authentication/database features.*

## Build & Deployment

To create a production build:
```bash
npm run build
```

To deploy to GitHub Pages:
```bash
npm run deploy
```

## Environment Variables

Firebase configuration is currently embedded directly in `src/firebase.ts`. For production security best practices, these should be moved to `.env` variables if repo visibility allows.

## Available Scripts
- `npm start` / `npm run dev`: Start dev server
- `npm run build`: Build for production
- `npm run deploy`: Deploy dist folder to GitHub Pages

## Current Game Levels
1. **الخليقة (Creation)** - River Mode (Free)
2. **آدم وحواء (Adam & Eve)** - Car Racing (Lane)
3. **قايين وهابيل (Cain & Abel)** - Flappy Plane (Flappy)
4. **نوح والفلك (Noah's Ark)** - River Mode (Free)
5. **بابل (Babel)** - Car Racing (Lane)
6. **إبراهيم (Abraham)** - Flappy Plane (Flappy)

## Assets Requirements
Place your media in `/public`:
- Audio: `/public/audio/levels/level[1-6]/question[1-3].mp3`

*(Note: Videos are currently loaded via YouTube iframe embeds in `levels.ts`)*

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
