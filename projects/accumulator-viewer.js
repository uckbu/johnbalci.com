// Local, pinned Three.js modules keep the viewer independent of third-party services.
const root = document.querySelector('.acc-viewer');
const stage = root.querySelector('.acc-stage');
const status = root.querySelector('[role="status"]');
try {
  const [THREE, { OrbitControls }, { STLLoader }] = await Promise.all([
    import('./vendor/three/three.module.min.js'),
    import('./vendor/three/OrbitControls.js'),
    import('./vendor/three/STLLoader.js'),
  ]);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0, 0);
  stage.append(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Accumulator 3D model. Arrow keys rotate, plus and minus zoom, R resets.');
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x526079, 2.6));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(40, 90, 60);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc0d9ff, 1.8);
  fill.position.set(-60, 20, -40);
  scene.add(fill);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 2000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.zoomSpeed = .7;
  const assembly = new THREE.Group();
  scene.add(assembly);
  const loader = new STLLoader();
  const specs = [
    { id: 'body', color: 0xa6b6c7, assembled: 0, exploded: 0 },
    { id: 'gasket', color: 0x557c86, assembled: 6, exploded: 15 },
    { id: 'lid', color: 0xc6ced7, assembled: 6.79375, exploded: 30 },
  ];
  const parts = await Promise.all(specs.map(async spec => {
    const geometry = await loader.loadAsync(new URL(`./models/accumulator/${spec.id}.stl`, import.meta.url).href);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: spec.color, metalness: spec.id === 'gasket' ? .05 : .3, roughness: .48,
    }));
    mesh.name = spec.id;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 32), new THREE.LineBasicMaterial({ color: 0x344556, transparent: true, opacity: .24 }));
    mesh.add(edges);
    assembly.add(mesh);
    return { ...spec, mesh };
  }));
  let selected = 'exploded';
  let radius = 1;
  const render = () => renderer.render(scene, camera);
  function fit(reset = true) {
    const bounds = new THREE.Box3();
    parts.filter(part => part.mesh.visible).forEach(part => bounds.expandByObject(part.mesh));
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    radius = sphere.radius;
    const angle = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(camera.aspect, 1));
    const distance = radius / Math.sin(angle) * 1.15;
    const direction = reset ? new THREE.Vector3(1, 1.05, 1.4).normalize() : camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(direction, distance);
    controls.minDistance = radius * .45;
    controls.maxDistance = distance * 4;
    camera.near = radius / 1000;
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }
  function view(value) {
    selected = value;
    parts.forEach(part => {
      part.mesh.visible = value === 'assembled' || value === 'exploded' || value === part.id;
      part.mesh.position.y = value === 'exploded' ? part.exploded : value === 'assembled' ? part.assembled : 0;
    });
    root.querySelectorAll('[data-model-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.modelView === value)));
    canvas.setAttribute('aria-label', `Accumulator ${value} view. Arrow keys rotate, plus and minus zoom, R resets.`);
    fit();
  }
  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
    render();
  }
  root.querySelectorAll('[data-model-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.modelView)));
  root.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.camera === 'reset') fit();
    else zoom(button.dataset.camera === 'in' ? .8 : 1.25);
  }));
  canvas.addEventListener('keydown', event => {
    const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (arrows.includes(event.key)) {
      event.preventDefault();
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if (event.key === 'ArrowLeft') spherical.theta -= .12;
      if (event.key === 'ArrowRight') spherical.theta += .12;
      if (event.key === 'ArrowUp') spherical.phi -= .12;
      if (event.key === 'ArrowDown') spherical.phi += .12;
      spherical.makeSafe();
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      controls.update(); render();
    } else if (['+', '=', '-','r','R'].includes(event.key)) {
      event.preventDefault();
      if (event.key.toLowerCase() === 'r') fit();
      else zoom(event.key === '-' ? 1.25 : .8);
    }
  });
  controls.addEventListener('change', render);
  new ResizeObserver(() => {
    const width = stage.clientWidth, height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fit(false);
  }).observe(stage);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    status.textContent = 'The 3D view was interrupted. Reload the page to restore it.';
    status.hidden = false;
  });
  view(selected);
  root.querySelectorAll('button').forEach(button => button.disabled = false);
  status.hidden = true;
  root.dataset.loaded = 'true';
} catch (error) {
  status.textContent = 'The 3D model could not load. Please reload using a browser with WebGL enabled.';
  root.dataset.loaded = 'error';
  console.error('Accumulator viewer:', error);
}
