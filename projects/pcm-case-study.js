/*
 * PCM Map Generator — case-study interactions.
 *
 * Every lab on the page re-implements the real algorithm rather than faking a
 * result, so the numbers on screen are the numbers the Python solver produces:
 *   · decomposeSamples()  mirrors decompose_samples()
 *   · scoreCandidate()    mirrors _score_candidate()
 *   · solve()             mirrors place_periodic() / _backtrack()
 */
(() => {
  'use strict';

  const IRIG = {
    MAX_WORDS_PER_MINOR_FRAME: 1024,
    MAX_BITS_PER_MINOR_FRAME: 8192,
    MAX_MINOR_FRAMES_PER_MAJOR: 256,
    MIN_MINOR_FRAMES_PER_MAJOR: 4,
    MIN_WORD_BITS: 4,
    MAX_WORD_BITS: 32,
    MIN_BIT_RATE_BPS: 10,
    MAX_BIT_RATE_BPS: 10_000_000,
    OVERHEAD_WORDS: 3,
  };
  const SPEC_COLORS = ['var(--pcm-s0)', 'var(--pcm-s1)', 'var(--pcm-s2)', 'var(--pcm-s3)', 'var(--pcm-s4)', 'var(--pcm-s5)'];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const fmt = (value, digits = 2) => Number(value).toFixed(digits);
  const commas = (value) => Math.round(value).toLocaleString('en-US');

  /* ------------------------------------------------------------------ *
   * A reusable major-frame grid: rows are minor frames, columns words.
   * ------------------------------------------------------------------ */
  function makeGrid(mount, options) {
    const { rows, cols, gutterX = 30, gutterY = 18, rowStep = 1, colStep = 1, fit } = options;
    let cell = options.cell;
    let gap, pitch;
    if (fit) {
      /* Fixed stage: the figure keeps one size at every setting and the cells
         resize inside it. Without this, dragging M from 4 to 24 triples the
         SVG's aspect ratio and the whole page jumps under the cursor. */
      pitch = Math.min(fit.maxPitch || 30, (fit.width - gutterX - 6) / cols, (fit.height - gutterY - 6) / rows);
      gap = pitch > 15 ? 2 : 1;
      cell = Math.max(2, pitch - gap);
    } else {
      gap = cell > 13 ? 2 : 1;
      pitch = cell + gap;
    }
    const width = fit ? fit.width : gutterX + cols * pitch;
    const height = fit ? fit.height : gutterY + rows * pitch;
    const originX = fit ? gutterX + Math.max(0, (width - gutterX - 6 - cols * pitch) / 2) : gutterX;
    const originY = fit ? gutterY + Math.max(0, (height - gutterY - 6 - rows * pitch) / 2) : gutterY;
    const svg = el('svg', {
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': options.label || `${rows} by ${cols} PCM grid`,
    });
    const rects = [];
    const labels = [];

    for (let c = 0; c < cols; c += colStep) {
      if (cols > 40 ? c % (colStep * 4) !== 0 : cols > 24 && c % (colStep * 2) !== 0) continue;
      const tick = el('text', { x: originX + c * pitch + cell / 2, y: originY - 6, class: 'pcm-axis-text', 'text-anchor': 'middle' });
      tick.textContent = String(c);
      svg.append(tick);
    }
    for (let r = 0; r < rows; r += rowStep) {
      if (rows > 24 && r % (rowStep * 2) !== 0) continue;
      const tick = el('text', { x: originX - 7, y: originY + r * pitch + cell / 2, class: 'pcm-axis-text', 'text-anchor': 'end', 'dominant-baseline': 'central' });
      tick.textContent = String(r);
      svg.append(tick);
    }

    for (let r = 0; r < rows; r++) {
      rects[r] = [];
      labels[r] = [];
      for (let c = 0; c < cols; c++) {
        const rect = el('rect', {
          x: originX + c * pitch, y: originY + r * pitch,
          width: cell, height: cell, rx: cell > 12 ? 2.5 : 1.5,
          fill: 'var(--pcm-empty)', class: 'pcm-cell',
        });
        svg.append(rect);
        rects[r][c] = rect;
      }
    }
    const overlay = el('g');
    svg.append(overlay);
    mount.replaceChildren(svg);

    return {
      svg, rows, cols, pitch, cell, gutterX: originX, gutterY: originY,
      reset() {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          rects[r][c].setAttribute('fill', 'var(--pcm-empty)');
          rects[r][c].removeAttribute('opacity');
          if (labels[r][c]) { labels[r][c].remove(); labels[r][c] = null; }
        }
        overlay.replaceChildren();
      },
      paint(r, c, fill, opacity) {
        const rect = rects[r]?.[c];
        if (!rect) return;
        rect.setAttribute('fill', fill);
        if (opacity === undefined) rect.removeAttribute('opacity');
        else rect.setAttribute('opacity', opacity);
      },
      label(r, c, text) {
        if (cell < 11 || !text) return;
        let node = labels[r][c];
        if (!node) {
          node = el('text', {
            x: originX + c * pitch + cell / 2,
            y: originY + r * pitch + cell / 2,
            class: 'pcm-cell-text',
          });
          svg.insertBefore(node, overlay);
          labels[r][c] = node;
        }
        node.textContent = text;
      },
      outline(cells, className = 'pcm-trial') {
        overlay.replaceChildren();
        for (const [r, c] of cells) {
          if (r >= rows || c >= cols) continue;
          overlay.append(el('rect', {
            x: originX + c * pitch - 1.5, y: originY + r * pitch - 1.5,
            width: cell + 3, height: cell + 3, rx: 3, class: className,
          }));
        }
      },
      clearOutline() { overlay.replaceChildren(); },
    };
  }

  const overheadCols = (cols) => new Set([0, cols - 2, cols - 1]);
  function paintOverhead(grid) {
    const reserved = overheadCols(grid.cols);
    for (let r = 0; r < grid.rows; r++) {
      grid.paint(r, 0, 'var(--pcm-sfid)');
      grid.label(r, 0, 'SF');
      grid.paint(r, grid.cols - 2, 'var(--pcm-sync)');
      grid.label(r, grid.cols - 2, 'F1');
      grid.paint(r, grid.cols - 1, 'var(--pcm-sync)');
      grid.label(r, grid.cols - 1, 'F2');
    }
    return reserved;
  }
  const cellSizeFor = (cols) => (cols > 64 ? 8 : cols > 40 ? 11 : cols > 24 ? 15 : cols > 16 ? 19 : 24);
  /* Each dimensioning lab draws into a stage of fixed size, shaped roughly
     like the grids it can produce: lab 01 reaches W = 48 and is usually
     width-bound, lab 02 stops at W = 32 and needs the extra height. */
  const FRAME_STAGE = { width: 620, height: 360, maxPitch: 30 };
  const COMM_STAGE = { width: 620, height: 460, maxPitch: 34 };

  /* ------------------------------------------------------------------ *
   * Hero: a representative major frame — colour is one measurement group.
   * ------------------------------------------------------------------ */
  (function heroFrame() {
    const mount = document.getElementById('hero-frame');
    if (!mount) return;
    const rows = 8;
    const cols = 32;
    const grid = makeGrid(mount, { rows, cols, cell: 16, label: 'A major frame of 8 minor frames by 32 words, with sub-frame ID and frame-sync overhead columns' });
    paintOverhead(grid);
    // A representative allocation: two super-commutated groups, a bus block, sub-comm analogs.
    const plan = [
      { color: SPEC_COLORS[0], rowsUsed: 8, rowPeriod: 1, spm: 4, width: 1, rowOff: 0, colOff: 1 },
      { color: SPEC_COLORS[1], rowsUsed: 8, rowPeriod: 1, spm: 2, width: 1, rowOff: 0, colOff: 2 },
      { color: SPEC_COLORS[2], rowsUsed: 8, rowPeriod: 1, spm: 1, width: 3, rowOff: 0, colOff: 3 },
      { color: SPEC_COLORS[3], rowsUsed: 4, rowPeriod: 2, spm: 1, width: 2, rowOff: 0, colOff: 6 },
      { color: SPEC_COLORS[4], rowsUsed: 2, rowPeriod: 4, spm: 1, width: 1, rowOff: 1, colOff: 8 },
      { color: SPEC_COLORS[5], rowsUsed: 8, rowPeriod: 1, spm: 2, width: 1, rowOff: 0, colOff: 9 },
    ];
    const reserved = overheadCols(cols);
    for (const spec of plan) {
      const colPeriod = spec.spm > 1 ? cols / spec.spm : cols;
      for (let k = 0; k < spec.rowsUsed; k++) {
        const r = spec.rowOff + k * spec.rowPeriod;
        for (let j = 0; j < spec.spm; j++) {
          for (let b = 0; b < spec.width; b++) {
            const c = spec.colOff + j * colPeriod + b;
            if (c >= cols || reserved.has(c)) continue;
            grid.paint(r, c, spec.color);
          }
        }
      }
    }
  })();

  /* ------------------------------------------------------------------ *
   * Serialisation figure — the grid is only a drawing; the wire is 1-D.
   * A read head walks the major frame left to right, row by row. Every
   * word it touches drops into the serial stream and is clocked out as
   * NRZ-L bits: SFID carries the minor-frame number, FS1/FS2 carry the
   * 0xFAF320 sync pattern, so the stream visibly repeats once per row.
   * ------------------------------------------------------------------ */
  (function serialStream() {
    const mount = document.getElementById('frame-ribbon');
    if (!mount) return;

    const COLS = [
      { label: 'SFID', kind: 'sfid' },
      { label: 'WD1', kind: 'data' },
      { label: 'WD2', kind: 'data' },
      { label: 'WD3', kind: 'data' },
      { label: 'WD4', kind: 'data' },
      { label: 'WD5', kind: 'data' },
      { label: '⋯', kind: 'gap' },
      { label: 'WD n', kind: 'data' },
      { label: 'FS1', kind: 'sync' },
      { label: 'FS2', kind: 'sync' },
    ];
    const NC = COLS.length;
    const ROWS = 4;
    const BITS = 12;
    const SYNC = [0xfaf, 0x320]; // the real IRIG-106 24-bit pattern, split

    /* Geometry. Grid columns and stream slots share one pitch so a word
       keeps its width — and therefore its identity — on the way out. */
    const cellW = 70, pitch = 74, cellH = 34, rowPitch = 38;
    const gridLeft = 100, gridTop = 50;
    const gridRight = gridLeft + NC * pitch;        // 840
    const gridBottom = gridTop + ROWS * rowPitch;   // 202
    const anchorX = gridRight - cellW;              // newest slot's left edge
    const laneY = 288;
    const waveHi = 356, waveLo = 392, waveMid = (waveHi + waveLo) / 2;
    const headX = gridRight + 2;                    // the wire head: bits leave here
    const clipL = 96, clipR = 884;
    const VW = 980, VH = 428;
    const STEP_MS = 480;
    const POOL = Math.ceil((clipR - clipL) / pitch) + 3;

    const fillFor = (c) => {
      const kind = COLS[c].kind;
      if (kind === 'sfid') return 'var(--pcm-sfid)';
      if (kind === 'sync') return 'var(--pcm-sync)';
      if (kind === 'gap') return 'none';
      return SPEC_COLORS[c % SPEC_COLORS.length];
    };
    const bitsFor = (row, col) => {
      const kind = COLS[col].kind;
      if (kind === 'gap') return null;
      let value;
      if (kind === 'sfid') value = row;
      else if (col === NC - 2) value = SYNC[0];
      else if (col === NC - 1) value = SYNC[1];
      else {
        let h = Math.imul(row + 1, 73856093) ^ Math.imul(col + 7, 19349663);
        h ^= h >>> 13;
        value = (h >>> 0) % 4096;
      }
      const out = [];
      for (let k = BITS - 1; k >= 0; k--) out.push((value >> k) & 1);
      return out;
    };
    const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

    const svg = el('svg', {
      viewBox: `0 0 ${VW} ${VH}`,
      role: 'img',
      'aria-label': 'The major frame is read out one word at a time, left to right along each minor frame and then down to the next, producing a single serial PCM bit stream in which every word appears in that same order.',
    });

    const defs = el('defs');
    const clip = el('clipPath', { id: 'pcm-stream-clip' });
    clip.append(el('rect', { x: clipL, y: laneY - 24, width: clipR - clipL, height: waveLo + 16 - (laneY - 24) }));
    const fade = el('linearGradient', { id: 'pcm-stream-fade', x1: clipL, x2: clipR, y1: 0, y2: 0, gradientUnits: 'userSpaceOnUse' });
    fade.append(
      el('stop', { offset: '0', 'stop-color': '#000' }),
      el('stop', { offset: '0.055', 'stop-color': '#fff' }),
      el('stop', { offset: '1', 'stop-color': '#fff' }),
    );
    const mask = el('mask', { id: 'pcm-stream-mask', maskUnits: 'userSpaceOnUse' });
    mask.append(el('rect', { x: clipL, y: laneY - 24, width: clipR - clipL, height: waveLo + 16 - (laneY - 24), fill: 'url(#pcm-stream-fade)' }));
    defs.append(clip, fade, mask);
    svg.append(defs);

    const text = (attrs, content) => {
      const node = el('text', attrs);
      node.textContent = content;
      return node;
    };

    /* ---- Title ---- */

    /* ---- The grid, unchanged in meaning: rows are minor frames ---- */
    for (let r = 0; r < ROWS; r++) {
      const y = gridTop + r * rowPitch;
      for (let c = 0; c < NC; c++) {
        const x = gridLeft + c * pitch;
        const gap = COLS[c].kind === 'gap';
        svg.append(el('rect', {
          x, y, width: cellW, height: cellH, rx: 4,
          fill: gap ? 'none' : fillFor(c),
          stroke: gap ? 'var(--border)' : 'none',
          'stroke-dasharray': gap ? '3 3' : 'none',
          opacity: gap ? 1 : 0.9,
          class: gap ? '' : 'pcm-cell',
        }));
        svg.append(text({
          x: x + cellW / 2, y: y + cellH / 2, class: 'pcm-cell-text',
          style: gap ? 'fill: var(--muted)' : '',
        }, COLS[c].kind === 'sfid' ? String(r) : COLS[c].label));
      }
      svg.append(text({ x: gridLeft - 14, y: y + cellH / 2, class: 'pcm-axis-text', 'text-anchor': 'end', 'dominant-baseline': 'central' }, `minor ${r}`));
    }

    /* ---- Brackets: what the columns are, what the rows are ---- */
    const brace = (x1, x2, y, label) => {
      svg.append(el('path', { d: `M${x1} ${y - 6} L${x1} ${y} L${x2} ${y} L${x2} ${y - 6}`, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1 }));
      svg.append(text({ x: (x1 + x2) / 2, y: y + 15, class: 'pcm-axis-title', 'text-anchor': 'middle' }, label));
    };
    brace(gridLeft, gridLeft + cellW, gridBottom + 8, 'SFID · W0');
    brace(gridLeft + pitch, gridLeft + 7 * pitch + cellW, gridBottom + 8, 'Measurement words · W−3 available');
    brace(gridLeft + 8 * pitch, gridRight - 4, gridBottom + 8, 'FS1 · FS2 · W−2, W−1');
    const braceX = 30;
    const midY = gridTop + (gridBottom - gridTop) / 2;
    svg.append(el('path', { d: `M${braceX + 8} ${gridTop} L${braceX} ${gridTop} L${braceX} ${gridBottom - 4} L${braceX + 8} ${gridBottom - 4}`, fill: 'none', stroke: 'var(--muted)' }));
    svg.append(text({ x: 15, y: midY, class: 'pcm-axis-title', 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: `rotate(-90 15 ${midY})` }, 'Major frame'));

    /* ---- Read head + the tether that drops a word onto the wire ---- */
    const tether = el('path', { class: 'pcm-tether', fill: 'none' });
    svg.append(tether);
    const head = el('rect', { width: cellW + 6, height: cellH + 6, rx: 6, class: 'pcm-readhead' });
    svg.append(head);

    /* ---- Lane heading ---- */
    svg.append(text({ x: gridLeft, y: laneY - 34, class: 'pcm-axis-title' }, 'Serial PCM stream — one word after another, forever'));
    svg.append(text({ x: headX + 8, y: laneY + cellH / 2, class: 'pcm-axis-title pcm-wire-label', 'dominant-baseline': 'central' }, 'Out'));
    svg.append(el('path', { d: `M${headX} ${laneY - 22} L${headX} ${waveLo + 12}`, class: 'pcm-wire-head' }));

    /* ---- The moving parts, clipped to the lane ---- */
    const stream = el('g', { 'clip-path': 'url(#pcm-stream-clip)', mask: 'url(#pcm-stream-mask)' });
    svg.append(stream);

    const marks = el('g');
    stream.append(marks);
    const markPool = [];
    for (let i = 0; i < 4; i++) {
      const line = el('path', { class: 'pcm-frame-mark', d: '' });
      const label = el('text', { class: 'pcm-axis-text pcm-frame-mark-label', 'text-anchor': 'start' });
      marks.append(line, label);
      markPool.push({ line, label });
    }

    const chips = [];
    for (let i = 0; i < POOL; i++) {
      const rect = el('rect', { width: cellW, height: cellH, rx: 4, class: 'pcm-cell' });
      const label = el('text', { class: 'pcm-cell-text' });
      stream.append(rect, label);
      chips.push({ rect, label });
    }
    /* chips[0] is always the word in flight: lift it out of the clip so the
       trip from cell to wire is visible the whole way down. */
    const flight = el('g');
    flight.append(chips[0].rect, chips[0].label);

    const wave = el('path', { class: 'pcm-wave', fill: 'none' });
    const waveGap = el('path', { class: 'pcm-wave is-gap', fill: 'none' });
    stream.append(waveGap, wave);
    const clockDot = el('circle', { r: 3.2, class: 'pcm-clock-dot' });
    svg.append(flight, clockDot);

    svg.append(el('path', { d: `M${clipL} ${waveMid} L${clipR} ${waveMid}`, class: 'pcm-wave-axis' }));
    svg.append(text({ x: gridLeft, y: waveHi - 12, class: 'pcm-axis-title' }, `NRZ-L · ${BITS} bits per word`));
    svg.append(text({ x: gridLeft - 14, y: waveHi, class: 'pcm-axis-text', 'text-anchor': 'end', 'dominant-baseline': 'central' }, '1'));
    svg.append(text({ x: gridLeft - 14, y: waveLo, class: 'pcm-axis-text', 'text-anchor': 'end', 'dominant-baseline': 'central' }, '0'));

    const caption = el('text', { x: gridLeft, y: VH - 8, class: 'pcm-axis-text pcm-stream-caption' });
    const captionText = el('tspan');
    const captionBits = el('tspan', { class: 'pcm-bits' });
    caption.append(captionText, captionBits);
    svg.append(caption);

    /* ---- Animation ---- */
    let step = 0;   // index of the word being read out right now
    let frac = 0;   // 0…1 progress through that word
    let raf = 0;
    let last = 0;
    let playing = false;

    const slotX = (g, e) => anchorX - (step - 1 - g + e) * pitch;

    function render() {
      const e = easeInOut(frac);
      const col = step % NC;
      const row = Math.floor(step / NC) % ROWS;
      const cellX = gridLeft + col * pitch;
      const cellY = gridTop + row * rowPitch;

      head.setAttribute('x', cellX - 3);
      head.setAttribute('y', cellY - 3);

      /* Chips: every landed word sits in its slot; the current word flies
         out of its cell into the slot that is opening up at the wire. */
      const target = slotX(step, e);
      const flyX = cellX + (target - cellX) * e;
      const flyY = cellY + (laneY - cellY) * e;
      tether.setAttribute('d', `M${cellX + cellW / 2} ${cellY + cellH} Q${cellX + cellW / 2} ${(cellY + laneY) / 2} ${flyX + cellW / 2} ${flyY}`);

      for (let i = 0; i < POOL; i++) {
        const g = step - i;
        const chip = chips[i];
        if (g < 0) { chip.rect.setAttribute('opacity', 0); chip.label.setAttribute('opacity', 0); continue; }
        const c = g % NC;
        const r = Math.floor(g / NC) % ROWS;
        const x = g === step ? flyX : slotX(g, e);
        const y = g === step ? flyY : laneY;
        const gap = COLS[c].kind === 'gap';
        chip.rect.setAttribute('x', x);
        chip.rect.setAttribute('y', y);
        chip.rect.setAttribute('fill', gap ? 'none' : fillFor(c));
        chip.rect.setAttribute('stroke', gap ? 'var(--border)' : 'none');
        chip.rect.setAttribute('stroke-dasharray', gap ? '3 3' : 'none');
        chip.rect.setAttribute('opacity', gap ? 1 : 0.9);
        chip.label.setAttribute('x', x + cellW / 2);
        chip.label.setAttribute('y', y + cellH / 2);
        chip.label.setAttribute('opacity', 1);
        chip.label.setAttribute('style', gap ? 'fill: var(--muted)' : '');
        chip.label.textContent = COLS[c].kind === 'sfid' ? `SFID ${r}` : COLS[c].label;
      }

      /* Minor-frame boundaries survive into the stream only because SFID
         and the sync words are there — mark them. */
      let mi = 0;
      for (let i = 0; i < POOL && mi < markPool.length; i++) {
        const g = step - i;
        if (g < 0 || g % NC !== 0) continue;
        const x = (g === step ? flyX : slotX(g, e)) - 4;
        markPool[mi].line.setAttribute('d', `M${x} ${laneY - 9} L${x} ${waveLo + 8}`);
        markPool[mi].label.setAttribute('x', x + 5);
        markPool[mi].label.setAttribute('y', laneY - 13);
        markPool[mi].label.textContent = `minor ${Math.floor(g / NC) % ROWS}`;
        mi++;
      }
      for (; mi < markPool.length; mi++) {
        markPool[mi].line.setAttribute('d', '');
        markPool[mi].label.textContent = '';
      }

      /* The waveform: bits of the current word are clocked out at a fixed
         point, so the leading edge never moves and the stream slides left. */
      const bitW = pitch / BITS;
      let d = '';
      let dashed = '';
      let dotY = waveMid;
      for (let i = POOL - 1; i >= 0; i--) {
        const g = step - i;
        if (g < 0) continue;
        const c = g % NC;
        const r = Math.floor(g / NC) % ROWS;
        const x0 = slotX(g, e) - 2;
        if (x0 > clipR || x0 + pitch < clipL) continue;
        const reveal = g === step ? e * pitch : pitch;
        const bits = bitsFor(r, c);
        if (!bits) {
          dashed += `M${x0} ${waveMid} L${x0 + reveal} ${waveMid} `;
          continue;
        }
        let prev = null;
        for (let k = 0; k < BITS; k++) {
          const bx = k * bitW;
          if (bx >= reveal) break;
          const bx2 = Math.min((k + 1) * bitW, reveal);
          const y = bits[k] ? waveHi : waveLo;
          d += prev === null ? `M${x0 + bx} ${y} ` : `L${x0 + bx} ${y} `;
          d += `L${x0 + bx2} ${y} `;
          prev = y;
          if (g === step) dotY = y;
        }
      }
      wave.setAttribute('d', d);
      waveGap.setAttribute('d', dashed);
      clockDot.setAttribute('cx', headX);
      clockDot.setAttribute('cy', dotY);

      if (COLS[col].kind === 'gap') {
        captionText.textContent = `Minor ${row} — the words this drawing leaves out. A real frame has W − 3 measurement words here.`;
        captionBits.textContent = '';
      } else {
        const word = COLS[col].kind === 'sfid' ? `SFID = ${row}` : COLS[col].label;
        captionText.textContent = `Reading minor ${row}, word ${col} — ${word} goes onto the wire as `;
        captionBits.textContent = bitsFor(row, col).join('');
      }
    }

    function tick(now) {
      if (last) frac += (now - last) / STEP_MS;
      last = now;
      while (frac >= 1) { frac -= 1; step += 1; }
      render();
      if (playing) raf = requestAnimationFrame(tick);
    }

    function play() {
      if (playing) return;
      playing = true;
      last = 0;
      raf = requestAnimationFrame(tick);
      button.setAttribute('aria-pressed', 'true');
      button.setAttribute('aria-label', 'Pause the readout');
      button.innerHTML = PAUSE_ICON;
    }
    function pause() {
      playing = false;
      cancelAnimationFrame(raf);
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', 'Play the readout');
      button.innerHTML = PLAY_ICON;
    }

    /* ---- Shell: a plain figure, a caption, one control ---- */
    const figure = document.createElement('div');
    figure.className = 'pcm-stream-figure';
    const stage = document.createElement('div');
    stage.className = 'pcm-stream-stage';
    stage.append(svg);
    const bar = document.createElement('div');
    bar.className = 'pcm-stream-bar';
    const PLAY_ICON = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M4.2 2.3 11.6 7 4.2 11.7Z"/></svg>';
    const PAUSE_ICON = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><rect x="3.7" y="3.7" width="6.6" height="6.6" rx="1"/></svg>';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pcm-stream-play';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Play the readout');
    button.innerHTML = PLAY_ICON;
    const note = document.createElement('p');
    note.innerHTML = 'A decoder never sees the rectangle. It sees this bit stream, and rebuilds the grid by counting words between sync patterns.';
    bar.append(button, note);
    figure.append(stage, bar);
    mount.replaceChildren(figure);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let userPaused = false;
    const wanted = () => visible && !userPaused && !reduced.matches && !document.hidden;
    const sync = () => (wanted() ? play() : pause());

    button.addEventListener('click', () => {
      userPaused = playing;
      sync();
      if (!userPaused && !playing) play();
    });

    /* Seed the stream so the figure reads as a full minor frame even paused. */
    step = NC + 3;
    frac = 0;
    render();

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.2 }).observe(mount);
    } else {
      visible = true;
      sync();
    }
    document.addEventListener('visibilitychange', sync);
  })();

  /* ------------------------------------------------------------------ *
   * Lab 01 — grid dimensioning against the Chapter 4 hard limits.
   * ------------------------------------------------------------------ */
  (function frameLab() {
    const root = document.getElementById('frame-lab');
    if (!root) return;
    /* The standard allows M up to 256 and W up to 1,024, but a 256x1024 preview
       is a grey smear that also drags the page around as it redraws. The sliders
       stop where the drawing stays readable; the read-outs still carry the real
       ceilings, and the badges still check against them. */
    const MINORS = [4, 6, 8, 12, 16, 20, 24];
    const WORDS = [8, 12, 16, 24, 32, 40, 48];
    const WORD_BITS = [8, 10, 12, 16, 20, 24, 32];

    const mount = root.querySelector('.pcm-figure div');
    const minorInput = root.querySelector('#frame-minor');
    const wordInput = root.querySelector('#frame-words');
    const bitsInput = root.querySelector('#frame-bits');
    const rateInput = root.querySelector('#frame-rate');
    minorInput.max = MINORS.length - 1;
    wordInput.max = WORDS.length - 1;
    bitsInput.max = WORD_BITS.length - 1;

    let grid = null;
    let shown = '';

    function update() {
      const M = MINORS[+minorInput.value];
      const W = WORDS[+wordInput.value];
      const w = WORD_BITS[+bitsInput.value];
      const majorRate = +rateInput.value;

      const key = `${M}x${W}`;
      if (key !== shown) {
        grid = makeGrid(mount, { rows: M, cols: W, fit: FRAME_STAGE, label: `A ${M} by ${W} major frame` });
        shown = key;
      }
      grid.reset();
      // A single neutral fill: this lab is about the grid's shape, not its allocation.
      for (let r = 0; r < M; r++) {
        for (let c = 1; c < W - 2; c++) grid.paint(r, c, SPEC_COLORS[0], 0.3);
      }
      for (let r = 0; r < M; r++) {
        grid.paint(r, 0, 'var(--pcm-sfid)');
        grid.label(r, 0, 'SF');
        grid.paint(r, W - 2, 'var(--pcm-sync)');
        grid.label(r, W - 2, 'F1');
        grid.paint(r, W - 1, 'var(--pcm-sync)');
        grid.label(r, W - 1, 'F2');
      }

      const bitsPerMinor = w * W;
      const dataWords = W - IRIG.OVERHEAD_WORDS;
      const bitRate = majorRate * w * W * M;
      const efficiency = dataWords / W;
      const balance = Math.min(M, W) / Math.max(M, W);
      const cells = M * dataWords;

      root.querySelector('#frame-minor-value').textContent = M;
      root.querySelector('#frame-words-value').textContent = W;
      root.querySelector('#frame-bits-value').textContent = `${w} bits`;
      root.querySelector('#frame-rate-value').textContent = `${majorRate} Hz`;
      root.querySelector('#frame-headline').textContent = bitRate >= 1e6 ? `${fmt(bitRate / 1e6, 2)} Mbps` : `${commas(bitRate / 1000)} kbps`;

      const set = (id, text, state) => {
        const node = root.querySelector(id);
        node.textContent = text;
        node.className = state || '';
      };
      set('#frame-out-cells', commas(cells));
      set('#frame-out-bitsminor', `${commas(bitsPerMinor)} / ${commas(IRIG.MAX_BITS_PER_MINOR_FRAME)}`, bitsPerMinor > IRIG.MAX_BITS_PER_MINOR_FRAME ? 'is-bad' : 'is-ok');
      set('#frame-out-eff', `${fmt(efficiency * 100, 1)}%`, efficiency < 0.9 ? 'is-warn' : 'is-ok');
      set('#frame-out-balance', fmt(balance, 3), balance < 0.1 ? 'is-warn' : '');
      set('#frame-out-minorrate', `${commas(majorRate * M)} Hz`);
      set('#frame-out-period', `${fmt(1000 / majorRate, majorRate >= 100 ? 2 : 1)} ms`);

      const checks = [
        [`W ≤ ${commas(IRIG.MAX_WORDS_PER_MINOR_FRAME)}`, `${W}`, W <= IRIG.MAX_WORDS_PER_MINOR_FRAME],
        [`w·W ≤ ${commas(IRIG.MAX_BITS_PER_MINOR_FRAME)} bits`, `${commas(bitsPerMinor)}`, bitsPerMinor <= IRIG.MAX_BITS_PER_MINOR_FRAME],
        [`${IRIG.MIN_MINOR_FRAMES_PER_MAJOR} ≤ M ≤ ${IRIG.MAX_MINOR_FRAMES_PER_MAJOR}`, `${M}`, M >= IRIG.MIN_MINOR_FRAMES_PER_MAJOR && M <= IRIG.MAX_MINOR_FRAMES_PER_MAJOR],
        [`${IRIG.MIN_WORD_BITS} ≤ w ≤ ${IRIG.MAX_WORD_BITS}`, `${w}`, w >= IRIG.MIN_WORD_BITS && w <= IRIG.MAX_WORD_BITS],
        [`B ≤ ${commas(IRIG.MAX_BIT_RATE_BPS / 1e6)} Mbps`, `${fmt(bitRate / 1e6, 2)}`, bitRate <= IRIG.MAX_BIT_RATE_BPS],
        ['W > 3 overhead words', `${dataWords} data`, dataWords > 0],
      ];
      root.querySelector('#frame-badges').innerHTML = checks.map(([name, value, pass]) =>
        `<span class="pcm-badge ${pass ? 'pass' : 'fail'}"><i aria-hidden="true">${pass ? '✓' : '✕'}</i><span>${name}</span><b>${value}</b></span>`
      ).join('');
      root.querySelector('#frame-verdict').textContent = checks.every(([, , pass]) => pass)
        ? 'Valid IRIG-106 Chapter 4 grid.'
        : 'Rejected — validate_grid() marks this candidate invalid.';
      root.querySelector('#frame-verdict').className = checks.every(([, , pass]) => pass) ? 'is-ok' : 'is-bad';
    }

    root.addEventListener('input', update);
    update();
  })();

  /* ------------------------------------------------------------------ *
   * decompose_samples() — the periodicity contract, ported verbatim.
   * ------------------------------------------------------------------ */
  function colDivisors(cols) {
    const out = [];
    for (let d = 1; d <= cols; d++) if (cols % d === 0) out.push(d);
    return out;
  }
  function decomposeSamples(actual, rows, cols) {
    if (actual <= 0) return null;
    if (actual <= rows && rows % actual === 0) {
      return { rowsUsed: actual, spm: 1, rowPeriod: rows / actual, path: 'Fast path 1 · pure sub-commutation' };
    }
    if (actual >= rows && actual % rows === 0) {
      const spm = actual / rows;
      if (spm === 1 || (cols % spm === 0 && cols / spm >= 1)) {
        return { rowsUsed: rows, spm, rowPeriod: 1, path: 'Fast path 2 · pure super-commutation' };
      }
    }
    for (let rowsUsed = Math.min(actual, rows); rowsUsed > 0; rowsUsed--) {
      if (rows % rowsUsed !== 0) continue;
      if (actual % rowsUsed !== 0) continue;
      const spm = actual / rowsUsed;
      if (spm > 1 && cols % spm !== 0) continue;
      return { rowsUsed, spm, rowPeriod: rows / rowsUsed, path: 'Exact decomposition search' };
    }
    const minSpm = Math.ceil(actual / rows);
    for (const spm of colDivisors(cols)) {
      if (spm < minSpm) continue;
      if (Math.floor(cols / spm) < 1) continue;
      return { rowsUsed: rows, spm, rowPeriod: 1, path: 'Round-up fallback · forced oversample' };
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Lab 02 — commutation modes and the periodicity invariant.
   * ------------------------------------------------------------------ */
  (function commutationLab() {
    const root = document.getElementById('commutation-lab');
    if (!root) return;
    const MINORS = [4, 6, 8, 12, 16, 24];
    const WORDS = [8, 12, 16, 24, 32];

    const mount = root.querySelector('.pcm-figure div');
    const minorInput = root.querySelector('#comm-minor');
    const wordInput = root.querySelector('#comm-words');
    const sampleInput = root.querySelector('#comm-samples');
    const offsetInput = root.querySelector('#comm-offset');
    minorInput.max = MINORS.length - 1;
    wordInput.max = WORDS.length - 1;

    let grid = null;
    let shown = '';

    function update(event) {
      const M = MINORS[+minorInput.value];
      const W = WORDS[+wordInput.value];
      sampleInput.max = M * 4;
      const requested = clamp(+sampleInput.value, 1, M * 4);
      const key = `${M}x${W}`;
      if (key !== shown) {
        grid = makeGrid(mount, { rows: M, cols: W, fit: COMM_STAGE, label: `A ${M} by ${W} grid` });
        shown = key;
      }
      grid.reset();
      const reserved = paintOverhead(grid);

      const plan = decomposeSamples(requested, M, W);
      const readout = (id, text, state) => {
        const node = root.querySelector(id);
        node.textContent = text;
        node.className = state || '';
      };

      if (!plan) {
        readout('#comm-path', 'no periodic decomposition', 'is-bad');
        root.querySelector('#comm-headline').textContent = '—';
        root.querySelector('#comm-minor-value').textContent = `M = ${M}`;
        root.querySelector('#comm-words-value').textContent = `W = ${W}`;
        root.querySelector('#comm-samples-value').textContent = `${requested}/major`;
        return;
      }

      const colPeriod = plan.spm > 1 ? W / plan.spm : W;
      const maxColOff = Math.max(1, colPeriod);
      offsetInput.max = Math.max(0, maxColOff - 1);
      const colOff = clamp(+offsetInput.value, 0, maxColOff - 1);
      const rowOff = 0;

      let collisions = 0;
      const placed = [];
      for (let k = 0; k < plan.rowsUsed; k++) {
        const r = rowOff + k * plan.rowPeriod;
        if (r >= M) continue;
        for (let j = 0; j < plan.spm; j++) {
          const c = colOff + j * colPeriod;
          if (c >= W) continue;
          if (reserved.has(c)) { collisions++; grid.paint(r, c, 'var(--pcm-bad)'); continue; }
          grid.paint(r, c, SPEC_COLORS[0]);
          grid.label(r, c, 'M1');
          placed.push([r, c]);
        }
      }

      const delivered = plan.rowsUsed * plan.spm;
      const oversample = delivered / requested;
      const mode = plan.spm > 1 && plan.rowPeriod === 1 ? 'super-commutated'
        : plan.spm > 1 ? 'super + sub-commutated'
        : plan.rowPeriod > 1 ? 'sub-commutated' : 'once per minor frame';

      root.querySelector('#comm-minor-value').textContent = `M = ${M}`;
      root.querySelector('#comm-words-value').textContent = `W = ${W}`;
      root.querySelector('#comm-samples-value').textContent = `${requested}/major`;
      root.querySelector('#comm-offset-value').textContent = `col ${colOff}`;
      root.querySelector('#comm-headline').textContent = `${delivered}/major`;
      readout('#comm-mode', mode);
      readout('#comm-path', plan.path, plan.path.startsWith('Round-up') ? 'is-warn' : 'is-ok');
      readout('#comm-rows', `${plan.rowsUsed} rows · period ${plan.rowPeriod}`);
      readout('#comm-spm', `${plan.spm} · period ${plan.spm > 1 ? colPeriod : '—'}`);
      readout('#comm-delivered', `${delivered} ≥ ${requested}`, delivered >= requested ? 'is-ok' : 'is-bad');
      readout('#comm-oversample', `${fmt(oversample, 2)}×`, oversample > 1.5 ? 'is-warn' : 'is-ok');
      readout('#comm-collisions', collisions ? `${collisions} on overhead` : 'none', collisions ? 'is-bad' : 'is-ok');
      readout('#comm-rowcheck', `${M} mod ${plan.rowsUsed} = ${M % plan.rowsUsed}`, M % plan.rowsUsed === 0 ? 'is-ok' : 'is-bad');
      readout('#comm-colcheck', plan.spm > 1 ? `${W} mod ${plan.spm} = ${W % plan.spm}` : 'unconstrained', plan.spm > 1 && W % plan.spm !== 0 ? 'is-bad' : 'is-ok');

      const gaps = [];
      for (let j = 1; j < plan.spm; j++) gaps.push(colPeriod);
      root.querySelector('#comm-invariant').textContent = plan.spm > 1
        ? `c_{j+1} − c_j = ${colPeriod} for all j, wrap-around = ${W - (colOff + (plan.spm - 1) * colPeriod) + colOff}`
        : 'single column per minor frame — no column invariant applies';
      if (event && event.target === minorInput) offsetInput.value = 0;
      grid.svg.setAttribute('aria-label',
        `Measurement M1 occupies ${placed.length} cells: ${plan.rowsUsed} of ${M} rows spaced every ${plan.rowPeriod}, ${plan.spm} per minor frame spaced every ${colPeriod} columns.`);
    }

    root.addEventListener('input', update);
    update();
  })();

  /* ------------------------------------------------------------------ *
   * Lab 03 — _score_candidate(), weight for weight.
   * ------------------------------------------------------------------ */
  function countDivisors(n) {
    let count = 0;
    for (let d = 1; d * d <= n; d++) {
      if (n % d !== 0) continue;
      count += d * d === n ? 1 : 2;
    }
    return count;
  }
  function scoreCandidate({ alpha, spare, minorFrames, wordsPerMinor, violations }) {
    const multiplier = alpha > 0 ? 1 - 1 / alpha : 0;
    const spareScore = Math.max(0, 1 - Math.abs(spare - 0.2));
    const divisor = Math.min(countDivisors(minorFrames) / 16, 1);
    const efficiency = (wordsPerMinor - IRIG.OVERHEAD_WORDS) / wordsPerMinor;
    const balance = Math.min(minorFrames, wordsPerMinor) / Math.max(minorFrames, wordsPerMinor);
    const penalty = 0.5 * violations;
    const parts = [
      { key: 'multiplier', label: 'Oversampling S_mult', weight: 0.35, raw: multiplier, color: 'var(--pcm-s0)' },
      { key: 'spare', label: 'Spare capacity S_spare', weight: 0.20, raw: spareScore, color: 'var(--pcm-s2)' },
      { key: 'divisor', label: 'Divisibility S_div', weight: 0.10, raw: divisor, color: 'var(--pcm-s4)' },
      { key: 'efficiency', label: 'Overhead S_eff', weight: 0.10, raw: efficiency, color: 'var(--pcm-s1)' },
      { key: 'balance', label: 'Grid balance S_bal', weight: 0.15, raw: balance, color: 'var(--pcm-s3)' },
    ];
    const total = parts.reduce((sum, part) => sum + part.weight * part.raw, 0) - penalty;
    return { parts, penalty, total: Math.round(total * 1e6) / 1e6, divisorCount: countDivisors(minorFrames) };
  }

  (function scoreLab() {
    const root = document.getElementById('score-lab');
    if (!root) return;
    const MINORS = [4, 8, 12, 16, 20, 24, 32, 40, 48, 60, 64, 80, 96, 120, 128, 192, 256];
    const WORDS = [8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 1024];
    const minorInput = root.querySelector('#score-minor');
    const wordInput = root.querySelector('#score-words');
    const alphaInput = root.querySelector('#score-alpha');
    const spareInput = root.querySelector('#score-spare');
    const violationInput = root.querySelector('#score-violations');
    minorInput.max = MINORS.length - 1;
    wordInput.max = WORDS.length - 1;

    function update() {
      const minorFrames = MINORS[+minorInput.value];
      const wordsPerMinor = WORDS[+wordInput.value];
      const alpha = +alphaInput.value / 10;
      const spare = +spareInput.value / 100;
      const violations = +violationInput.value;
      const result = scoreCandidate({ alpha, spare, minorFrames, wordsPerMinor, violations });

      root.querySelector('#score-minor-value').textContent = `M = ${minorFrames}`;
      root.querySelector('#score-words-value').textContent = `W = ${wordsPerMinor}`;
      root.querySelector('#score-alpha-value').textContent = `α = ${fmt(alpha, 1)}×`;
      root.querySelector('#score-spare-value').textContent = `${Math.round(spare * 100)}%`;
      root.querySelector('#score-violations-value').textContent = `${violations}`;
      root.querySelector('#score-headline').textContent = fmt(result.total, 3);
      root.querySelector('#score-headline').style.color = result.total < 0 ? 'var(--pcm-bad)' : '';

      const rows = result.parts.map((part) => `
        <div class="pcm-weight">
          <span>${part.label}</span>
          <span class="pcm-track"><i style="--bar: ${part.color}; width: ${clamp(part.weight * part.raw / 0.35, 0, 1) * 100}%"></i></span>
          <b>${fmt(part.weight * part.raw, 3)}</b>
        </div>`).join('');
      const penaltyRow = `
        <div class="pcm-weight penalty">
          <span>Spacing penalty V_spacing</span>
          <span class="pcm-track"><i style="width: ${clamp(result.penalty / 0.35, 0, 1) * 100}%"></i></span>
          <b>${result.penalty ? '−' : ''}${fmt(result.penalty, 3)}</b>
        </div>`;
      const totalRow = `
        <div class="pcm-weight total">
          <span>Composite score S</span>
          <span class="pcm-track"><i style="--bar: var(--accent); width: ${clamp(result.total, 0, 0.9) / 0.9 * 100}%"></i></span>
          <b>${fmt(result.total, 3)}</b>
        </div>`;
      root.querySelector('#score-weights').innerHTML = rows + penaltyRow + totalRow;

      const note = root.querySelector('#score-note');
      note.innerHTML = `d(${minorFrames}) = <b>${result.divisorCount}</b> divisors · `
        + `S<sub>eff</sub> = (${wordsPerMinor}−3)/${wordsPerMinor} · `
        + `S<sub>bal</sub> = ${Math.min(minorFrames, wordsPerMinor)}/${Math.max(minorFrames, wordsPerMinor)} · `
        + `weights sum to 0.90, so one violation costs more than the whole balance term.`;
    }
    root.addEventListener('input', update);
    update();
  })();

  /* ------------------------------------------------------------------ *
   * Architecture pipeline.
   * ------------------------------------------------------------------ */
  (function pipeline() {
    const root = document.getElementById('pcm-pipeline');
    if (!root) return;
    const STAGES = [
      {
        id: '1', name: '_get_groups()', blurb: 'Parse the GUI rows',
        title: 'Parse GUI rows into ParameterGroup objects',
        body: 'Every table row becomes a typed group. Validation happens here rather than deeper in the solver, so an operator sees the mistake next to the field that caused it.',
        points: [
          'Rejects empty names, non-positive channel counts, and non-positive samples-per-second.',
          'Computes <code>extended_read_count = ceil(bus_bits / bpw) − 1</code> so a wide bus word knows how many companions it needs.',
          'Returns <code>None</code> on any validation failure — the pipeline never starts with bad input.',
        ],
        io: ['GUI rows', '→', 'list[ParameterGroup] | None'],
      },
      {
        id: '2', name: 'CSVD injection', blurb: 'Digitised voice as a group',
        title: 'Inject CSVD voice as a ParameterGroup',
        body: 'Digitised voice is modelled as just another measurement group so that it competes for grid capacity on the same terms as everything else.',
        points: [
          'Marked <code>input_type="digitized_sps"</code>, which bypasses the anti-aliasing oversampling factor.',
          'A digital source&rsquo;s stated rate is its actual rate — no multiplier is applied.',
        ],
        io: ['voice config', '→', 'ParameterGroup'],
      },
      {
        id: '3', name: 'get_all_candidates()', blurb: 'Find the floor bit rate',
        title: 'Probe at MAX_BIT_RATE to find the minimum feasible rate',
        body: 'Before choosing a grid, the solver asks a cheaper question: what is the least bandwidth that could possibly carry this instrumentation list? Every valid grid is enumerated at the 10 Mbps ceiling and the smallest implied bit rate wins.',
        points: [
          '<code>min_required_bitrate = min(c.implied_bit_rate for valid c)</code>',
          '<code>target_bit_rate = min_required_bitrate + spare_bitrate</code>',
          'Turns an open-ended search into a bounded one, and gives the operator a defensible number to request from the range.',
        ],
        io: ['groups', '→', 'target_bit_rate'],
      },
      {
        id: '4', name: 'select_best_grid()', blurb: 'Two-pass dimensioning',
        title: 'Enumerate, score, and choose (M, W)',
        body: 'The dimensioning phase. Aggregate requirements set the major frame rate, candidates are built for twenty minor-frame counts plus up to three wider variants each, and the weighted composite score ranks them.',
        points: [
          '<code>compute_aggregate_requirements()</code>: <code>total_sps = Σ(cᵢ × sᵢ × factorᵢ)</code>, <code>major_frame_rate = min(sᵢ)</code>.',
          '<code>_build_candidate()</code> runs the two-pass allocation, then validates against Chapter 4.',
          '<code>_score_candidate()</code> applies the six-component score; candidates sort by it.',
          '<code>validate_grid()</code> double-checks the winner before <code>plan_structure()</code> emits GroupRatePlans.',
        ],
        io: ['target_bit_rate', '→', 'StructurePlan'],
      },
      {
        id: '5', name: 'Measurement flattening', blurb: 'Groups → labelled words',
        title: 'Build the flat measurement list',
        body: 'A group of eight accelerometer channels becomes eight individually labelled measurements, each carrying its own sample count. This is the point where the problem stops being about groups and starts being about cells.',
        points: [
          'One labelled <code>Measurement</code> per channel per group.',
          'Appends <code>_ER</code> / <code>_ER1</code> / <code>_ER2</code> companions for bus data wider than one word.',
          'Appends HT, LT and MT time words at the minor frame rate.',
        ],
        io: ['GroupRatePlans', '→', 'list[Measurement]'],
      },
      {
        id: '6', name: 'place_periodic()', blurb: 'The CSP solver',
        title: 'Constraint satisfaction over the 2D grid',
        body: 'The placement phase. A backtracking search with forward checking assigns every measurement a periodic set of cells, with a greedy first-fit pass as the timeout escape hatch.',
        points: [
          '<code>PeriodicGrid.create()</code> pre-places SFID at column 0 and FS1/FS2 at the last two columns.',
          '<code>compute_placement_specs()</code> groups ER companions, decomposes samples, and sorts most-constrained-first with time words last.',
          '<code>_backtrack()</code> enumerates offsets, checks the cells are free, forward-checks the remaining specs, and recurses.',
          'On a 10-second deadline the grid resets and <code>_greedy_place()</code> takes the first valid offset for each spec.',
        ],
        io: ['measurements', '→', 'placements'],
      },
      {
        id: '7', name: 'export_pcm_workbook()', blurb: 'Colour-coded .xlsx',
        title: 'Write the deliverable',
        body: 'The output is the artefact the instrumentation group actually uses in review: a colour-coded workbook that a reviewer can read without running the tool.',
        points: [
          'Four sheets: <b>Inputs</b>, <b>Structure Plan</b>, <b>PCM MAP</b>, <b>Legend</b>.',
          'Each measurement group gets a fill colour carried through the map and the legend.',
          'Writing is <code>O(M×W)</code> and dominates only because openpyxl touches every cell.',
        ],
        io: ['placements', '→', 'workbook.xlsx'],
      },
    ];

    const list = root.querySelector('.pcm-stages');
    const panel = root.querySelector('.pcm-stage-panel');
    list.innerHTML = STAGES.map((stage, index) => `
      <button class="pcm-stage" type="button" role="tab" id="pcm-stage-${index}"
              aria-controls="pcm-stage-panel" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">
        <em>[${stage.id}]</em>
        <span>${stage.name}<small>${stage.blurb}</small></span>
      </button>`).join('');
    const buttons = [...list.querySelectorAll('.pcm-stage')];

    function show(index) {
      const stage = STAGES[index];
      buttons.forEach((button, i) => {
        button.setAttribute('aria-selected', String(i === index));
        button.tabIndex = i === index ? 0 : -1;
      });
      panel.innerHTML = `
        <h4>${stage.title}</h4>
        <p>${stage.body}</p>
        <ul>${stage.points.map((point) => `<li>${point}</li>`).join('')}</ul>
        <div class="pcm-stage-io">${stage.io.map((token) => (token === '→' ? '→' : `<b>${token}</b>`)).join(' ')}</div>`;
    }
    buttons.forEach((button, index) => {
      button.addEventListener('click', () => show(index));
      button.addEventListener('keydown', (event) => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0
          : event.key === 'End' ? buttons.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        show(next);
        buttons[next].focus();
      });
    });
    show(0);
  })();

  /* ------------------------------------------------------------------ *
   * Lab 04 — the backtracking solver, traced and replayed.
   * ------------------------------------------------------------------ */
  const SOLVER_SPECS = [
    { label: 'ACCEL_X', rowsUsed: 6, rowPeriod: 1, spm: 2, width: 1, note: '2/minor · super' },
    { label: 'VIB_1', rowsUsed: 6, rowPeriod: 1, spm: 4, width: 1, note: '4/minor · super' },
    { label: 'BUS_ARINC', rowsUsed: 3, rowPeriod: 2, spm: 1, width: 2, note: '3 rows · 2 wide' },
    { label: 'PRESS_1', rowsUsed: 3, rowPeriod: 2, spm: 1, width: 1, note: '3 rows · sub' },
    { label: 'TEMP_A', rowsUsed: 2, rowPeriod: 3, spm: 1, width: 1, note: '2 rows · sub' },
    { label: 'TIME_HLM', rowsUsed: 6, rowPeriod: 1, spm: 1, width: 3, time: true, note: 'every row · 3 wide' },
  ];
  const SOLVER_ROWS = 6;
  const SOLVER_COLS = 16;

  function solve(rows, cols, inputSpecs, forwardChecking) {
    const reserved = overheadCols(cols);
    const occupied = Array.from({ length: rows }, () => Array(cols).fill(null));
    // MRV: the spec that fills the most cells goes first; time words go last.
    const specs = [...inputSpecs]
      .map((spec, index) => ({ ...spec, color: SPEC_COLORS[index % SPEC_COLORS.length], cells: spec.rowsUsed * spec.spm * spec.width }))
      .sort((a, b) => (a.time ? 1 : 0) - (b.time ? 1 : 0) || b.cells - a.cells);

    const periodOf = (spec) => (spec.spm > 1 ? cols / spec.spm : cols);
    function cellsFor(spec, rowOff, colOff) {
      const colPeriod = periodOf(spec);
      const out = [];
      for (let k = 0; k < spec.rowsUsed; k++) {
        const r = rowOff + k * spec.rowPeriod;
        if (r >= rows) return null;
        for (let j = 0; j < spec.spm; j++) {
          for (let b = 0; b < spec.width; b++) {
            const c = colOff + j * colPeriod + b;
            if (c >= cols || reserved.has(c)) return null;
            out.push([r, c]);
          }
        }
      }
      return out;
    }
    function offsetsFor(spec) {
      const out = [];
      for (let rowOff = 0; rowOff < spec.rowPeriod; rowOff++) {
        for (let colOff = 0; colOff < periodOf(spec); colOff++) out.push([rowOff, colOff]);
      }
      return out;
    }
    const isFree = (cells) => cells.every(([r, c]) => occupied[r][c] === null);
    const hasOption = (spec) => offsetsFor(spec).some(([ro, co]) => {
      const cells = cellsFor(spec, ro, co);
      return cells && isFree(cells);
    });

    const trace = [];
    const stats = { steps: 0, placed: 0, blocked: 0, pruned: 0, undone: 0 };

    function backtrack(index) {
      if (index === specs.length) return true;
      const spec = specs[index];
      for (const [rowOff, colOff] of offsetsFor(spec)) {
        stats.steps++;
        const cells = cellsFor(spec, rowOff, colOff);
        if (!cells) { trace.push({ type: 'reject', index, rowOff, colOff, cells: [] }); continue; }
        if (!isFree(cells)) {
          stats.blocked++;
          const taken = cells.filter(([r, c]) => occupied[r][c] !== null);
          trace.push({ type: 'blocked', index, rowOff, colOff, cells, taken: taken.length, by: occupied[taken[0][0]][taken[0][1]] });
          continue;
        }
        cells.forEach(([r, c]) => { occupied[r][c] = spec.label; });
        stats.placed++;
        trace.push({ type: 'place', index, rowOff, colOff, cells });

        if (forwardChecking && index + 1 < specs.length) {
          const doomed = specs.slice(index + 1).find((rest) => !hasOption(rest));
          if (doomed) {
            stats.pruned++;
            cells.forEach(([r, c]) => { occupied[r][c] = null; });
            trace.push({ type: 'prune', index, rowOff, colOff, cells, doomed: doomed.label });
            continue;
          }
        }
        if (backtrack(index + 1)) return true;
        stats.undone++;
        cells.forEach(([r, c]) => { occupied[r][c] = null; });
        trace.push({ type: 'undo', index, rowOff, colOff, cells });
      }
      return false;
    }

    const solved = backtrack(0);
    if (solved) trace.push({ type: 'done', index: specs.length - 1, cells: [] });
    return { solved, specs, trace, stats, rows, cols };
  }

  (function solverLab() {
    const root = document.getElementById('solver-lab');
    if (!root) return;
    const mount = root.querySelector('.pcm-figure div');
    const rail = root.querySelector('#solver-rail');
    const narration = root.querySelector('#solver-narration');
    const scrub = root.querySelector('#solver-scrub');
    const scrubLabel = root.querySelector('#solver-scrub-label');
    const playButton = root.querySelector('#solver-play');
    const stepButton = root.querySelector('#solver-step');
    const resetButton = root.querySelector('#solver-reset');
    const endButton = root.querySelector('#solver-end');
    const fcToggle = root.querySelector('#solver-fc');

    const runs = {
      on: solve(SOLVER_ROWS, SOLVER_COLS, SOLVER_SPECS, true),
      off: solve(SOLVER_ROWS, SOLVER_COLS, SOLVER_SPECS, false),
    };
    const grid = makeGrid(mount, {
      rows: SOLVER_ROWS, cols: SOLVER_COLS, cell: cellSizeFor(SOLVER_COLS),
      label: 'Backtracking solver placing six measurement specs on a 6 by 16 grid',
    });

    let run = runs.on;
    let cursor = -1;
    let timer = null;

    rail.innerHTML = '';
    function drawRail() {
      rail.innerHTML = run.specs.map((spec, index) => `
        <div class="pcm-spec" data-index="${index}" style="--swatch: ${spec.color}">
          <i aria-hidden="true"></i>
          <span><b>${spec.label}</b><small>${spec.note} · ${spec.cells}c</small></span>
          <u>pending</u>
        </div>`).join('');
    }

    const READY_HTML = '<em>ready</em><p>Press play. Specs are ordered most-constrained-first; <b>TIME_HLM</b> is held back because time words carry no periodicity requirement.</p>';
    function narrationHtml(source, event) {
      const spec = source.specs[event.index];
      const at = `(${event.rowOff}, ${event.colOff})`;
      const messages = {
        reject: ['reject', `<b>${spec.label}</b> at offset ${at} — generated cells fall on an overhead column or off the grid. <code>generate_cells()</code> returns None.`],
        blocked: ['blocked', `<b>${spec.label}</b> at offset ${at} — ${event.taken} of ${event.cells.length} cells already hold <b>${event.by}</b>. Try the next offset.`],
        place: ['place', `<b>${spec.label}</b> placed at offset ${at} — ${event.cells.length} cells written.`],
        prune: ['prune', `Forward check failed: <b>${event.doomed}</b> now has zero valid offsets. Undo <b>${spec.label}</b> at ${at} before exploring a doomed subtree.`],
        undo: ['undo', `Dead end below. Unplace <b>${spec.label}</b> at ${at} and take the next offset — this is the reversible <code>place()</code>/<code>unplace()</code> pair.`],
        done: ['solved', `All ${source.specs.length} specs placed. ${source.stats.steps} offsets examined, ${source.stats.undone} placements undone.`],
      };
      const [tag, text] = messages[event.type];
      return `<em>${tag}</em><p>${text}</p>`;
    }

    /* Reserve the tallest message the trace can produce, at this exact column
       width. A status that grows from one line to three would otherwise push
       the figure column taller, and the figure column sets the row height, so
       the whole lab would resize under the cursor mid-playback. Measured rather
       than assumed, because the wrap point moves with the viewport. */
    function reserveNarrationHeight() {
      const probe = document.createElement('div');
      probe.className = 'pcm-narration';
      probe.style.cssText = 'visibility:hidden;min-height:0;margin-top:0';
      narration.after(probe);
      const seen = new Set();
      let tallest = 0;
      /* offsetHeight, not getBoundingClientRect: the page sets `html { zoom: .9 }`
         at wide viewports, so rect heights come back in visual pixels while the
         min-height we write back is read as CSS pixels. */
      const measure = (html) => {
        if (seen.has(html)) return;
        seen.add(html);
        probe.innerHTML = html;
        tallest = Math.max(tallest, probe.offsetHeight);
      };
      measure(READY_HTML);
      for (const source of [runs.on, runs.off]) {
        for (const event of source.trace) measure(narrationHtml(source, event));
      }
      probe.remove();
      narration.style.minHeight = `${Math.ceil(tallest) + 1}px`;
    }

    // Replaying from scratch keeps the grid honest: state is always derived.
    function renderTo(target) {
      grid.reset();
      paintOverhead(grid);
      const placedBy = new Map();
      for (let i = 0; i <= target && i < run.trace.length; i++) {
        const event = run.trace[i];
        if (event.type === 'place') placedBy.set(event.index, event.cells);
        if (event.type === 'prune' || event.type === 'undo') placedBy.delete(event.index);
      }
      for (const [index, cells] of placedBy) {
        const spec = run.specs[index];
        for (const [r, c] of cells) {
          grid.paint(r, c, spec.color);
          grid.label(r, c, spec.label.slice(0, 2));
        }
      }
      const event = run.trace[target];
      const railRows = [...rail.querySelectorAll('.pcm-spec')];
      railRows.forEach((node, index) => {
        const done = placedBy.has(index);
        node.classList.toggle('is-placed', done);
        node.classList.toggle('is-active', !!event && event.index === index && event.type !== 'done');
        node.querySelector('u').textContent = done ? 'placed' : 'pending';
      });

      if (!event) {
        grid.clearOutline();
        narration.className = 'pcm-narration';
        narration.innerHTML = READY_HTML;
      } else {
        narration.className = `pcm-narration ${event.type}`;
        narration.innerHTML = narrationHtml(run, event);
        if (event.type === 'blocked' || event.type === 'prune' || event.type === 'undo') grid.outline(event.cells, 'pcm-trial is-bad');
        else if (event.type === 'place') grid.outline(event.cells);
        else grid.clearOutline();
      }

      const seen = run.trace.slice(0, target + 1);
      const count = (type) => seen.filter((e) => e.type === type).length;
      root.querySelector('#solver-steps').textContent = seen.filter((e) => e.type !== 'done').length;
      root.querySelector('#solver-placed').textContent = placedBy.size;
      root.querySelector('#solver-pruned').textContent = count('prune');
      root.querySelector('#solver-undone').textContent = count('undo');
      scrub.value = String(target + 1);
      scrubLabel.textContent = `event ${target + 1} of ${run.trace.length}`;
    }

    /* The transport is icon-only, so play/pause swaps the glyph, not a word. */
    const PLAY_GLYPH = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M4.2 2.3 11.6 7 4.2 11.7Z"/></svg>';
    const PAUSE_GLYPH = '<svg viewBox="0 0 14 14" aria-hidden="true" focusable="false"><rect x="3.7" y="3.7" width="6.6" height="6.6" rx="1"/></svg>';
    function stop() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      playButton.innerHTML = PLAY_GLYPH;
      playButton.setAttribute('aria-label', 'Play the trace');
      playButton.title = 'Play';
      playButton.setAttribute('aria-pressed', 'false');
    }
    function tick() {
      if (cursor >= run.trace.length - 1) return stop();
      cursor++;
      renderTo(cursor);
      // Long unpruned searches replay faster so the contrast stays watchable.
      const delay = clamp(Math.round(4200 / run.trace.length), 14, 260);
      timer = window.setTimeout(tick, run.trace[cursor]?.type === 'place' ? delay * 2.2 : delay);
    }
    function load(which) {
      stop();
      run = runs[which];
      cursor = -1;
      scrub.max = String(run.trace.length);
      scrub.value = '0';
      drawRail();
      renderTo(-1);
      root.querySelector('#solver-total').textContent = `${run.trace.length} events · ${run.stats.steps} offsets tried`;
    }

    playButton.addEventListener('click', () => {
      if (timer !== null) return stop();
      if (cursor >= run.trace.length - 1) cursor = -1;
      playButton.innerHTML = PAUSE_GLYPH;
      playButton.setAttribute('aria-label', 'Pause the trace');
      playButton.title = 'Pause';
      playButton.setAttribute('aria-pressed', 'true');
      tick();
    });
    stepButton.addEventListener('click', () => {
      stop();
      if (cursor < run.trace.length - 1) renderTo(++cursor);
    });
    resetButton.addEventListener('click', () => { stop(); cursor = -1; renderTo(-1); });
    endButton.addEventListener('click', () => { stop(); cursor = run.trace.length - 1; renderTo(cursor); });
    scrub.addEventListener('input', () => { stop(); cursor = +scrub.value - 1; renderTo(cursor); });
    const fcState = fcToggle.closest('.lab-check').querySelector('b');
    fcToggle.addEventListener('change', () => {
      fcState.textContent = fcToggle.checked ? 'enabled' : 'disabled';
      load(fcToggle.checked ? 'on' : 'off');
    });

    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) stop(); }, { threshold: 0 }).observe(root);

    load('on');
    /* Re-measure whenever the column width actually changes. A single pass at
       load is not enough: MathJax typesets after this runs, the page grows a
       scrollbar, and the column ends up narrower than it was when measured. */
    let measuredWidth = 0;
    let reserveTimer = 0;
    const remeasure = () => {
      const width = narration.offsetWidth;
      if (!width || width === measuredWidth) return;
      measuredWidth = width;
      reserveNarrationHeight();
    };
    const scheduleRemeasure = () => {
      window.clearTimeout(reserveTimer);
      reserveTimer = window.setTimeout(remeasure, 80);
    };
    remeasure();
    if ('ResizeObserver' in window) new ResizeObserver(scheduleRemeasure).observe(narration.parentNode);
    window.addEventListener('resize', scheduleRemeasure);
    window.addEventListener('load', scheduleRemeasure);
    root.querySelector('#solver-compare').innerHTML =
      `Forward checking on: <b>${runs.on.stats.steps}</b> offsets, <b>${runs.on.stats.pruned}</b> pruned, <b>${runs.on.stats.undone}</b> undone. `
      + `Off: <b>${runs.off.stats.steps}</b> offsets, <b>${runs.off.stats.undone}</b> undone — `
      + `<b>${fmt(runs.off.stats.steps / runs.on.stats.steps, 1)}×</b> the work for the same answer.`;
  })();

  /* ------------------------------------------------------------------ *
   * Code panels: line numbers, Python highlighting, copy.
   * ------------------------------------------------------------------ */
  const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  const PY_KEYWORDS = /^(def|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|import|from|continue|break|raise|class|lambda|try|except|with|as|yield|pass)$/;
  function highlightPython(line) {
    return line
      .split(/(#.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\bf"(?:[^"]*)"|\b[A-Za-z_]\w*\b|\b\d+(?:\.\d+)?\b)/g)
      .map((token) => {
        if (!token) return '';
        const type = token.startsWith('#') ? 'comment'
          : /^f?["']/.test(token) ? 'string'
          : /^\d/.test(token) ? 'number'
          : PY_KEYWORDS.test(token) ? 'keyword'
          : '';
        return type ? `<span class="syntax-${type}">${escapeHtml(token)}</span>` : escapeHtml(token);
      })
      .join('');
  }
  document.querySelectorAll('.code-file').forEach((panel, index) => {
    const filename = panel.querySelector('.code-file-bar > span');
    if (!filename) return;
    const name = filename.textContent;
    const python = name.endsWith('.py');
    filename.className = 'code-tab';
    filename.innerHTML = `<span class="file-badge" aria-hidden="true">${python ? 'PY' : name.endsWith('.txt') ? 'TXT' : 'OUT'}</span>${escapeHtml(name)}`;
    const pre = panel.querySelector('pre');
    const code = pre.querySelector('code');
    panel.dataset.source = code.textContent;
    pre.tabIndex = 0;
    pre.id = `code-panel-${index}`;
    pre.setAttribute('aria-label', `${name} source`);
    code.innerHTML = panel.dataset.source.split('\n').map((line, i) =>
      `<span class="code-line"><span class="line-number" aria-hidden="true">${i + 1}</span><span>${(python ? highlightPython(line) : escapeHtml(line)) || ' '}</span></span>`
    ).join('');
    const status = document.createElement('div');
    status.className = 'code-status';
    status.textContent = `${python ? 'Python' : 'Plain Text'}     UTF-8`;
    panel.append(status);
  });
  document.querySelectorAll('.copy-code').forEach((button) => {
    button.addEventListener('click', async () => {
      const source = button.closest('.code-file')?.dataset.source || '';
      try {
        await navigator.clipboard.writeText(source);
        button.textContent = 'Copied';
        window.setTimeout(() => { button.textContent = 'Copy'; }, 1400);
      } catch {
        const range = document.createRange();
        range.selectNodeContents(button.closest('.code-file').querySelector('code'));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        button.textContent = 'Select text';
      }
    });
  });
})();
