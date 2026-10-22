import * as THREE from "../vendor/three.module.js";

export function mergeStatic(root) {
  root.updateWorldMatrix(true, true);
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const toRemove = [];

  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh) return;
    if (object.userData.noMerge) return;
    if (!object.geometry || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.length !== 1 || materials[0].transparent) return;
    let parent = object;
    while (parent && parent !== root) {
      if (parent.userData.dynamic) return;
      parent = parent.parent;
    }
    const material = materials[0];
    const key = `${material.uuid}|${object.castShadow ? 1 : 0}|${object.receiveShadow ? 1 : 0}|${object.renderOrder}`;
    let group = groups.get(key);
    if (!group) {
      group = { material, cast: object.castShadow, receive: object.receiveShadow, renderOrder: object.renderOrder, items: [] };
      groups.set(key, group);
    }
    const local = new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld);
    let geometry = object.geometry.clone();
    if (geometry.index) geometry = geometry.toNonIndexed();
    geometry.applyMatrix4(local);
    if (!geometry.getAttribute("uv")) {
      const count = geometry.getAttribute("position").count;
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
    group.items.push(geometry);
    toRemove.push(object);
  });

  for (const group of groups.values()) {
    let vertexCount = 0;
    for (const geo of group.items) vertexCount += geo.getAttribute("position").count;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    let offset = 0;
    for (const geo of group.items) {
      const pos = geo.getAttribute("position");
      const norm = geo.getAttribute("normal");
      const uv = geo.getAttribute("uv");
      positions.set(pos.array, offset * 3);
      normals.set(norm.array, offset * 3);
      uvs.set(uv.array, offset * 2);
      offset += pos.count;
      geo.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new THREE.Mesh(merged, group.material);
    mesh.castShadow = group.cast;
    mesh.receiveShadow = group.receive;
    mesh.renderOrder = group.renderOrder;
    root.add(mesh);
  }

  for (const object of toRemove) {
    if (object.parent) object.parent.remove(object);
  }
}
