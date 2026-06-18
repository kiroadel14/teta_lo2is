# Teta Lo2is (تيتا لوئيس) 🏎️📚

**Teta Lo2is** is an engaging, Arabic-language educational racing game built with React, Vite, and Tailwind CSS. The game combines the thrill of a car race with interactive learning, designed to help kids practice various subjects such as math, colors, nature, and general knowledge.

## 🌟 Features

- **Educational Gameplay:** Players navigate a racing track and must answer multiple-choice questions to refuel their car and complete the level.
- **Progressive Levels:** 6 distinct levels, each with increasing difficulty (faster obstacles, higher target distances) and unique themes. Levels unlock sequentially as the player progresses.
- **Immersive Storytelling:** Each level features a story video introduction.
- **Audio Support:** Questions are fully voiced to assist young learners.
- **Local Progress Tracking:** The game automatically saves the player's unlocked levels and highest star ratings in the browser's local storage.
- **Rich UI & Animations:** Built using modern tools like Framer Motion for smooth transitions, Radix UI for accessible components, and Tailwind CSS for responsive styling.

## 🚀 Tech Stack

- **Framework:** [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + Custom CSS
- **Animations:** [Framer Motion](https://motion.dev/)
- **UI Components:** [Radix UI](https://www.radix-ui.com/)
- **Routing:** React Router v7
- **Icons:** Lucide React & Material Icons

## 🎮 How to Play

1. **Start the Game:** Select an unlocked level from the level selection screen.
2. **Watch the Story:** Each level begins with a brief story video to set the context.
3. **Race & Survive:** Use the on-screen buttons or arrow keys to dodge obstacles and survive until the target distance is reached.
4. **Answer Questions:** Periodically, you'll need to refuel by answering an educational question correctly.
5. **Win Stars:** Complete the level successfully to earn stars and unlock the next stage!

## 🛠️ Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository and navigate into the project directory:
   ```bash
   git clone <repository-url>
   cd teta_lo2is_v2
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

### Development

To start the local development server:
```bash
npm run start
```

### Production Build & Deployment

To create a production build:
```bash
npm run build
```

This project is configured to deploy to GitHub Pages. To deploy the app:
```bash
npm run deploy
```

## 📂 Asset Management
To fully configure the game, ensure the multimedia assets are placed in the `/public` directory:
- **Videos:** `/public/video/level[1-6]/story.mp4`
- **Audio:** `/public/audio/levels/level[1-6]/question[1-3].mp3`

*(Note: These are required to replace placeholders and activate voiceovers and story cutscenes.)*
