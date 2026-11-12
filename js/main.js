
// ---------- Setup ----------

const app = new PIXI.Application();
await app.init({
  resizeTo: window,
  backgroundAlpha: 0,           // transparent, the page colour shows through
  antialias: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
});
document.getElementById("stage").appendChild(app.canvas);

// Two layers: drawn in this order, so tiles cover the dots
const fieldLayer = new PIXI.Graphics();
app.stage.addChild(fieldLayer);
// const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;


// ---------- Colours ----------
// Read from the CSS variables so the canvas follows light and dark mode.

const colours = {};

function readColours() {
  const css = getComputedStyle(document.documentElement);
   for (const name of ["muted", "accent"]) {
    colours[name] = new PIXI.Color(css.getPropertyValue(`--${name}`).trim()).toNumber();
  }
}

readColours();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColours);


// ---------- Input ----------

const pointer = { x: -9999, y: -9999 };
const ripples = [];   // every click adds one: { x, y, born }

window.addEventListener("pointermove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

window.addEventListener("pointerdown", (e) => {
  ripples.push({ x: e.clientX, y: e.clientY, born: performance.now() });
});



// ---------- Dot field ----------
// Every dot has a home position and a current position.
// Forces push it away; a spring pulls it home again.

const SPACING = 28;
const PUSH_RADIUS = 150;
const RIPPLE_SPEED = 500;     // pixels per second
const RIPPLE_LIFE = 2000;     // milliseconds

let dots = [];

function buildField() {
  dots = [];
  for (let x = SPACING / 2; x < window.innerWidth; x += SPACING) {
    for (let y = SPACING / 2; y < window.innerHeight; y += SPACING) {
      dots.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0 });
    }
  }
}

// Push a dot away from a point, stronger when closer
function pushAway(dot, fromX, fromY, radius, strength) {
  const dx = dot.x - fromX;
  const dy = dot.y - fromY;
  const distance = Math.hypot(dx, dy) || 1;
  if (distance < radius) {
    const force = (1 - distance / radius) * strength;
    dot.vx += (dx / distance) * force;
    dot.vy += (dy / distance) * force;
  }
}

function updateField(now) {
  // Forget ripples that have faded out
  while (ripples.length && now - ripples[0].born > RIPPLE_LIFE) ripples.shift();

  for (const dot of dots) {
    pushAway(dot, pointer.x, pointer.y, PUSH_RADIUS, 1.2);

    // A ripple is a ring that grows; only dots near the ring get pushed
    for (const ripple of ripples) {
      const age = now - ripple.born;
      const ringRadius = (age / 1000) * RIPPLE_SPEED;
      const fromRing = Math.abs(Math.hypot(dot.x - ripple.x, dot.y - ripple.y) - ringRadius);
      if (fromRing < 20) pushAway(dot, ripple.x, ripple.y, ringRadius + 20, 3 * (1 - age / RIPPLE_LIFE));
    }

    // Spring home, with friction so it settles
    dot.vx = (dot.vx + (dot.homeX - dot.x) * 0.06) * 0.82;
    dot.vy = (dot.vy + (dot.homeY - dot.y) * 0.06) * 0.82;
    dot.x += dot.vx;
    dot.y += dot.vy;
  }
}

function drawField() {
  fieldLayer.clear();

  // Resting dots in grey, moving dots in the accent colour
  const moving = [];
  for (const dot of dots) {
    const offset = Math.abs(dot.x - dot.homeX) + Math.abs(dot.y - dot.homeY);
    if (offset > 3) moving.push(dot);
    else fieldLayer.rect(dot.x - 1, dot.y - 1, 2, 2);
  }
  fieldLayer.fill({ color: colours.muted, alpha: 0.4 });

  for (const dot of moving) fieldLayer.rect(dot.x - 1.5, dot.y - 1.5, 3, 3);
  fieldLayer.fill(colours.accent);
}

buildField();
window.addEventListener("resize", buildField);




// ---------- Frame loop ----------

app.ticker.add(() => {
  updateField(performance.now());
  drawField();
});

