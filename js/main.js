
// setup
// Här startas PixiJS och canvasen skapas
// Skapar en ny PixiJS-applikation (själva "ritytan")
const app = new PIXI.Application();
await app.init({
  // canvasen anpassar sig till fönstrets storlek
  resizeTo: window,
  // transparent (genomskinlig bakgrund så att sidans färg syns igenom)         
  backgroundAlpha: 0,
  // gör kanter mjukare         
  antialias: true,
  // anpassar css storleken
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
});
// Lägger in canvasen i div:en med id="stage" i HTML-filen
document.getElementById("stage").appendChild(app.canvas);


// Ett lager (Graphics) som punkterna ritas på
const fieldLayer = new PIXI.Graphics();
app.stage.addChild(fieldLayer);



// färger

// Ett objekt där färgerna sparas
const colours = {};

// Läser färgerna "muted" och "accent" från CSS (--muted och --accent)
function readColours() {
  const css = getComputedStyle(document.documentElement);
  for (const name of ["muted", "accent"]) {
    // Gör om CSS-färgen till ett nummer som PixiJS förstår
    colours[name] = new PIXI.Color(css.getPropertyValue(`--${name}`).trim()).toNumber();
  }
}

// Läser färgerna direkt när sidan laddas
readColours();
// Läser dem igen om besökaren byter mellan ljust och mörkt läge
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColours);


// input
// Här lyssnar koden på musen/fingret

// Var pekaren är just nu. Startar långt utanför skärmen så att inget knuffas i början
const pointer = { x: -9999, y: -9999 };
// ett klick = en våg med position och starttid
const ripples = [];

// När musen rör sig: sparas den nya positionen
window.addEventListener("pointermove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

// När man klickar: skapas en ny våg där man klickade
window.addEventListener("pointerdown", (e) => {
  ripples.push({ x: e.clientX, y: e.clientY, born: performance.now() });
});



// punkter
// avstånd mellan prickarna (px)
const SPACING = 28;
// hur nära pekaren en prick måste vara för att knuffas (px)         
const PUSH_RADIUS = 150;
// pixels per second (hur snabbt vågen växer)   
const RIPPLE_SPEED = 500;
// milliseconds (hur länge en våg lever)  
const RIPPLE_LIFE = 2000;

// Lista med alla prickar
let dots = [];

// Skapar ett rutnät av prickar som fyller hela fönstret
function buildField() {
  dots = [];
  for (let x = SPACING / 2; x < window.innerWidth; x += SPACING) {
    for (let y = SPACING / 2; y < window.innerHeight; y += SPACING) {
      // homeX/homeY = hemposition, x/y = nuvarande position, vx/vy = hastighet
      dots.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0 });
    }
  }
}

// Knuffar en prick bort från en punkt, hårdare ju närmare den är
function pushAway(dot, fromX, fromY, radius, strength) {
  // Avstånd i x- och y-led från punkten till pricken
  const dx = dot.x - fromX;
  const dy = dot.y - fromY;
  // Det riktiga avståndet (|| 1 gör att vi aldrig delar med noll)
  const distance = Math.hypot(dx, dy) || 1;
  // Bara pricken inom radien påverkas
  if (distance < radius) {
    // Kraften är störst nära punkten och 0 vid kanten av radien
    const force = (1 - distance / radius) * strength;
    // Ändrar hastigheten bort från punkten
    dot.vx += (dx / distance) * force;
    dot.vy += (dy / distance) * force;
  }
}

// Uppdaterar alla prickar (körs varje bildruta). "now" är aktuell tid i millisekunder
function updateField(now) {
  // Tar bort vågor som är äldre än RIPPLE_LIFE
  while (ripples.length && now - ripples[0].born > RIPPLE_LIFE) ripples.shift();

  for (const dot of dots) {
    // Knuffa pricken bort från pekaren
    pushAway(dot, pointer.x, pointer.y, PUSH_RADIUS, 1.2);


    // En våg är en ring som växer. Bara prickar nära ringen knuffas
    for (const ripple of ripples) {
      const age = now - ripple.born;
      const ringRadius = (age / 1000) * RIPPLE_SPEED;
      // Hur långt pricken är från själva ringen
      const fromRing = Math.abs(Math.hypot(dot.x - ripple.x, dot.y - ripple.y) - ringRadius);
      // Om pricken är inom 20 px från ringen: knuffa den. Kraften blir svagare ju äldre vågen är
      if (fromRing < 20) pushAway(dot, ripple.x, ripple.y, ringRadius + 20, 3 * (1 - age / RIPPLE_LIFE));
    }


    // Fjäder som drar pricken hem (0.06), och friktion (0.82) så att den stannar till slut
    dot.vx = (dot.vx + (dot.homeX - dot.x) * 0.06) * 0.82;
    dot.vy = (dot.vy + (dot.homeY - dot.y) * 0.06) * 0.82;
    // Flyttar pricken enligt hastigheten
    dot.x += dot.vx;
    dot.y += dot.vy;
  }
}

// Ritar alla prickar (körs varje bildruta)
function drawField() {
  // Rensar förra bildrutans ritning
  fieldLayer.clear();

  // Prickar som vilar ritas grå, prickar som rör sig ritas i accentfärgen
  const moving = [];
  for (const dot of dots) {
    // Hur långt pricken är från sin hemposition
    const offset = Math.abs(dot.x - dot.homeX) + Math.abs(dot.y - dot.homeY);
    // Mer än 3 px bort = den rör sig, annars ritas den som en liten grå ruta (2x2 px)
    if (offset > 3) moving.push(dot);
    else fieldLayer.rect(dot.x - 1, dot.y - 1, 2, 2);
  }
  // Fyller alla vilande rutor med "muted"-färgen, 40 % synlig
  fieldLayer.fill({ color: colours.muted, alpha: 0.4 });

  // De rörliga prickarna ritas lite större (3x3 px) i accentfärgen
  for (const dot of moving) fieldLayer.rect(dot.x - 1.5, dot.y - 1.5, 3, 3);
  fieldLayer.fill(colours.accent);
}

// Bygger rutnätet direkt när sidan laddas
buildField();
// Bygger om rutnätet om fönstret ändrar storlek
window.addEventListener("resize", buildField);




// frame loop

app.ticker.add(() => {
  updateField(performance.now()); // räkna ut nya positioner
  drawField();                    // rita dem
});