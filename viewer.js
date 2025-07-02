// viewer.js

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("tooltip");

let dataPoints = [];
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let theme = "dark";
let showGrid = true;
let mouseX = 0;
let mouseY = 0;
let hasInitialCentered = false;

const MAP_LIMIT = 30000000;
let zoom = 1;

const STYLE_STORAGE_KEY = "pointStyleSettings";
const UI_STORAGE_KEY = "uiPrefs";
const pointStyles = {};
const showDataFlags = {};

const loadedUIPrefs = JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || '{}');
if (loadedUIPrefs.theme) theme = loadedUIPrefs.theme;
if (typeof loadedUIPrefs.showGrid === 'boolean') showGrid = loadedUIPrefs.showGrid;
document.body.setAttribute("data-theme", theme);

const TYPE_LABELS = {
  signs: "Signs",
  echests: "Ender Chests",
  boats: "Boats",
  donkeys: "Donkeys",
  horses: "Horses",
  pigs: "Pigs",
  shulkers: "Shulkers",
  wolves: "Wolves",
  unknown: "Unknown"
};

const NORMALIZED_TYPES = {
  echest: "echests",
  "standing_sign": "signs",
  "wall_sign": "signs",
  "minecraft:boat": "boats",
  "minecraft:donkey": "donkeys",
  "minecraft:horse": "horses",
  "minecraft:pig": "pigs",
  "shulker box": "shulkers",
  "minecraft:wolf": "wolves"
};

const loadedStyles = localStorage.getItem(STYLE_STORAGE_KEY);
const parsedStyles = loadedStyles ? JSON.parse(loadedStyles) : {};

function getDefaultStyle(type) {
  const defaults = {
    boats:   { color: "#1f77b4", size: 4, shape: "circle" },
    donkeys: { color: "#ff7f0e", size: 4, shape: "square" },
    echests: { color: "#2ca02c", size: 4, shape: "triangle" },
    horses:  { color: "#d62728", size: 4, shape: "circle" },
    pigs:    { color: "#9467bd", size: 4, shape: "x" },
    shulkers:{ color: "#8c564b", size: 4, shape: "square" },
    signs:   { color: "#e377c2", size: 4, shape: "circle" },
    wolves:  { color: "#7f7f7f", size: 4, shape: "triangle" },
    unknown: { color: "#00f", size: 4, shape: "circle" }
  };
  return defaults[type] || defaults.unknown;
}

Object.keys(TYPE_LABELS).forEach(type => {
  const defaults = getDefaultStyle(type);
  pointStyles[type] = { ...defaults, ...(parsedStyles[type] || {}) };
  showDataFlags[type] = parsedStyles[type]?.show ?? true;
});


// 1. Add a floating popup element to the DOM
const savePopup = document.createElement("div");
savePopup.id = "save-popup";
savePopup.textContent = "Data Settings Saved";
savePopup.style.position = "fixed";
savePopup.style.top = "50%";
savePopup.style.left = "50%";
savePopup.style.transform = "translate(-50%, -50%)";
savePopup.style.backgroundColor = "#333";
savePopup.style.color = "white";
savePopup.style.padding = "10px 20px";
savePopup.style.borderRadius = "6px";
savePopup.style.fontSize = "18px";
savePopup.style.zIndex = "9999";
savePopup.style.opacity = "0";
savePopup.style.transition = "opacity 0.5s ease-in-out";
document.body.appendChild(savePopup);

function showSavePopup() {
  savePopup.style.opacity = "1";
  setTimeout(() => {
    savePopup.style.opacity = "0";
  }, 1500);
}

// 2. Update `saveStylesToLocalStorage` to also show the popup
function saveStylesToLocalStorage() {
  const toSave = {};
  for (const type in pointStyles) {
    toSave[type] = {
      ...pointStyles[type],
      show: showDataFlags[type] || false
    };
  }
  localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(toSave));
  localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ theme, showGrid }));
  showSavePopup();
}

function loadStylesFromLocalStorage() {/* no-op, already handled above */}

