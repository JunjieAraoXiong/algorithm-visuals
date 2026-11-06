(() => {
  'use strict';
  const root = document.querySelector('#design-lesson');
  const wSelect = root.querySelector('#write-quorum');
  const rSelect = root.querySelector('#read-quorum');
  const scenarioSelect = root.querySelector('#scenario');
  const params = new URLSearchParams(location.search);
  const quorum = value => ['1', '2', '3'].includes(value) ? Number(value) : 1;
  let W = quorum(params.get('w'));
  let R = quorum(params.get('r'));
  let scenario = params.get('scenario') === 'offline' ? 'offline' : 'lag';
  wSelect.value = String(W); rSelect.value = String(R); scenarioSelect.value = scenario;
  const clone = value => structuredClone(value);

  function buildFrames() {
    const frames = [];
    const state = {
      versions: { a: 0, b: 0, c: 0 },
      notes: { a: '在线', b: '写入排在 A 之后', c: scenario === 'offline' ? '离线，不能响应' : '写消息延迟，可响应读' },
      onlineC: scenario !== 'offline', acks: [], responses: [],
      write: '尚未开始', read: '尚未开始', returned: null, writeSucceeded: false
    };
    const add = (key, title, why, evidence, tradeoff, change, scene = {}) => {
      frames.push({ key, title, why, evidence, tradeoff, change, flows: [], active: [], request: '', ...scene,
        state: clone(state), sourceKeys: [key], stepLabel: `${frames.length + 1}. ${title}` });
    };
    add('scope', '先固定副本集合与写入顺序',
      '只讨论一个 key、一个写者和一次 v0 到 v1 的更新。三个副本身份不变，版本有确定的先后关系。',
      `key = theme\nv0 = light\nv1 = dark\nN = 3, W = ${W}, R = ${R}`,
      '这是固定副本的确定性模拟，不包含并发写、成员变更、故障替代副本或真实网络。',
      '固定 A、B、C 三个副本，初始都保存 theme=light 的 v0。');
    state.write = '等待确认';
    add('write', '向固定三副本发送 v1',
      '协调者保留这次写入，并向 A、B、C 发出请求。发出消息不代表副本已经保存，更不代表客户端已得到成功。',
      `PUT theme = dark, version = 1\n发送到：A、B、C\n成功阈值：${W} 个确认`,
      scenario === 'offline' ? 'C 离线，写消息暂时无法处理。协调者不会找替代副本凑满确认。' : 'C 的写消息延迟；它仍可响应另一路读请求。没有跨路径的到达顺序保证。',
      '发出写请求，三个副本仍是 v0，确认数仍为 0。',
      { flows: ['request', 'to-a', 'to-b', 'to-c'], active: ['coordinator'], request: 'PUT v1' });
    state.versions.a = 1; state.notes.a = '已保存 v1，尚未确认';
    add('write', 'A 先保存新版本',
      'A 把 theme 更新为 dark，并记录版本 v1。这里假设保存已经持久化；回复确认是下一次独立事件。',
      'A: v0 → v1\n已收到的确认：0',
      '保存与收到确认之间可能发生网络故障，客户端看到的结果可能落后于实际存储状态。',
      '只有 A 变为 v1；确认数没有随存储动作自动增加。', { flows: ['to-a'], active: ['a'] });
    state.acks.push('A'); state.notes.a = 'v1 已确认';
    add('write', '收到 A 的确认',
      '协调者收到 A 的成功响应，现在才把确认数加一。W 决定何时可以向客户端返回成功。',
      `确认集合：{ A }\n确认数 1 / ${W}`,
      '本例确认承诺副本保存了版本且不会丢失它；真实持久性还取决于日志与故障模型。',
      `收到第 1 个写确认；${W === 1 ? '已达到 W，可以返回成功。' : '还没有达到 W，继续等待。'}`, { flows: ['from-a'], active: ['coordinator'] });
    if (W === 1) { state.write = '成功，收到 W 个确认'; state.writeSucceeded = true; }
    add('write', W === 1 ? 'W=1，先向客户端返回成功' : `W=${W}，一个确认还不够`,
      W === 1 ? '此时成功只依赖 A 的确认。B 与 C 仍是 v0，所以“写入成功”不表示每个副本都已经更新。' : '协调者继续等 B 的写入与响应。客户端仍没有得到写入成功，不能把一个确认画成达到阈值。',
      `A=v1, B=v0, C=v0\nwrite_success = ${state.writeSucceeded}`,
      '等待更少副本可降低等待时间，但紧接着读取其他副本可能得到旧版本。',
      W === 1 ? '客户端已获成功；B、C 的存储状态仍未改变。' : '客户端仍在等待，下一步处理 B 的写消息。',
      { flows: W === 1 ? ['client-result'] : [], active: [W === 1 ? 'client' : 'coordinator'] });
    if (W > 1) { state.versions.b = 1; state.notes.b = '已保存 v1，尚未确认'; }
    add('write', W > 1 ? 'B 保存 v1' : '先开始读，B 的写消息仍在路上',
      W > 1 ? '为了等待更多确认，写操作继续处理 B 的消息。B 保存 v1；协调者尚未收到它的确认。' : 'W=1 的写操作已经返回。本例接下来的读请求先于 B 的写消息被处理，这是一种合法的延迟顺序。',
      `A=v1, B=v${state.versions.b}, C=v0\n已收确认：${state.acks.join(', ')}`,
      '网络调度是本演示的明确假设，不是 W 本身会阻止其他副本更新。W 只决定客户端等待多久。',
      W > 1 ? 'B 的版本变为 v1；确认数仍为 1。' : 'B 保持 v0，延迟写入将放在读取完成后处理。',
      { flows: W > 1 ? ['to-b'] : [], active: ['b'] });
    if (W > 1) { state.acks.push('B'); state.notes.b = 'v1 已确认'; }
    add('write', W > 1 ? '收到 B 的确认' : '确认集合仍然只有 A',
      W > 1 ? '协调者收到 B 的确认，确认集合变为 A、B。只有实际收到的响应才计入 W。' : '没有新的写确认到达。客户端的成功记录仍来自 A，不会因为画面推进就凭空增加确认。',
      `确认集合：{ ${state.acks.join(', ')} }\n确认数 ${state.acks.length} / ${W}`,
      'C 的写消息尚未到达或它处于离线状态，此时不能计算 C 的确认。',
      W > 1 ? '收到第二个写确认；C 仍保存 v0。' : '维持 1 个确认，B 与 C 仍保存 v0。',
      { flows: W > 1 ? ['from-b'] : [], active: ['coordinator'] });
    if (state.acks.length >= W) { state.writeSucceeded = true; state.write = '成功，收到 W 个确认'; }
    else state.write = '超时，结果不确定';
    add('write', state.writeSucceeded ? '写入达到要求的确认数' : '未达到 W，返回超时',
      state.writeSucceeded ? '读请求将在这次写入成功之后开始。已有成功确认的副本集合，才是讨论读写交集的依据。' : 'W=3 需要三个确认，但截止时只有 A、B。客户端得到超时；A、B 已经保存 v1，所以不能把超时解释成“写入没发生”。',
      `确认 ${state.acks.length} / ${W}\nwrite_success = ${state.writeSucceeded}\nC=v0`,
      state.writeSucceeded ? '成功之后仍可能存在旧副本。读取要选择哪些响应，决定读者能看到什么。' : '超时后的重试需要幂等性与结果确认；本例保留同一 v1，不生成第二次更新。',
      state.writeSucceeded ? '客户端拥有写入成功记录，下一步读取这个 key。' : '客户端收到超时；已保存的 v1 不会因此回滚。',
      { flows: ['client-result'], active: ['client'] });
    state.read = '等待响应';
    add('read', '读取发往三副本，收集前 R 个响应',
      '读请求发往 A、B、C。本例按 C、B、A 的顺序到达；收满 R 个响应后选最大版本，后到的响应不参与这次返回。',
      `GET theme\nR = ${R}\n响应顺序：C → B → A`,
      scenario === 'offline' ? 'C 离线，没有读响应。这里不降低 R，也不临时更换副本。' : 'C 的写入延迟，但读路径可用。它可能先返回旧的 v0。',
      '开始读请求，读响应集合为空，尚未返回任何值。',
      { flows: ['request', 'to-a', 'to-b', 'to-c'], active: ['coordinator'], request: 'GET' });
    for (const name of ['c', 'b', 'a']) {
      const online = name !== 'c' || state.onlineC;
      const accepted = online && state.responses.length < R;
      const label = name.toUpperCase();
      if (accepted) state.responses.push({ replica: label, version: state.versions[name] });
      const ready = state.responses.length === R;
      add('read', !online ? `${label} 离线，没有响应` : accepted ? `收到 ${label} 的 v${state.versions[name]}` : `${label} 的响应较晚，不改变这次候选集`,
        !online ? '等待窗口内 C 没有回复，响应数不会增加。剩余副本是否足够达到 R，取决于选择的阈值。' : accepted ? `把 ${label} 的版本加入响应集合。${ready ? '现在达到 R，候选集固定；随后比较其中的版本。' : '还没有达到 R，继续等待。'}` : '前 R 个响应已经选定，这个迟到响应不参与本次结果。它的版本更高，也不会回写已经确定的候选集。',
        `响应 ${state.responses.length} / ${R}\n${state.responses.map(reply => `${reply.replica}: v${reply.version}`).join('\n') || '无响应'}`,
        '比较的是本次收集到的版本，而不是观察者在全图中看到的全部存储值。',
        !online ? 'C 没有回复，读响应数不变。' : accepted ? `${label} 返回 v${state.versions[name]}；已收 ${state.responses.length}/${R} 个响应。` : `${label} 的迟到响应不改变前 R 个响应。`,
        { flows: online ? [`from-${name}`] : [], active: [name, 'coordinator'] });
    }
    if (state.responses.length === R) {
      state.returned = Math.max(...state.responses.map(reply => reply.version));
      state.read = `返回 v${state.returned} / ${state.returned ? 'dark' : 'light'}`;
    } else state.read = '不可用，响应不足';
    add('read', state.returned === null ? '响应不足，不返回猜测值' : state.returned === 0 ? '本次读返回旧版本 v0' : '本次读返回新版本 v1',
      state.returned === null ? '没有达到 R，客户端得到不可用结果。即使协调者收到了某些版本，也不能偷偷降低本次承诺的阈值。' : `前 ${R} 个响应的最大版本是 v${state.returned}。${state.returned === 0 ? `A 上的新版本没有进入这次候选集。${state.writeSucceeded ? '这次写入已经成功返回，随后仍然读到了旧值。' : '此前写入超时，没有获得 W 个确认。'}` : '至少一个已更新副本进入了候选集，最大版本选择返回 dark。'}`,
      `write_success = ${state.writeSucceeded}\nR + W = ${R + W}, N = 3\n${state.read}`,
      state.writeSucceeded && R + W > 3 ? '本例固定集合、无并发写且确认版本不丢失，读写集合相交，因此能看到 v1。真实线性一致性还需要完整协议。' : 'R+W≤N 允许集合不相交，但不代表每次都会读旧。未获 W 确认的写入，也不能套用成功写的交集保证。',
      state.returned === null ? '读取失败：没有足够响应，未返回值。' : `客户端收到 ${state.returned ? 'dark (v1)' : 'light (v0)'}；这次结果会作为历史保留。`,
      { flows: ['client-result'], active: ['client'] });
    state.onlineC = true; state.notes.c = '连接可用，仍是 v0';
    add('recover', scenario === 'offline' ? '恢复连接不等于恢复数据' : '让延迟的写路径恢复',
      scenario === 'offline' ? '读取结束后，C 的连接恢复。恢复网络不会直接把 v0 变成 v1；还需要明确的数据补齐操作。' : '读取结束后，允许延迟的写消息继续投递。C 原本就能响应读；写路径恢复也不会自动把 v0 变成 v1。',
      'C: online = true\nC: version = 0\n先前读结果保持不变',
      '本例协调者保留了 v1，且没有第二个写者。如果协调者也失败，需要日志与恢复协议找到可信版本。',
      'C 可以通信，但数据还是旧版本。', { active: ['c'] });
    state.versions.b = 1; state.notes.b = '补齐完成，v1';
    add('recover', '确认 B 已保存 v1',
      W === 1 ? '协调者重发或继续投递保留的同一 v1。B 把 v0 更新为 v1，不创建新版本。' : 'B 已有 v1，再次提交相同版本和值不改变结果。本例按版本幂等应用。',
      '补齐 B: (version=1, value=dark)\nB: v1\n不新增业务写入',
      '这里只演示单写者的同版本幂等应用。冲突解决、乱序旧写和重试记录需要单独设计。',
      'B 保存 v1；先前返回的读值仍保持原样。', { flows: ['to-b'], active: ['b'] });
    state.versions.c = 1; state.notes.c = '补齐完成，v1';
    add('recover', '再把 v1 补到 C',
      '将同一份 v1 发送给恢复后的 C。现在三副本都保存 dark；这次修复并不会追溯修改之前客户端看到的旧值或超时。',
      `A=v1, B=v1, C=v1\n之前的写结果：${state.write}\n之前的读结果：${state.read}`,
      '修复可收敛副本状态，但不能把历史上的旧读变成新读，也不能把先前的超时改称成功返回。',
      '三个副本收敛到 v1；原先的客户端结果作为历史保留。', { flows: ['to-c'], active: ['c'] });
    add('review', '把等待、交集与一致性分开',
      'W 与 R 控制等待多少个响应。R+W>N 给出固定集合的交集条件；本例的单写者、版本顺序与无数据丢失假设，让交集包含最新成功写入。',
      `N=3, W=${W}, R=${R}\n固定集合交集条件：R+W>3\n不能单独推出线性一致性`,
      '增加等待数会降低故障时的可用性并增加延迟。并发写、成员切换、确认丢失与协调者故障都需要进一步定义协议。',
      '完成最小副本设计：确认成功、读到版本与副本最终收敛是三件不同的事。');
    return frames;
  }

  const trace = window.AlgorithmVisualCore.createTrace({
    root, cloneState: clone, codeKeyAttribute: 'data-design-key', getCodeScroll: () => null,
    onRender: ({ frame, state }) => {
      for (const node of root.querySelectorAll('[data-node]')) node.classList.toggle('is-current', frame.active.includes(node.dataset.node));
      root.querySelector('[data-node="c"]').classList.toggle('is-offline', !state.onlineC);
      for (const flow of root.querySelectorAll('[data-flow]')) flow.toggleAttribute('hidden', !frame.flows.includes(flow.dataset.flow));
      const readStatus = state.read === '等待响应' && state.responses.length === R
        ? '候选集已定，待比较版本' : state.read;
      const fields = {
        '#decision-title': frame.title, '#decision-why': frame.why, '#decision-evidence': frame.evidence, '#decision-tradeoff': frame.tradeoff,
        '#step-change': frame.change, '#architecture-description': frame.change,
        '#drawing-stage': ({scope:'固定 N = 3',write:'写入与确认',read:'前 R 个响应',recover:'补齐版本',review:'条件与取舍'})[frame.key],
        '#policy-state': `N = 3；W = ${W}；R = ${R}`,
        '#write-count': `写确认 ${state.acks.length} / ${W}`, '#read-count': `读响应 ${state.responses.length} / ${R}`,
        '#write-result': `写入：${state.write}`, '#read-result': `读取：${readStatus}`,
        '#read-responses': `已收响应：${state.responses.map(reply => `${reply.replica}:v${reply.version}`).join('，') || '无'}`,
        '#request-label': frame.request
      };
      for (const name of ['a','b','c']) {
        fields[`#version-${name}`] = `v${state.versions[name]} / ${state.versions[name] ? 'dark' : 'light'}`;
        fields[`#state-${name}`] = state.notes[name];
      }
      for (const [selector,value] of Object.entries(fields)) root.querySelector(selector).textContent = value;
      root.querySelector('#architecture').dataset.writeSuccess = String(state.writeSucceeded);
      root.querySelector('#architecture').dataset.returnedVersion = state.returned === null ? 'none' : String(state.returned);
    }
  });
  function persist() {
    const url = new URL(location.href);
    url.searchParams.set('w', String(W)); url.searchParams.set('r', String(R)); url.searchParams.set('scenario', scenario);
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  function change() {
    W = Number(wSelect.value); R = Number(rSelect.value); scenario = scenarioSelect.value;
    persist(); trace.setFrames(buildFrames(), { initialStep: 0 });
  }
  for (const select of [wSelect,rSelect,scenarioSelect]) select.addEventListener('change', change);
  for (const button of root.querySelectorAll('[data-design-key]')) button.addEventListener('click', () => trace.showStep(trace.frames.findIndex(frame => frame.key === button.dataset.designKey)));
  root.querySelector('#restart').addEventListener('click', () => trace.showStep(0));
  persist(); root.querySelector('.design-roadmap').hidden = false; root.querySelector('.design-controls').hidden = false;
  trace.setFrames(buildFrames());
})();
