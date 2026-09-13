(() => {
  const titleAngle = document.getElementById('title-angle');
  const abstractAngle = document.getElementById('abstract-angle');
  const titleKeyword = document.getElementById('title-keyword');
  const abstractKeyword = document.getElementById('abstract-keyword');

  function vectorEnd(angle, radius = 168) {
    const radians = angle * Math.PI / 180;
    return {
      x: 260 + Math.cos(radians) * radius,
      y: 195 - Math.sin(radians) * radius,
    };
  }

  function positionVector(id, labelId, angle) {
    const end = vectorEnd(angle);
    document.getElementById(id).setAttribute('d', `M260 195 L${end.x.toFixed(2)} ${end.y.toFixed(2)}`);
    const label = document.getElementById(labelId);
    label.setAttribute('x', (end.x + 8).toFixed(2));
    label.setAttribute('y', (end.y + (id === 'title-vector' ? -20 : 22)).toFixed(2));
  }

  function updateScore() {
    if (!titleAngle || !abstractAngle) return;
    const titleDegrees = Number(titleAngle.value);
    const abstractDegrees = Number(abstractAngle.value);
    const titleCosine = Math.cos(titleDegrees * Math.PI / 180);
    const abstractCosine = Math.cos(abstractDegrees * Math.PI / 180);
    const multiplier = 1 + (titleKeyword.checked ? 0.2 : 0) + (abstractKeyword.checked ? 0.1 : 0);
    const semantic = 0.4 * titleCosine + 0.6 * abstractCosine;
    const finalScore = Math.min(1, semantic * multiplier);

    document.getElementById('title-value').textContent = `${titleDegrees}°`;
    document.getElementById('abstract-value').textContent = `${abstractDegrees}°`;
    document.getElementById('title-cosine').textContent = titleCosine.toFixed(2);
    document.getElementById('abstract-cosine').textContent = abstractCosine.toFixed(2);
    document.getElementById('keyword-multiplier').textContent = `${multiplier.toFixed(2)}×`;
    document.getElementById('score-result').textContent = finalScore.toFixed(2);
    positionVector('title-vector', 'title-vector-label', titleDegrees);
    positionVector('abstract-vector', 'abstract-vector-label', abstractDegrees);
    document.getElementById('vector-desc').textContent =
      `The title vector is ${titleDegrees} degrees from the query and has cosine similarity ${titleCosine.toFixed(2)}. ` +
      `The abstract vector is ${abstractDegrees} degrees from the query and has cosine similarity ${abstractCosine.toFixed(2)}. ` +
      `The final relevance score is ${finalScore.toFixed(2)}.`;
  }

  document.getElementById('score-demo')?.addEventListener('input', updateScore);
  updateScore();

  if (titleAngle && abstractAngle) {
    const controls = document.createElement('div');
    controls.className = 'lab-actions';
    controls.innerHTML = '<button type="button" id="animate-vectors" aria-pressed="false">Animate vectors</button><button type="button" id="reset-vectors">Reset</button>';
    document.querySelector('.lab-controls').append(controls);
    const play = controls.querySelector('#animate-vectors');
    let frame = null;
    let startedAt = null;
    function stop() {
      cancelAnimationFrame(frame);
      frame = null;
      startedAt = null;
      play.textContent = 'Animate vectors';
      play.setAttribute('aria-pressed', 'false');
    }
    function animate(time) {
      startedAt ??= time;
      const phase = (time - startedAt) / 2500;
      titleAngle.value = Math.round(45 + 45 * Math.sin(phase));
      abstractAngle.value = Math.round(45 + 45 * Math.sin(phase + 0.8));
      updateScore();
      frame = requestAnimationFrame(animate);
    }
    play.addEventListener('click', () => {
      if (frame !== null) return stop();
      play.textContent = 'Pause animation';
      play.setAttribute('aria-pressed', 'true');
      frame = requestAnimationFrame(animate);
    });
    document.getElementById('score-demo').addEventListener('input', stop);
    controls.querySelector('#reset-vectors').addEventListener('click', () => {
      stop();
      titleAngle.value = 46;
      abstractAngle.value = 37;
      titleKeyword.checked = abstractKeyword.checked = false;
      updateScore();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) stop(); }).observe(document.getElementById('score-demo'));
  }

  // Turn the source snippets into accessible editor panels without changing copy text.
  document.querySelectorAll('.strategy-stack article > code').forEach((code, index) => {
    const panel = document.createElement('div');
    panel.className = 'code-file';
    panel.innerHTML = `<div class="code-file-bar"><span>retrieval-${index + 1}.http</span><button class="copy-code" type="button">Copy</button></div><pre><code></code></pre>`;
    panel.querySelector('code').textContent = code.textContent;
    code.replaceWith(panel);
  });
  const escape = (text) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  function highlight(line, typescript) {
    if (!typescript) return escape(line);
    return line.split(/(\/\/.*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`|\b(?:async|function|const|let|for|of|if|return|await|new|null|string|number|Promise|true|false)\b|\b\d+\b)/g).map((token) => {
      const type = token.startsWith('//') ? 'comment' : /^["'`]/.test(token) ? 'string' : /^\d+$/.test(token) ? 'number' : /^(async|function|const|let|for|of|if|return|await|new|null|string|number|Promise|true|false)$/.test(token) ? 'keyword' : '';
      return type ? `<span class="syntax-${type}">${escape(token)}</span>` : escape(token);
    }).join('');
  }
  document.querySelectorAll('.code-file').forEach((panel, index) => {
    const filename = panel.querySelector('.code-file-bar > span');
    const name = filename.textContent;
    const typescript = name.endsWith('.ts');
    filename.className = 'code-tab';
    filename.innerHTML = `<span class="file-badge" aria-hidden="true">${typescript ? 'TS' : name.endsWith('.http') ? 'API' : 'TXT'}</span>${escape(name)}`;
    const pre = panel.querySelector('pre');
    const code = pre.querySelector('code');
    panel.dataset.source = code.textContent;
    pre.tabIndex = 0;
    pre.setAttribute('aria-label', `${name} source code`);
    pre.id = `code-panel-${index}`;
    code.innerHTML = panel.dataset.source.split('\n').map((line, i) => `<span class="code-line"><span class="line-number" aria-hidden="true">${i + 1}</span><span>${highlight(line, typescript) || ' '}</span></span>`).join('');
    const status = document.createElement('div');
    status.className = 'code-status';
    status.textContent = `${typescript ? 'TypeScript' : name.endsWith('.http') ? 'HTTP' : 'Plain Text'}     UTF-8`;
    panel.append(status);
  });
  document.querySelectorAll('.code-split').forEach((group) => {
    const panels = [...group.querySelectorAll('.code-file')];
    const tabs = document.createElement('div');
    tabs.className = 'code-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Ranking source files');
    group.prepend(tabs);
    const buttons = panels.map((panel, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-tab';
      button.innerHTML = panel.querySelector('.code-tab').innerHTML;
      button.id = `source-tab-${index}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', `source-file-${index}`);
      panel.id = `source-file-${index}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      panel.querySelector('.code-tab').hidden = true;
      button.addEventListener('click', () => activate(index));
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? panels.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + panels.length) % panels.length;
        activate(next);
        buttons[next].focus();
      });
      tabs.append(button);
      return button;
    });
    function activate(selected) {
      panels.forEach((panel, index) => {
        panel.hidden = index !== selected;
        buttons[index].setAttribute('aria-selected', String(index === selected));
        buttons[index].tabIndex = index === selected ? 0 : -1;
      });
    }
    activate(0);
  });

  document.querySelectorAll('.copy-code').forEach((button) => {
    button.addEventListener('click', async () => {
      const code = button.closest('.code-file')?.dataset.source || '';
      try {
        await navigator.clipboard.writeText(code);
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