function resetStyles() {
  localStorage.removeItem(STYLE_STORAGE_KEY);
  localStorage.removeItem(UI_STORAGE_KEY);
  location.reload();
}

// Add save/reset buttons under sidebar control
function addSaveResetButtons() {
  const sidebar = document.getElementById("sidebar");
  const btnGroup = document.createElement("div");
  btnGroup.style.marginTop = "10px";
  btnGroup.style.display = "flex";
  btnGroup.style.gap = "8px";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.onclick = saveStylesToLocalStorage;

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset";
  resetBtn.onclick = resetStyles;

  btnGroup.appendChild(saveBtn);
  btnGroup.appendChild(resetBtn);
  sidebar.appendChild(btnGroup);
}

// Call these at init
loadStylesFromLocalStorage();
addSaveResetButtons();

function refreshDataForType(type) {
  const style = getPointStyle(type);
  const radiusInWorld = style.size / zoom;
  const tempSet = new Set();
  drawnPointsCache[type] = [];
  for (const point of dataPoints) {
    if (point.Type !== type) continue;
    const cacheKey = `${Math.round(point.X / radiusInWorld)},${Math.round(point.Z / radiusInWorld)}`;
    if (tempSet.has(cacheKey)) continue;
    tempSet.add(cacheKey);
    drawnPointsCache[type].push(point);
  }
}

function normalizeType(rawType) {
  return NORMALIZED_TYPES[rawType.toLowerCase()] || "unknown";
}

function getDefaultStyle(type) {
  const defaults = {
    boats:   { color: "#1f77b4", size: 4, shape: "circle" },
    donkeys: { color: "#ff7f0e", size: 4, shape: "square" },
    echests: { color: "#2ca02c", size: 4, shape: "triangle" },
    horses:  { color: "#d62728", size: 4, shape: "circle" },
    pigs:    { color: "#9467bd", size: 4, shape: "x" },
    shulkers:{ color: "#8c564b", size: 4, shape: "square" },
    signs:   { color: "#e377c2", size: 4, shape: "circle" },
    wolves:  { color: "#7f7f7f", size: 4, shape: "triangle" },
    unknown: { color: "#00f", size: 4, shape: "circle" }
  };
  return defaults[type] || defaults.unknown;
}

function getPointStyle(type) {
  return pointStyles[type] || getDefaultStyle(type);
}

function setupStyleControls(key) {
  const colorInput = document.getElementById(`color-${key}`);
  const sizeInput = document.getElementById(`size-${key}`);
  const shapeSelect = document.getElementById(`shape-${key}`);
  const showCheckbox = document.getElementById(`show-${key}`);

  const defaults = getPointStyle(key);
  if (colorInput) colorInput.value = defaults.color;
  if (sizeInput) sizeInput.value = defaults.size;
  if (shapeSelect) shapeSelect.value = defaults.shape;
  if (showCheckbox) showCheckbox.checked = !!showDataFlags[key];

  if (colorInput) {
    colorInput.addEventListener("input", () => {
      pointStyles[key].color = colorInput.value;
      invalidateDrawCache();
      draw();
    });
  }

  if (sizeInput) {
    sizeInput.addEventListener("input", () => {
      pointStyles[key].size = parseInt(sizeInput.value, 10) || 4;
      invalidateDrawCache();
      draw();
    });
  }

  if (shapeSelect) {
    shapeSelect.addEventListener("change", () => {
      pointStyles[key].shape = shapeSelect.value;
      invalidateDrawCache();
      draw();
    });
  }

  if (showCheckbox) {
  showCheckbox.addEventListener("change", () => {
    showDataFlags[key] = showCheckbox.checked;
    if (showCheckbox.checked) {
      refreshDataForType(key);
    } else {
      drawnPointsCache[key] = [];
    }
    draw();
  });
}
}

function invalidateDrawCache() {
  drawnPointsZoomLevel = null;
}


function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
  drawMouseCoordinates();
}

function centerView() {
  zoom = canvas.height / (MAP_LIMIT * 2);
  offsetX = 0;
  offsetY = 0;
  draw();
}

