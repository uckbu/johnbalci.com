# Three.js

Vendored Three.js 0.170.0 from https://www.npmjs.com/package/three/v/0.170.0 (MIT; see LICENSE).

Includes three.module.min.js, OrbitControls.js, and STLLoader.js. The two addon imports have been changed from the bare `three` module specifier to `./three.module.min.js` for a self-contained static site. No CDN requests are made by the viewer.
