# Accumulator viewer assets

Copied from the user-supplied circular-profile CAD exports:

- `body.stl`: Accumulator v3.STL
- `gasket.stl`: Accumulator Gasket v3.STL
- `lid.stl`: Accumulator Lid v3.STL

Original mesh coordinates are preserved. STL does not encode materials, units, or assembly mates. Colors are presentation choices. The viewer uses Y as the stacking axis. For the illustrative assembled view, the body stays at Y=0, the gasket is translated by 6, and the lid by 6.79375 (body height plus the gasket flange thickness). These are display placements inferred from mesh geometry, not validated assembly constraints. Exploded offsets are 0, 15, and 30. Individual-part views preserve original geometry and fit the camera to each part.

Run the portfolio through an HTTP server; module imports and STL loading require HTTP rather than opening the HTML as a local file.