function screenToWorld(x, y) {
  return {
    x: (x - canvas.width / 2 - offsetX) / zoom,
    y: (y - canvas.height / 2 - offsetY) / zoom
  };
}

function worldToScreen(x, y) {
  return {
    x: x * zoom + canvas.width / 2 + offsetX,
    y: y * zoom + canvas.height / 2 + offsetY
  };
}

function getGridSpacing() {
  const screenSize = Math.max(canvas.width, canvas.height);
  const worldSpan = screenSize / zoom;
  const exponent = Math.floor(Math.log10(worldSpan / 10));
  return Math.pow(10, exponent);
}

function drawGrid() {
  const spacing = getGridSpacing();
  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(canvas.width, canvas.height);

  const startX = Math.max(Math.floor(topLeft.x / spacing) * spacing, -MAP_LIMIT);
  const endX = Math.min(Math.ceil(bottomRight.x / spacing) * spacing, MAP_LIMIT);
  const startY = Math.max(Math.floor(topLeft.y / spacing) * spacing, -MAP_LIMIT);
  const endY = Math.min(Math.ceil(bottomRight.y / spacing) * spacing, MAP_LIMIT);

  ctx.strokeStyle = theme === "dark" ? "#444" : "#ccc";
  ctx.lineWidth = 1;
  ctx.font = "12px sans-serif";
  ctx.fillStyle = theme === "dark" ? "#888" : "#555";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const MIN_LABEL_SPACING = ctx.measureText("X: -30000000").width + 10;
  let lastLabelX = -Infinity;

  for (let x = startX; x <= endX; x += spacing) {
    const sx = worldToScreen(x, 0).x;
    if (sx >= 0 && sx <= canvas.width) {
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, canvas.height);
      ctx.stroke();
      if (sx - lastLabelX >= MIN_LABEL_SPACING) {
        ctx.fillText(`X: ${x}`, sx, 2);
        lastLabelX = sx;
      }
    }
  }

  ctx.textAlign = "left";
  const MIN_Y_LABEL_SPACING = 16;
  let lastLabelY = -Infinity;

  for (let y = startY; y <= endY; y += spacing) {
    const sy = worldToScreen(0, y).y;
    if (sy >= 0 && sy <= canvas.height) {
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(canvas.width, sy);
      ctx.stroke();
      if (sy - lastLabelY >= MIN_Y_LABEL_SPACING) {
        ctx.fillText(`Z: ${y}`, 2, sy + 2);
        lastLabelY = sy;
      }
    }
  }

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

let drawnPointsCache = {};
let drawnPointsZoomLevel = null;

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = theme === "dark" ? "#222" : "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (showGrid) drawGrid();

  const zoomLevel = zoom.toFixed(5); // high precision for stability
  if (drawnPointsZoomLevel !== zoomLevel) {
    drawnPointsCache = {};
    drawnPointsZoomLevel = zoomLevel;

    const tempCache = {};

    for (const point of dataPoints) {
      if (!showDataFlags[point.Type]) continue; // <-- add this line to respect Show Data checkbox

      const style = getPointStyle(point.Type);
      const radiusInWorld = style.size / zoom;
      const key = `${Math.round(point.X / radiusInWorld)},${Math.round(point.Z / radiusInWorld)}`;

      if (!tempCache[point.Type]) tempCache[point.Type] = new Set();
      if (tempCache[point.Type].has(key)) continue;

      tempCache[point.Type].add(key);
      if (!drawnPointsCache[point.Type]) drawnPointsCache[point.Type] = [];
      drawnPointsCache[point.Type].push(point);
    }
  }

  for (const type in drawnPointsCache) {
    for (const point of drawnPointsCache[type]) {
      const screen = worldToScreen(point.X, point.Z);
      const style = getPointStyle(point.Type);

      if (
        screen.x + style.size < 0 || screen.x - style.size > canvas.width ||
        screen.y + style.size < 0 || screen.y - style.size > canvas.height
      ) continue;

      ctx.beginPath();
      switch (style.shape) {
        case 'square':
          ctx.rect(screen.x - style.size / 2, screen.y - style.size / 2, style.size, style.size);
          break;
        case 'triangle':
          ctx.moveTo(screen.x, screen.y - style.size);
          ctx.lineTo(screen.x - style.size, screen.y + style.size);
          ctx.lineTo(screen.x + style.size, screen.y + style.size);
          ctx.closePath();
          break;
        case 'x':
          ctx.moveTo(screen.x - style.size, screen.y - style.size);
          ctx.lineTo(screen.x + style.size, screen.y + style.size);
          ctx.moveTo(screen.x + style.size, screen.y - style.size);
          ctx.lineTo(screen.x - style.size, screen.y + style.size);
          break;
        default:
          ctx.arc(screen.x, screen.y, style.size, 0, Math.PI * 2);
      }
      ctx.strokeStyle = style.shape === 'x' ? style.color : 'transparent';
      ctx.fillStyle = style.color;
      if (style.shape === 'x') ctx.stroke(); else ctx.fill();
    }
  }

  drawMouseCoordinates();
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
  for (const type in drawnPointsCache) {
    if (!showDataFlags[type]) continue;
    const style = getPointStyle(type);
    const hitRadius = (style.size * 1.25) / zoom;
    for (const point of drawnPointsCache[type]) {
      const dx = world.x - point.X;
      const dy = world.y - point.Z;
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        showTooltip(mouseX, mouseY, `Type: ${point.OriginalType || point.Type}\nX: ${point.X}\nY: ${point.Y}\nZ: ${point.Z}`);
        return;
      }
    }
  }
  hideTooltip();
}

