'use strict';

const { query } = require('../config/db');

// ── Debounce map for heatmap recalculation ────────────────────────────────────
const recalcTimers = new Map();

function _scheduleHeatmapRecalc(resourceId, pageNumber) {
  const key = `${resourceId}:${pageNumber}`;
  if (recalcTimers.has(key)) clearTimeout(recalcTimers.get(key));
  const timer = setTimeout(async () => {
    recalcTimers.delete(key);
    try { await calculateAndStoreHeatmap(resourceId, pageNumber); }
    catch (e) { console.error('Heatmap recalc failed:', e.message); }
  }, 5000); // debounce 5s
  recalcTimers.set(key, timer);
}

// ── Core heatmap calculation algorithm ────────────────────────────────────────
// Grid size: 50×50 cells (normalized 0-1 coordinates)
const GRID_SIZE = 50;

async function calculateAndStoreHeatmap(resourceId, pageNumber) {
  const result = await query(
    `SELECT coordinates FROM highlights WHERE resource_id = $1 AND page_number = $2`,
    [resourceId, pageNumber]
  );

  if (result.rows.length === 0) {
    // Clear heatmap if no highlights
    await query(
      `INSERT INTO heatmap_data (resource_id, page_number, aggregated_zones, last_calculated)
       VALUES ($1, $2, '[]', NOW())
       ON CONFLICT (resource_id, page_number) DO UPDATE
       SET aggregated_zones = '[]', last_calculated = NOW()`,
      [resourceId, pageNumber]
    );
    return [];
  }

  // Build grid
  const grid = Array.from({ length: GRID_SIZE }, () => new Array(GRID_SIZE).fill(0));

  for (const row of result.rows) {
    const coords = row.coordinates;
    if (!coords) continue;
    const { x1, y1, x2, y2 } = coords;
    if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

    // Clamp to [0,1]
    const nx1 = Math.max(0, Math.min(1, x1));
    const ny1 = Math.max(0, Math.min(1, y1));
    const nx2 = Math.max(0, Math.min(1, x2));
    const ny2 = Math.max(0, Math.min(1, y2));

    // Map to grid cells
    const gx1 = Math.floor(nx1 * GRID_SIZE);
    const gy1 = Math.floor(ny1 * GRID_SIZE);
    const gx2 = Math.min(GRID_SIZE - 1, Math.floor(nx2 * GRID_SIZE));
    const gy2 = Math.min(GRID_SIZE - 1, Math.floor(ny2 * GRID_SIZE));

    for (let gy = gy1; gy <= gy2; gy++) {
      for (let gx = gx1; gx <= gx2; gx++) {
        grid[gy][gx]++;
      }
    }
  }

  // Apply 3×3 box blur for smoother gradients
  const blurred = _boxBlur(grid, GRID_SIZE);

  // Normalize to 0-100
  let maxVal = 0;
  for (let y = 0; y < GRID_SIZE; y++)
    for (let x = 0; x < GRID_SIZE; x++)
      maxVal = Math.max(maxVal, blurred[y][x]);

  // Build zones (only include cells with intensity > 0)
  const zones = [];
  const cellW = 1 / GRID_SIZE;
  const cellH = 1 / GRID_SIZE;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (blurred[y][x] === 0) continue;
      const intensity = maxVal > 0 ? Math.round((blurred[y][x] / maxVal) * 100) : 0;
      if (intensity < 2) continue; // Skip very low intensity
      zones.push({
        x: x * cellW,
        y: y * cellH,
        width: cellW,
        height: cellH,
        intensity,
      });
    }
  }

  await query(
    `INSERT INTO heatmap_data (resource_id, page_number, aggregated_zones, last_calculated)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (resource_id, page_number) DO UPDATE
     SET aggregated_zones = $3, last_calculated = NOW()`,
    [resourceId, pageNumber, JSON.stringify(zones)]
  );

  return zones;
}

// Simple 3×3 box blur
function _boxBlur(grid, size) {
  const out = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < size && nx >= 0 && nx < size) {
            sum += grid[ny][nx]; count++;
          }
        }
      }
      out[y][x] = sum / count;
    }
  }
  return out;
}

// ── GET /api/heatmap/:resourceId/:pageNumber ──────────────────────────────────
const getHeatmap = async (req, res) => {
  try {
    const { resourceId, pageNumber } = req.params;
    const page = parseInt(pageNumber);
    if (isNaN(page)) return res.status(400).json({ error: 'Invalid page number' });

    // Check cache staleness (recalculate if older than 30s)
    const cached = await query(
      `SELECT aggregated_zones, last_calculated FROM heatmap_data
       WHERE resource_id = $1 AND page_number = $2`,
      [resourceId, page]
    );

    if (cached.rows.length > 0) {
      const age = Date.now() - new Date(cached.rows[0].last_calculated).getTime();
      if (age < 30000) {
        // Also return highlight count for the page
        const countResult = await query(
          `SELECT COUNT(*) as count FROM highlights WHERE resource_id = $1 AND page_number = $2`,
          [resourceId, page]
        );
        return res.json({
          zones: cached.rows[0].aggregated_zones || [],
          highlightCount: parseInt(countResult.rows[0].count),
          cached: true,
        });
      }
    }

    // Recalculate
    const zones = await calculateAndStoreHeatmap(resourceId, page);
    const countResult = await query(
      `SELECT COUNT(*) as count FROM highlights WHERE resource_id = $1 AND page_number = $2`,
      [resourceId, page]
    );
    res.json({ zones, highlightCount: parseInt(countResult.rows[0].count), cached: false });
  } catch (err) {
    console.error('getHeatmap error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getHeatmap, calculateAndStoreHeatmap, _scheduleHeatmapRecalc };
