const fs = require('fs');
const path = require('path');
const dir = path.join('public', 'images', 'flappy');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Airplane
fs.writeFileSync(path.join(dir, 'placeholder_player_airplane.svg'),
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>
    <ellipse cx='40' cy='40' rx='35' ry='15' fill='#E74C3C'/>
    <rect x='50' y='25' width='10' height='30' fill='#C0392B'/>
    <polygon points='10,40 25,20 30,40' fill='#C0392B'/>
    <circle cx='60' cy='35' r='5' fill='#87CEEB'/>
  </svg>`);

// Pipe Top
fs.writeFileSync(path.join(dir, 'placeholder_pipe_top.svg'),
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 400' preserveAspectRatio='none'>
    <rect x='10' y='0' width='80' height='380' fill='#2ECC71' stroke='#27AE60' stroke-width='4'/>
    <rect x='0' y='380' width='100' height='20' fill='#27AE60'/>
  </svg>`);

// Pipe Bottom
fs.writeFileSync(path.join(dir, 'placeholder_pipe_bottom.svg'),
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 400' preserveAspectRatio='none'>
    <rect x='0' y='0' width='100' height='20' fill='#27AE60'/>
    <rect x='10' y='20' width='80' height='380' fill='#2ECC71' stroke='#27AE60' stroke-width='4'/>
  </svg>`);

// Sky Background
fs.writeFileSync(path.join(dir, 'placeholder_sky_background.svg'),
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' preserveAspectRatio='none'>
    <rect width='100%' height='100%' fill='#71C5CF'/>
  </svg>`);

// City Skyline
fs.writeFileSync(path.join(dir, 'placeholder_city_skyline_silhouette.svg'),
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 200' preserveAspectRatio='none'>
    <rect x='50' y='100' width='80' height='100' fill='#95A5A6'/>
    <rect x='150' y='50' width='60' height='150' fill='#7F8C8D'/>
    <rect x='230' y='120' width='100' height='80' fill='#95A5A6'/>
    <rect x='350' y='80' width='70' height='120' fill='#7F8C8D'/>
    <rect x='450' y='40' width='90' height='160' fill='#95A5A6'/>
    <rect x='560' y='110' width='80' height='90' fill='#7F8C8D'/>
    <rect x='660' y='60' width='100' height='140' fill='#95A5A6'/>
  </svg>`);

// Cloud Band
fs.writeFileSync(path.join(dir, 'placeholder_cloud_band.svg'),
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 100' preserveAspectRatio='none'>
    <circle cx='100' cy='50' r='40' fill='white' opacity='0.8'/>
    <circle cx='150' cy='60' r='30' fill='white' opacity='0.8'/>
    <circle cx='300' cy='40' r='35' fill='white' opacity='0.8'/>
    <circle cx='360' cy='50' r='45' fill='white' opacity='0.8'/>
    <circle cx='550' cy='55' r='30' fill='white' opacity='0.8'/>
    <circle cx='600' cy='45' r='40' fill='white' opacity='0.8'/>
  </svg>`);

// Ground Strip
fs.writeFileSync(path.join(dir, 'placeholder_ground_strip.svg'),
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 100' preserveAspectRatio='none'>
    <rect width='100%' height='20' fill='#73BF2E'/>
    <rect y='20' width='100%' height='80' fill='#DED895'/>
    <path d='M0,20 L800,20' stroke='#558B2F' stroke-width='4'/>
  </svg>`);
