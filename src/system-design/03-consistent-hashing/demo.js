(() => {
  'use strict';
  const root = document.querySelector('#design-lesson');
  const model = window.ConsistentHashingModel;
  const scene = root.querySelector('#scene');
  const scenarioSelect = root.querySelector('#membership');
  const keySelect = root.querySelector('#selected-key');
  const virtualSelect = root.querySelector('#virtual-count');
  keySelect.replaceChildren(...model.keys.map(key => {
    const option = document.createElement('option'); option.value = key.id; option.textContent = `${key.id} (${key.hash})`; return option;
  }));
  const params = new URLSearchParams(location.search);
  let config = {
    scenario: params.get('membership') === 'remove' ? 'remove' : 'add',
    key: model.keys.some(key => key.id === params.get('key')) ? params.get('key') : 'k1',
    virtual: [1, 3, 6].includes(Number(params.get('vnodes'))) ? Number(params.get('vnodes')) : 3
  };
  scenarioSelect.value = config.scenario; keySelect.value = config.key; virtualSelect.value = String(config.virtual);

  function syncQuery() {
    const url = new URL(location.href);
    url.searchParams.set('membership', config.scenario);
    url.searchParams.set('key', config.key);
    url.searchParams.set('vnodes', String(config.virtual));
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }
  syncQuery();
  function createFrames() {
    const before = model.initial, after = model.members(config.scenario);
    const basicBefore = model.assignment(before), basicAfter = model.assignment(after);
    const moduloBefore = model.assignment(before, 1, 'modulo'), moduloAfter = model.assignment(after, 1, 'modulo');
    const virtualBefore = model.assignment(before, config.virtual), virtualAfter = model.assignment(after, config.virtual);
    const ringMoved = model.changed(basicBefore, basicAfter), moduloMoved = model.changed(moduloBefore, moduloAfter);
    const vMoved = model.changed(virtualBefore, virtualAfter);
    const selected = model.keys.find(key => key.id === config.key);
    const oldOwner = basicBefore[selected.id];
    const migrationKey = model.keys.find(key => ringMoved.includes(key.id));
    const movement = config.scenario === 'add' ? '加入 D' : '计划移除 B';
    const changeList = (ids, oldMap, newMap) => ids.map(id => `${id}: ${oldMap[id]} → ${newMap[id]}`).join('\n') || '没有 key 改变归属';
    const counts = (servers, map) => Object.entries(model.distribution(servers, map)).map(([owner, count]) => `${owner}: ${count}`).join('  ');
    const frames = [
      {
        key: 'scope', title: '先让请求找到正确的服务器', phase: '需求 / 分区',
        why: '将不同 key 分散到服务器 A、B、C。Client 通过路由层查找归属；我们希望扩容时，只有必要的 key 换主人。',
        evidence: 'Client → Router → Server\n初始成员：A、B、C\n固定样本：k0 … k11',
        tradeoff: '先讨论分区和计划中的成员变化。图中没有副本，不能因为有哈希环就宣称容错或数据不会丢失。',
        change: '同一份成员配置必须对同一个 key 得到相同归属。',
        state: { mode: 'modulo', servers: before, placement: moduloBefore, note: '固定 12 个 key；所有客户端使用相同配置' }
      },
      {
        key: 'modulo', title: '固定成员时，取模很直接', phase: '最小设计 / 取模',
        why: '将散列值对服务器数量取模，再按成员列表选服务器。成员列表的顺序也属于配置，必须一致。',
        evidence: `servers = [A, B, C]\nowner = servers[hash % 3]\n\n${selected.id}: ${selected.hash} % 3 = ${selected.hash % 3}\n归属 ${moduloBefore[selected.id]}`,
        tradeoff: '这个规则依赖服务器数量 N；成员变化后，很多原本健康的服务器上的 key 也会改归属。',
        change: `${selected.id} 的散列值是 ${selected.hash}，取模后访问服务器 ${moduloBefore[selected.id]}。`,
        state: { mode: 'modulo', servers: before, placement: moduloBefore, selected: selected.id, route: true, note: '成员不变：每次得到同一结果' }
      },
      {
        key: 'modulo', title: '改变 N，许多余数随之变化', phase: '成员变化 / 取模',
        why: `${movement}以后，散列值没有变，但除数从 3 变为 ${after.length}。逐个重新计算，找出实际改归属的 key。`,
        evidence: `成员：[${before.join(', ')}] → [${after.join(', ')}]\n改变归属：${moduloMoved.length} / 12\n${changeList(moduloMoved, moduloBefore, moduloAfter)}`,
        tradeoff: '若只是把请求切到新归属，没有搬数据，新服务器可能找不到旧值。这个问题不仅影响被移除节点上的 key。',
        change: `取模方案有 ${moduloMoved.length} / 12 个 key 需要重新路由；加粗标记表示这些 key。`,
        state: { mode: 'modulo', servers: after, placement: moduloAfter, old: moduloBefore, moved: moduloMoved, note: `取模改变 ${moduloMoved.length} / 12；对照环为 ${ringMoved.length} / 12` }
      },
      {
        key: 'ring', title: '把节点固定在一个环上', phase: '改进 / 哈希环',
        why: '将散列空间首尾相接。服务器有自己的固定位置，不再用服务器数量当除数。先给每台服务器一个节点。',
        evidence: '空间：0 … 359，之后回到 0\nA0 = 40\nB0 = 100\nC0 = 290',
        tradeoff: '这些是教学用的预设散列结果。真实系统需要合适的散列函数，并让各路由实例共享相同成员与节点位置。',
        change: '小圆点 k0…k11 是固定的 key 位置；节点 A0、B0、C0 决定各自负责的区间。',
        state: { mode: 'ring', servers: before, placement: basicBefore, virtual: 1, note: '圆点是 key；带形状的节点属于右侧物理服务器' }
      },
      {
        key: 'ring', title: '请求先定位自己的 key', phase: '读取 / 定位',
        why: '收到读取请求后，先计算 key 的位置。更换查询 key 只改变请求，不改变环或其他 key 的位置。',
        evidence: `GET(${selected.id})\nhash(${selected.id}) = ${selected.hash}\n\n从位置 ${selected.hash} 开始找后继节点`,
        tradeoff: '这里模拟的是路由查找，还没有向存储节点读取数据。节点表可以排序后用二分查找，不必真的沿圆圈逐个扫描。',
        change: `定位 ${selected.id}，它在 ${selected.hash}；下一步沿顺时针方向找节点。`,
        state: { mode: 'ring', servers: before, placement: basicBefore, virtual: 1, selected: selected.id, note: `${selected.id} @ ${selected.hash}；归属尚待后继查找` }
      },
      {
        key: 'ring', title: '顺时针第一个节点负责这个 key', phase: '读取 / 路由',
        why: '在有序节点表中找到位置大于等于 key 的第一个节点。若到末尾仍未找到，就回到第一个节点。虚拟节点最终指向物理服务器。',
        evidence: `successor(${selected.hash})\n→ ${model.successor(selected.hash, model.tokens(before, 1)).id}\n→ 物理服务器 ${oldOwner}\n\nGET(${selected.id}) → ${oldOwner}`,
        tradeoff: '客户端拿到的成员配置若不一致，同一个 key 可能被路由到不同服务器；配置传播也属于系统设计。',
        change: `${selected.id} 顺时针遇到 ${oldOwner}0，因此读取请求发给 ${oldOwner}。`,
        state: { mode: 'ring', servers: before, placement: basicBefore, virtual: 1, selected: selected.id, route: true, note: `${selected.id} → ${oldOwner}；越过 359 时从 0 继续` }
      },
      {
        key: 'migration', title: '成员变化，只改相邻区间的归属', phase: '设计变更 / 重路由',
        why: `${movement}时，旧节点与 key 的坐标都不变。变化来自顺时针后继被替换，因此只有对应区间的 key 换主人。`,
        evidence: `环改变 ${ringMoved.length} / 12\n取模改变 ${moduloMoved.length} / 12\n\n${changeList(ringMoved, basicBefore, basicAfter)}`,
        tradeoff: '这是本组固定输入的精确计数，不是任意负载的比例保证。图中展示新归属计划，还没有完成数据迁移。',
        change: `环上 ${ringMoved.join('、')} 改变归属；其他 key 留在原服务器。`,
        state: { mode: 'ring', servers: after, placement: basicAfter, virtual: 1, old: basicBefore, moved: ringMoved, note: `环改变 ${ringMoved.length} / 12；取模改变 ${moduloMoved.length} / 12` }
      },
      {
        key: 'migration', title: '只切路由，新归属可能没有值', phase: '边界 / 迁移尚未完成',
        why: `以 ${migrationKey.id} 为例，旧值还在 ${basicBefore[migrationKey.id]}。如果立即按新规则访问 ${basicAfter[migrationKey.id]}，就可能读到 MISS。计算归属不会传输数据。`,
        evidence: `${migrationKey.id} 的路由：${basicBefore[migrationKey.id]} → ${basicAfter[migrationKey.id]}\n旧归属：value 已存在\n新归属：value 尚未复制\n\n提前切换 → MISS`,
        tradeoff: '本例是计划迁移，旧节点仍可读取。如果节点真正故障且没有副本，哈希环不能找回丢失的数据。',
        change: `读取 ${migrationKey.id} 被提前发往 ${basicAfter[migrationKey.id]}，路由算对了，但新节点尚无数据。`,
        state: { mode: 'ring', servers: after, placement: basicAfter, virtual: 1, selected: migrationKey.id, route: true, old: basicBefore, moved: ringMoved, value: 'MISS / 未复制', note: '新归属 ≠ 数据已经在新节点' }
      },
      {
        key: 'migration', title: '先准备数据，再完成路由切换', phase: '改进 / 迁移协议',
        why: `在旧节点仍可用的计划迁移中，将受影响的 key 从旧归属复制到新归属，再协调切换。本演示仅展示静态值；并发写入需要额外的增量同步。`,
        evidence: '准备新节点\n复制受影响 key 的值\n校验完整性 / 追平增量写入\n切换路由配置\n最后清理旧副本',
        tradeoff: '环只回答“该搬哪些 key、搬给谁”。这里列出迁移协议的职责，并未实现网络复制、原子切换或故障恢复。',
        change: `${migrationKey.id} 的静态值已准备在 ${basicAfter[migrationKey.id]}；现在新路由能找到它。`,
        state: { mode: 'ring', servers: after, placement: basicAfter, virtual: 1, selected: migrationKey.id, route: true, old: basicBefore, moved: ringMoved, value: 'value 已准备', note: '计划迁移：数据准备完成后再切换' }
      },
      {
        key: 'virtual', title: '一个节点对应的区间可能很不均匀', phase: '分布 / 单节点',
        why: '不同服务器占据的环区间大小不同，样本 key 也不均匀。先用原始 A、B、C 成员重新观察，避免把扩容和虚拟节点的效果混在一起。',
        evidence: `每台 1 个节点\n${counts(before, basicBefore)}\n\n同一组 12 个 key`,
        tradeoff: 'key 数不是访问量。即使每台 key 数相同，一条极热 key 也能让它所在的服务器过载。',
        change: '回到初始成员，统计各台服务器负责的 key 数。',
        state: { mode: 'ring', servers: before, placement: basicBefore, virtual: 1, note: `单节点分布：${counts(before, basicBefore)}` }
      },
      {
        key: 'virtual', title: '让每台服务器负责多个分散区间', phase: '改进 / 虚拟节点',
        why: `现在每台物理服务器对应 ${config.virtual} 个固定节点。后继节点仍按相同规则查找，但节点先映射回它所属的物理服务器。`,
        evidence: `每台 ${config.virtual} 个虚拟节点\n${counts(before, virtualBefore)}\n\n${selected.id} → ${model.successor(selected.hash, model.tokens(before, config.virtual)).id} → ${virtualBefore[selected.id]}`,
        tradeoff: '更多虚拟节点通常能降低分区大小的波动，也增加路由表和迁移管理成本。有限样本不保证每次增加节点都更均匀。',
        change: `仍然只有 A、B、C 三台物理服务器，环上有 ${before.length * config.virtual} 个节点。`,
        state: { mode: 'ring', servers: before, placement: virtualBefore, virtual: config.virtual, selected: selected.id, route: true, note: `${config.virtual} 节点 / 台；物理服务器仍为 3 台` }
      },
      {
        key: 'virtual', title: '虚拟节点也必须保持稳定坐标', phase: '成员变化 / 多个区间',
        why: `${movement}时，变更节点的多个区间分别重新归属；其他节点坐标保持不变。逐个 key 比较配置变更前后，而不是把重建整张环当作扩容。`,
        evidence: `每台 ${config.virtual} 个节点\n改变归属 ${vMoved.length} / 12\n${changeList(vMoved, virtualBefore, virtualAfter)}`,
        tradeoff: '虚拟节点增减本身也可能触发迁移。它不是免费提高均匀度的开关，仍需要同样的数据准备和配置切换。',
        change: `新配置有 ${after.length} 台服务器、${after.length * config.virtual} 个节点，${vMoved.length} 个 key 改变归属。`,
        state: { mode: 'ring', servers: after, placement: virtualAfter, virtual: config.virtual, old: virtualBefore, moved: vMoved, note: `多区间变更：${vMoved.length} / 12 个 key 重新归属` }
      },
      {
        key: 'virtual', title: '分区规则之外，还要设计什么', phase: '回顾 / 边界',
        why: '一致性哈希减少成员变化导致的重路由。它没有自动提供复制、持久化、一致性或热点 key 的拆分。把这些职责分开，才能知道下一步要解决什么。',
        evidence: `${selected.id} 始终归属 ${virtualAfter[selected.id]}\n即使它占大多数请求，也不会自动分流\n\n下一步：副本 / 缓存 / 热点拆分`,
        tradeoff: '对只读热点可以考虑复制或缓存；可变数据需要额外的一致性方案。不能把虚拟节点数量当作可用性的证明。',
        change: '路由、搬迁、复制与热点治理是不同问题；这张环只实现前者的归属计算。',
        state: { mode: 'ring', servers: after, placement: virtualAfter, virtual: config.virtual, selected: selected.id, route: true, note: `热点 ${selected.id} 的请求仍集中到 ${virtualAfter[selected.id]}` }
      }
    ];
    return frames.map((frame, index) => ({ ...frame, sourceKeys: [frame.key], stepLabel: `${index + 1}. ${frame.title}` }));
  }

  function point(position, radius = 120) {
    const angle = (position - 90) * Math.PI / 180;
    return { x: 220 + Math.cos(angle) * radius, y: 220 + Math.sin(angle) * radius };
  }
  function tokenShape(owner, x, y, size, className) {
    if (owner === 'A') return `<circle class="${className}" cx="${x}" cy="${y}" r="${size}"/>`;
    if (owner === 'B') return `<rect class="${className}" x="${x - size}" y="${y - size}" width="${size * 2}" height="${size * 2}"/>`;
    if (owner === 'C') return `<path class="${className}" d="M${x} ${y - size} L${x + size} ${y} L${x} ${y + size} L${x - size} ${y} Z"/>`;
    return `<path class="${className}" d="M${x} ${y - size} L${x + size} ${y + size} L${x - size} ${y + size} Z"/>`;
  }
  function renderScene(state) {
    const selected = model.keys.find(key => key.id === state.selected);
    const owner = selected ? state.placement[selected.id] : null;
    let drawing = `<g class="routing-figures"><use class="system-figure" href="../assets/system-figures.svg#client" x="25" y="12" width="46" height="46"/><text x="106" y="41">Client</text><use class="system-figure" href="../assets/system-figures.svg#router" x="185" y="12" width="46" height="46"/><text x="291" y="41">Router</text></g><path class="route-path" d="M145 35 H179"/><text class="route-label" x="670" y="76">${selected ? `GET(${selected.id})` : '同一配置，同一归属'}</text>`;
    if (state.mode === 'ring') {
      drawing += '<circle class="hash-ring" cx="220" cy="220" r="120"/>';
      for (const key of model.keys) {
        const dot = point(key.hash, 145), label = point(key.hash, 170), inner = point(key.hash);
        // Keep the two top labels clear of the router and their key markers.
        if (label.y < 75) {
          label.y = 73;
          label.x += label.x < 220 ? -18 : 18;
        }
        const moved = state.moved?.includes(key.id);
        drawing += `<g class="hash-key${moved ? ' is-moved' : ''}${key.id === state.selected ? ' is-selected' : ''}" data-key="${key.id}" data-hash="${key.hash}" data-owner="${state.placement[key.id]}" data-old-owner="${state.old?.[key.id] || state.placement[key.id]}" data-moved="${Boolean(moved)}"><line x1="${inner.x}" y1="${inner.y}" x2="${dot.x}" y2="${dot.y}"/><circle cx="${dot.x}" cy="${dot.y}" r="5"/><text x="${label.x}" y="${label.y + 5}">${key.id}</text></g>`;
      }
      const tokens = model.tokens(state.servers, state.virtual);
      const chosenToken = selected && state.route ? model.successor(selected.hash, tokens) : null;
      for (const token of tokens) {
        const position = point(token.position), label = point(token.position, 95);
        drawing += `<g data-token="${token.id}" data-position="${token.position}" data-physical-owner="${token.owner}"><title>${token.id}，位置 ${token.position}，物理服务器 ${token.owner}</title>${tokenShape(token.owner, position.x, position.y, state.virtual === 1 ? 8 : 5, `server-token${chosenToken?.id === token.id ? ' selected-token' : ''}`)}${state.virtual === 1 ? `<text class="token-label" x="${label.x}" y="${label.y + 5}">${token.id}</text>` : ''}</g>`;
      }
      if (chosenToken) {
        const start = point(selected.hash, 127), end = point(chosenToken.position, 127);
        const distance = (chosenToken.position - selected.hash + 360) % 360;
        drawing += `<path class="lookup-path" d="M${start.x} ${start.y} A127 127 0 ${distance > 180 ? 1 : 0} 1 ${end.x} ${end.y}"/>`;
      }
      drawing += `<text class="ring-center" x="220" y="208">${state.route && selected ? `${selected.id} → ${chosenToken.id}` : '顺时针找后继'}</text><text class="ring-detail" x="220" y="237">${state.virtual} 节点 / 台</text>`;
    } else {
      drawing += `<text class="formula" x="220" y="135">hash(key) % ${state.servers.length}</text><text class="ring-detail" x="220" y="165">成员：[${state.servers.join(', ')}]</text>`;
      model.keys.forEach((key, index) => {
        const x = 55 + (index % 3) * 115, y = 213 + Math.floor(index / 3) * 43;
        const moved = state.moved?.includes(key.id);
        drawing += `<g class="hash-key${moved ? ' is-moved' : ''}${key.id === state.selected ? ' is-selected' : ''}" data-key="${key.id}" data-hash="${key.hash}" data-owner="${state.placement[key.id]}" data-old-owner="${state.old?.[key.id] || state.placement[key.id]}" data-moved="${Boolean(moved)}"><circle cx="${x - 23}" cy="${y - 5}" r="5"/><text x="${x + 17}" y="${y}">${key.id} → ${state.placement[key.id]}</text></g>`;
      });
    }
    ['A', 'B', 'C', 'D'].forEach((server, index) => {
      const x = 455 + (index % 2) * 215, y = 100 + Math.floor(index / 2) * 145;
      const assigned = model.keys.filter(key => state.placement[key.id] === server).map(key => key.id);
      const present = state.servers.includes(server);
      const parts = [assigned.slice(0, 4), assigned.slice(4, 8), assigned.slice(8)];
      drawing += `<g class="server${server === owner && state.route ? ' is-selected' : ''}${present ? '' : ' is-absent'}" data-server="${server}" data-present="${present}" data-key-count="${assigned.length}" data-keys="${assigned.join(',')}"><rect class="server-box" x="${x}" y="${y}" width="190" height="125" rx="4"/><use class="system-figure" href="../assets/system-figures.svg#server" x="${x + 9}" y="${y + 8}" width="46" height="46"/>${tokenShape(server, x + 173, y + 27, 6, 'server-token')}<text x="${x + 110}" y="${y + 30}">Server ${server}</text><text class="owner-count" x="${x + 110}" y="${y + 53}">${present ? `${assigned.length} 个 key` : '不在当前配置'}</text><path class="server-divider" d="M${x + 12} ${y + 64} H${x + 178}"/>${parts.map((part, row) => `<text class="owner-keys" x="${x + 95}" y="${y + 87 + row * 18}">${part.join(' ') || (row === 0 && present ? '空' : '')}</text>`).join('')}</g>`;
    });
    if (owner && state.route) {
      const index = ['A', 'B', 'C', 'D'].indexOf(owner), x = 550 + (index % 2) * 215, y = 100 + Math.floor(index / 2) * 145;
      const path = index < 2 ? `M350 35 H${x} V${y - 6}` : index === 2 ? 'M350 35 H425 V275 H449' : 'M350 35 H885 V275 H866';
      drawing += `<path class="route-path" d="${path}"/>`;
    }
    if (state.value) drawing += `<text class="new-value" x="670" y="390" data-value-status>${state.value}</text>`;
    drawing += `<text class="diagram-summary" x="450" y="418">${state.note}</text>`;
    scene.innerHTML = drawing;
  }
  const trace = window.AlgorithmVisualCore.createTrace({
    root, cloneState: state => structuredClone(state), codeKeyAttribute: 'data-design-key', getCodeScroll: () => null,
    onRender: ({ frame, state }) => {
      renderScene(state);
      const values = { '#decision-title': frame.title, '#decision-why': frame.why, '#decision-evidence': frame.evidence, '#decision-tradeoff': frame.tradeoff, '#step-change': frame.change, '#drawing-stage': frame.phase, '#architecture-description': frame.change };
      for (const [selector, value] of Object.entries(values)) root.querySelector(selector).textContent = value;
    }
  });
  for (const button of root.querySelectorAll('[data-jump]')) button.addEventListener('click', () => trace.showStep(Number(button.dataset.jump)));
  root.querySelector('#restart').addEventListener('click', () => trace.setFrames(createFrames(), { initialStep: 0 }));
  for (const input of [scenarioSelect, keySelect, virtualSelect]) input.addEventListener('change', () => {
    config = { scenario: scenarioSelect.value, key: keySelect.value, virtual: Number(virtualSelect.value) };
    syncQuery(); trace.setFrames(createFrames(), { initialStep: trace.step });
  });
  root.querySelector('.design-roadmap').hidden = false;
  root.querySelector('.design-controls').hidden = false;
  trace.setFrames(createFrames());
})();
