import * as THREE from 'three';

/**
 * Creates an authentic, razor-sharp 32-panel truncated icosahedron (classic Telstar soccer ball)
 * with puffed leather panels, sunken stitched seams, and optimized BufferGeometries.
 */
export function buildFootballMesh(radius = 1.85, texture = null) {
  const phi = (1 + Math.sqrt(5)) / 2;

  // 12 vertices of regular icosahedron
  const rawIcoVerts = [
    [-1,  phi, 0], [ 1,  phi, 0], [-1, -phi, 0], [ 1, -phi, 0],
    [ 0, -1,  phi], [ 0,  1,  phi], [ 0, -1, -phi], [ 0,  1, -phi],
    [ phi, 0, -1], [ phi, 0,  1], [-phi, 0, -1], [-phi, 0,  1],
  ];

  const icoVerts = rawIcoVerts.map(v => new THREE.Vector3(...v).normalize());

  const icoFaces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ];

  function getEdgePoint(v1, v2, factor) {
    return new THREE.Vector3().lerpVectors(v1, v2, factor).normalize();
  }

  // 20 Hexagon face vertices on unit sphere
  const hexagons = [];
  for (const [aIdx, bIdx, cIdx] of icoFaces) {
    const A = icoVerts[aIdx];
    const B = icoVerts[bIdx];
    const C = icoVerts[cIdx];

    const h0 = getEdgePoint(A, B, 1/3);
    const h1 = getEdgePoint(A, B, 2/3);
    const h2 = getEdgePoint(B, C, 1/3);
    const h3 = getEdgePoint(B, C, 2/3);
    const h4 = getEdgePoint(C, A, 1/3);
    const h5 = getEdgePoint(C, A, 2/3);

    hexagons.push([h0, h1, h2, h3, h4, h5]);
  }

  // 12 Pentagon face vertices on unit sphere
  const pentagons = [];
  for (let vIdx = 0; vIdx < 12; vIdx++) {
    const V = icoVerts[vIdx];
    const incidentFaces = icoFaces.filter(f => f.includes(vIdx));
    const neighbors = new Set();
    incidentFaces.forEach(f => {
      f.forEach(i => {
        if (i !== vIdx) neighbors.add(i);
      });
    });

    const neighborList = Array.from(neighbors);
    const ref = icoVerts[neighborList[0]].clone().sub(V.clone().multiplyScalar(icoVerts[neighborList[0]].dot(V))).normalize();
    const bitan = new THREE.Vector3().crossVectors(V, ref).normalize();

    neighborList.sort((i1, i2) => {
      const p1 = icoVerts[i1].clone().sub(V.clone().multiplyScalar(icoVerts[i1].dot(V))).normalize();
      const p2 = icoVerts[i2].clone().sub(V.clone().multiplyScalar(icoVerts[i2].dot(V))).normalize();
      const ang1 = Math.atan2(p1.dot(bitan), p1.dot(ref));
      const ang2 = Math.atan2(p2.dot(bitan), p2.dot(ref));
      return ang1 - ang2;
    });

    const pVerts = neighborList.map(nIdx => getEdgePoint(V, icoVerts[nIdx], 1/3));
    pentagons.push(pVerts);
  }

  /**
   * Helper to build a puffed, beveled polygon geometry
   * N = 5 or 6 vertices
   */
  function buildPolygonsBufferGeometry(polygonList, puffAmount = 0.026, insetFactor = 0.972) {
    const positions = [];
    const normals = [];
    const uvs = [];

    for (const poly of polygonList) {
      const N = poly.length;
      // Calculate face center
      const center = new THREE.Vector3();
      poly.forEach(p => center.add(p));
      center.divideScalar(N).normalize();

      // Puffed center coordinate - gives authentic inflated curvature
      const centerPuffed = center.clone().multiplyScalar(radius * (1.0 + puffAmount));

      // Local tangent space for texture mapping
      const up = Math.abs(center.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const tangent = new THREE.Vector3().crossVectors(up, center).normalize();
      const bitangent = new THREE.Vector3().crossVectors(center, tangent).normalize();

      // Build slightly inset rim vertices for crisp seams
      const rimVertices = poly.map(p => {
        const inset = new THREE.Vector3().lerpVectors(p, center, 1.0 - insetFactor).normalize();
        return inset.multiplyScalar(radius * (1.0 + puffAmount * 0.28));
      });

      // Triangulate the face as a fan from puffed center with edge midpoints for smooth curvature
      for (let i = 0; i < N; i++) {
        const vRim1 = rimVertices[i];
        const vRim2 = rimVertices[(i + 1) % N];

        // Mid-point on the curved edge for smoother spherical puffing
        const edgeMid = new THREE.Vector3().addVectors(vRim1, vRim2).multiplyScalar(0.5).normalize();
        edgeMid.multiplyScalar(radius * (1.0 + puffAmount * 0.42));

        // Subdivided triangles: center -> vRim1 -> edgeMid, center -> edgeMid -> vRim2
        const triPairs = [
          [centerPuffed, vRim1, edgeMid],
          [centerPuffed, edgeMid, vRim2]
        ];

        for (const [p1, p2, p3] of triPairs) {
          positions.push(p1.x, p1.y, p1.z);
          positions.push(p2.x, p2.y, p2.z);
          positions.push(p3.x, p3.y, p3.z);

          // Calculate face normal
          const cb = new THREE.Vector3().subVectors(p3, p2);
          const ab = new THREE.Vector3().subVectors(p1, p2);
          const faceNormal = new THREE.Vector3().crossVectors(cb, ab).normalize();

          // Blend spherical normal with face normal for crisp highlights
          const n1 = p1.clone().normalize().lerp(faceNormal, 0.35).normalize();
          const n2 = p2.clone().normalize().lerp(faceNormal, 0.35).normalize();
          const n3 = p3.clone().normalize().lerp(faceNormal, 0.35).normalize();

          normals.push(n1.x, n1.y, n1.z);
          normals.push(n2.x, n2.y, n2.z);
          normals.push(n3.x, n3.y, n3.z);

          // UV coordinates projected on tangent plane (centered at (0.5, 0.5))
          const uvScale = 0.52;
          [p1, p2, p3].forEach(p => {
            const rel = p.clone().sub(centerPuffed);
            const u = 0.5 + rel.dot(tangent) * uvScale;
            const v = 0.5 + rel.dot(bitangent) * uvScale;
            uvs.push(u, v);
          });
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geom;
  }

  // Create Hexagons (White panels) Geometry
  const hexGeom = buildPolygonsBufferGeometry(hexagons, 0.026, 0.972);

  // Create Pentagons (Black panels) Geometry
  const pentGeom = buildPolygonsBufferGeometry(pentagons, 0.026, 0.972);

  // Configure leather texture wrapping
  if (texture) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.0, 2.0);
  }

  // 1. White Hexagons Material - Razor-sharp, clean, crisp FIFA white
  const whiteMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xf6f8fa),
    roughness: 0.30,
    metalness: 0.02,
    bumpMap: texture,
    bumpScale: 0.0035, // Subtle tactile leather grain without artificial blur
    side: THREE.DoubleSide,
  });

  // 2. Black Pentagons Material - Deep rich leather black with distinct contrast
  const blackMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x101215),
    roughness: 0.36,
    metalness: 0.04,
    bumpMap: texture,
    bumpScale: 0.0035,
    side: THREE.DoubleSide,
  });

  // 3. Inner Seam sphere (recessed dark grooves between panels)
  const seamGeom = new THREE.SphereGeometry(radius * 0.995, 64, 64);
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x060709),
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const whiteMesh = new THREE.Mesh(hexGeom, whiteMaterial);
  const blackMesh = new THREE.Mesh(pentGeom, blackMaterial);
  const seamMesh = new THREE.Mesh(seamGeom, seamMaterial);

  whiteMesh.castShadow = true;
  blackMesh.castShadow = true;

  const footballGroup = new THREE.Group();
  footballGroup.add(seamMesh);
  footballGroup.add(whiteMesh);
  footballGroup.add(blackMesh);

  return footballGroup;
}