window.addEventListener("wheel", (e) => {
  // Block zoom if hovering over sidebar or any top UI
  const hoveredEl = document.elementFromPoint(e.clientX, e.clientY);
  if (hoveredEl && hoveredEl.closest("#sidebar, #toggle-theme, #toggle-grid, #center-view")) {
    return;
  }

  e.preventDefault();

  const mouseX = e.clientX;
  const mouseY = e.clientY;

  const worldX = (mouseX - canvas.width / 2 - offsetX) / zoom;
  const worldY = (mouseY - canvas.height / 2 - offsetY) / zoom;

  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = zoom * zoomFactor;
  const maxZoomOut = canvas.height / (2 * MAP_LIMIT);
  zoom = Math.max(maxZoomOut, Math.min(newZoom, 100));

  offsetX = mouseX - canvas.width / 2 - worldX * zoom;
  offsetY = mouseY - canvas.height / 2 - worldY * zoom;

  draw();
}, { passive: false });



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
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (isDragging) {
    offsetX += e.clientX - dragStart.x;
    offsetY += e.clientY - dragStart.y;
    dragStart = { x: e.clientX, y: e.clientY };
  } else {
    checkHover(e.clientX, e.clientY);
  }
  draw();
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  resizeCanvas();
});

document.getElementById("toggle-theme").addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", theme);
  draw();
});

document.getElementById("toggle-grid").addEventListener("click", () => {
  showGrid = !showGrid;
  draw();
});


document.getElementById("center-view").addEventListener("click", () => {
  centerView();
});

function drawMouseCoordinates() {
  const world = screenToWorld(mouseX, mouseY);
  const coordBox = document.getElementById("coord-box");
  if (coordBox) {
    coordBox.innerText = `X: ${world.x.toFixed(0)}  Z: ${world.y.toFixed(0)}`;
  }
}

Papa.parse("map.csv", {
  download: true,
  header: true,
  complete: (results) => {
    dataPoints = results.data.map((row) => {
      const rawType = row.Type;
      const normType = normalizeType(rawType);
      return {
        X: parseFloat(row.X),
        Y: parseFloat(row.Y),
        Z: parseFloat(row.Z),
        Type: normType,
        OriginalType: rawType
      };
    }).filter(p => !isNaN(p.X) && !isNaN(p.Z));

    Object.keys(TYPE_LABELS).forEach(setupStyleControls);
    resizeCanvas();
    draw();

    if (!hasInitialCentered) {
      centerView();
      hasInitialCentered = true;
    }
  }
});

