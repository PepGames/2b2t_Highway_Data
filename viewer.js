// viewer.js

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("tooltip");

let dataPoints = [];
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let theme = "dark";
let showGrid = false;

const MAP_LIMIT = 30000000;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

function screenToWorld(x, y) {
  return {
    x: (x - canvas.width / 2 - offsetX) / zoom,
    y: -(y - canvas.height / 2 - offsetY) / zoom
  };
}

function worldToScreen(x, y) {
  return {
    x: x * zoom + canvas.width / 2 + offsetX,
    y: -y * zoom + canvas.height / 2 + offsetY
  };
}

function getGridSpacing() {
  const pxPerBlock = zoom;
  if (pxPerBlock > 30) return 16;
  if (pxPerBlock > 15) return 64;
  if (pxPerBlock > 7) return 128;
  if (pxPerBlock > 3) return 256;
  if (pxPerBlock > 1.5) return 512;
  return 1024;
}

function drawGrid() {
  const spacing = getGridSpacing();
  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(canvas.width, canvas.height);

  const startX = Math.max(Math.floor(topLeft.x / spacing) * spacing, -MAP_LIMIT);
  const endX = Math.min(Math.ceil(bottomRight.x / spacing) * spacing, MAP_LIMIT);
  const startY = Math.max(Math.floor(bottomRight.y / spacing) * spacing, -MAP_LIMIT);
  const endY = Math.min(Math.ceil(topLeft.y / spacing) * spacing, MAP_LIMIT);

  const maxLines = 200;
  if ((endX - startX) / spacing > maxLines || (endY - startY) / spacing > maxLines) return;

  ctx.strokeStyle = theme === "dark" ? "#444" : "#ccc";
  ctx.lineWidth = 1;
  ctx.font = "12px sans-serif";
  ctx.fillStyle = theme === "dark" ? "#888" : "#555";
  ctx.textAlign = "left";

  const labelThreshold = 50; // px between labels

  // Vertical lines
  for (let x = startX; x <= endX; x += spacing) {
    const sx = worldToScreen(x, 0).x;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, canvas.height);
    ctx.stroke();
    if (spacing * zoom >= labelThreshold) {
      ctx.fillText(`X: ${x}`, sx + 2, 12);
    }
  }

  // Horizontal lines
  for (let y = startY; y <= endY; y += spacing) {
    const sy = worldToScreen(0, y).y;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(canvas.width, sy);
    ctx.stroke();
    if (spacing * zoom >= labelThreshold) {
      ctx.fillText(`Z: ${y}`, 2, sy - 4);
    }
  }

  // Draw map boundary box
  const bounds = [
    worldToScreen(-MAP_LIMIT, -MAP_LIMIT),
    worldToScreen(MAP_LIMIT, -MAP_LIMIT),
    worldToScreen(MAP_LIMIT, MAP_LIMIT),
    worldToScreen(-MAP_LIMIT, MAP_LIMIT)
  ];

  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bounds[0].x, bounds[0].y);
  for (let i = 1; i < bounds.length; i++) {
    ctx.lineTo(bounds[i].x, bounds[i].y);
  }
  ctx.closePath();
  ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = theme === "dark" ? "#222" : "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (showGrid) drawGrid();

  for (const point of dataPoints) {
    const screen = worldToScreen(point.X, point.Z);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = point.Type === "Chest" ? "#f00" : "#00f";
    ctx.fill();
  }
}

function showTooltip(x, y, content) {
  tooltip.innerText = content;
  tooltip.style.left = `${x + 10}px`;
  tooltip.style.top = `${y + 10}px`;
  tooltip.hidden = false;
}

function hideTooltip() {
  tooltip.hidden = true;
}

function checkHover(mouseX, mouseY) {
  const world = screenToWorld(mouseX, mouseY);
  for (const point of dataPoints) {
    const dx = world.x - point.X;
    const dy = world.y - point.Z;
    if (dx * dx + dy * dy < (6 / zoom) ** 2) {
      showTooltip(mouseX, mouseY, `Type: ${point.Type}\nX: ${point.X}\nY: ${point.Y}`);
      return;
    }
  }
  hideTooltip();
}

canvas.addEventListener("wheel", (e) => {
  const worldBefore = screenToWorld(e.clientX, e.clientY);
  zoom *= e.deltaY > 0 ? 0.9 : 1.1;
  const worldAfter = screenToWorld(e.clientX, e.clientY);
  offsetX += (worldAfter.x - worldBefore.x) * zoom;
  offsetY += (worldAfter.y - worldBefore.y) * zoom;
  draw();
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 2 || e.button === 1) {
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
  }
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
});

canvas.addEventListener("mousemove", (e) => {
  if (isDragging) {
    offsetX += e.clientX - dragStart.x;
    offsetY += e.clientY - dragStart.y;
    dragStart = { x: e.clientX, y: e.clientY };
    draw();
  } else {
    checkHover(e.clientX, e.clientY);
  }
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("resize", resizeCanvas);
document.getElementById("toggle-theme").addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", theme);
  draw();
});

document.getElementById("toggle-grid").addEventListener("click", () => {
  showGrid = !showGrid;
  draw();
});

Papa.parse("map.csv", {
  download: true,
  header: true,
  complete: (results) => {
    dataPoints = results.data.map((row) => ({
      X: parseFloat(row.X),
      Y: parseFloat(row.Y),
      Z: parseFloat(row.Z),
      Type: row.Type
    })).filter(p => !isNaN(p.X) && !isNaN(p.Z));
    resizeCanvas();
  }
});
