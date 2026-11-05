(() => {
  'use strict';
  const keys = [12, 42, 77, 109, 139, 168, 205, 236, 263, 291, 322, 348].map((hash, index) => ({ id: `k${index}`, hash }));
  // Fixed toy hash outputs. Existing token positions never change with membership.
  const positions = {
    A: [40, 150, 257, 15, 183, 315], B: [100, 210, 350, 62, 223, 337],
    C: [290, 78, 198, 93, 242, 132], D: [160, 212, 326, 30, 155, 305]
  };
  const initial = ['A', 'B', 'C'];
  const members = scenario => scenario === 'remove' ? ['A', 'C'] : ['A', 'B', 'C', 'D'];
  function tokens(servers, count) {
    return servers.flatMap(owner => positions[owner].slice(0, count).map((position, index) => ({ owner, position, id: `${owner}${index}` }))).sort((a, b) => a.position - b.position);
  }
  function successor(hash, list) { return list.find(token => token.position >= hash) || list[0]; }
  function assignment(servers, count = 1, mode = 'ring') {
    const list = tokens(servers, count);
    return Object.fromEntries(keys.map(key => [key.id, mode === 'modulo' ? servers[key.hash % servers.length] : successor(key.hash, list).owner]));
  }
  function changed(before, after) { return keys.filter(key => before[key.id] !== after[key.id]).map(key => key.id); }
  function distribution(servers, placement) { return Object.fromEntries(servers.map(owner => [owner, keys.filter(key => placement[key.id] === owner).length])); }
  const model = Object.freeze({ keys, positions, initial, members, tokens, successor, assignment, changed, distribution });
  if (typeof module === 'object' && module.exports) module.exports = model;
  else window.ConsistentHashingModel = model;
})();
