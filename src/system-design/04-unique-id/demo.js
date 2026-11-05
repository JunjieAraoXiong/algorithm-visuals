(() => {
  'use strict';
  const root = document.querySelector('#design-lesson');
  const baseTime = 1200000000000n;
  const maxSequence = 4095;
  const scenarioSelect = root.querySelector('#scenario');
  const validScenarios = ['normal', 'overflow', 'rollback'];
  const requested = new URLSearchParams(location.search).get('scenario');
  let scenario = validScenarios.includes(requested) ? requested : 'normal';
  scenarioSelect.value = scenario;
  const clone = value => JSON.parse(JSON.stringify(value));

  function compose(time, dc, machine, sequence) {
    return (BigInt(time) << 22n) | (BigInt(dc) << 17n) | (BigInt(machine) << 12n) | BigInt(sequence);
  }

  function generate(state, name) {
    const worker = state[name];
    const now = BigInt(state.clock);
    const last = worker.last === null ? null : BigInt(worker.last);
    if (last !== null && now < last) {
      state.status = '拒绝：时钟落后于已发号时间，未生成新编号';
      return null;
    }
    if (last === now && worker.sequence === maxSequence) {
      state.status = '等待：本毫秒 4096 个序号已用完，未生成新编号';
      return null;
    }
    worker.sequence = last === now ? worker.sequence + 1 : 0;
    worker.last = state.clock;
    worker.output = compose(now, 1, worker.machine, worker.sequence).toString();
    state.fields = { time: state.clock, machine: worker.machine, sequence: worker.sequence };
    state.status = `成功：Worker ${name.toUpperCase()} 发出新编号`;
    return worker.output;
  }

  function buildFrames(mode) {
    const frames = [];
    const state = {
      clock: baseTime.toString(),
      a: { machine: 1, last: null, sequence: null, output: null },
      b: { machine: 2, last: null, sequence: null, output: null },
      fields: { time: baseTime.toString(), machine: 1, sequence: 0 },
      status: '无实际网络请求，时间由演示推进'
    };
    const add = (key, title, why, evidence, tradeoff, change, options = {}) => {
      frames.push({ key, title, why, evidence, tradeoff, change, fields: [], workers: [], ...options, state: clone(state), sourceKeys: [key], stepLabel: `${frames.length + 1}. ${title}` });
    };
    add('scope', '先区分唯一与有序', '多个服务都需要创建记录。这里要求数值编号全局唯一、占用 64 位，并大致按时间排序，不要求相邻编号加一。', 'Worker A → id_a\nWorker B → id_b\n要求：id_a ≠ id_b', '时间有序不等于跨机器请求的严格先后顺序；这是模拟发号器，不连接真实时钟或服务。', '先规定：编号不能重复，能放进 64 位，并大致按时间排序。');
    add('scope', '把协调放在身份分配上', '集中式计数器简单，但每次发号都要访问它。这里采用 Snowflake 风格：每台机器本地发号，先协调各自唯一的身份。', '启动时：分配唯一 (dc, machine)\n运行时：本地时间 + 本地序列\n每次发号无须访问中央计数器', '省去逐次协调，并不等于完全没有协调。重复的机器身份、丢失的运行状态都可能破坏唯一性。', '选择按字段拼接编号；两台 Worker 是独立的发号实例。', { workers: ['a', 'b'] });
    add('layout', '把 64 位分成五段', '最高位保留为 0。时间戳占 41 位，机房和机器各 5 位，最后 12 位用来区分同一机器同一毫秒的请求。', '1 + 41 + 5 + 5 + 12 = 64 bits\n\n时间：自定义 epoch 之后的毫秒\n序列：0 … 4095', '这是一种字段分配方案，不是所有发号器的固定标准。时间戳可覆盖约 69 年，之后必须迁移。', '新增字段条：位数决定每个字段的取值范围。', { bits: true, fields: ['sign', 'timestamp', 'dc', 'machine', 'sequence'] });
    add('layout', '先让两台机器身份不同', '本例两台机器都在机房 1，机器号分别是 1 和 2。即使时间和序列完全相同，机器字段也不同。', 'A: dc = 1, machine = 1\nB: dc = 1, machine = 2\n\n每个字段范围：0 … 31', '身份租约、进程重启与历史时间高水位需要额外管理。不能把同一身份同时发给两个进程。', '保留固定身份；之后只有时间戳和序列号随请求改变。', { bits: true, fields: ['dc', 'machine'], workers: ['a', 'b'] });
    add('generate', '读取相对 epoch 的毫秒数', '示例取 T = 1200000000000 毫秒，仍小于 2^41。两个请求可以落在同一毫秒，单靠时间戳不足以区分。', 'T = 1200000000000\n0 ≤ T < 2^41\n\n不是 Unix 时间的绝对值', '真实部署须统一 epoch，并处理时钟回退。时间同步也不能提供跨机器请求的严格全序。', '时钟停在 T，接下来观察同一毫秒中的三个请求。', { bits: true, fields: ['timestamp'] });
    const first = generate(state, 'a');
    add('generate', 'A 的第一个请求使用序列 0', 'A 尚未在这个毫秒发号，因此从序列 0 开始。各字段左移到指定位置，再按位或合并；原字段不会丢失。', `id = (T << 22) | (1 << 17)\n   | (1 << 12) | 0\n= ${first}`, '此值超过 JavaScript Number 的安全整数范围。计算与展示使用 BigInt，再转换成十进制字符串。', 'A 发号成功：记录 last = T、seq = 0。', { bits: true, fields: ['sequence'], workers: ['a'] });
    const second = generate(state, 'a');
    add('generate', '同一毫秒，A 只递增序列', '第二个请求仍在 T。A 保持时间和身份，序列从 0 变为 1，因此新编号与上一个不同。', `A 第一次：${first}\nA 第二次：${second}\n变化：sequence 0 → 1`, '同一机器的并发请求必须串行更新序列或使用原子操作；不能让两个线程都读取到同一个旧序列。', 'A 再次发号成功；只有序列字段改变。', { bits: true, fields: ['sequence'], workers: ['a'] });
    const other = generate(state, 'b');
    add('generate', 'B 从自己的序列 0 开始', 'B 在 T 的第一个请求仍可使用 0。它的 machine = 2，与 A 的 machine = 1 不同，所以完整编号不重复。', `A 最近：${second}\nB 最近：${other}\n相同 T，不同 machine`, '编号大小也受机器位影响。两个机器在同一毫秒内的大小顺序不代表请求真正到达的先后。', 'B 发号成功；比较两台机器最近一次返回的完整编号。', { bits: true, fields: ['machine', 'sequence'], workers: ['b'] });
    if (mode === 'overflow') {
      state.a.sequence = 4094;
      state.a.output = compose(baseTime, 1, 1, 4094).toString();
      state.fields = { time: state.clock, machine: 1, sequence: 4094 };
      state.status = '快进：假设 A 已发出本毫秒的序列 0 … 4094';
      add('boundary', '快进到本毫秒的最后两个请求', '使用完整的 12 位序列。本步骤跳过中间请求，假设 A 已用掉 0 到 4094，接下来只剩 4095 可用。', '已有序列：0 … 4094\n已使用：4095 个\n下一个可用序列：4095', '这是快进设置，不是一次请求突然跳号。没有缩小序列位数或改变 64 位布局。', '快进至 seq = 4094；保留同一个毫秒 T。', { bits: true, fields: ['sequence'], workers: ['a'] });
      const last = generate(state, 'a');
      add('boundary', '最后一个可用序列仍然成功', 'A 将 4094 增至 4095。这是 12 位能够表示的最大值，本毫秒共可发出 4096 个不同序列。', `sequence = 4095\n最大值 = 2^12 - 1\nid = ${last}`, '4096 是每台机器每毫秒的序列空间，不是测量得到的服务吞吐量。', 'A 用掉序列 4095，最后一个合法编号已返回。', { bits: true, fields: ['sequence'], workers: ['a'] });
      generate(state, 'a');
      add('boundary', '耗尽后等待，不能绕回 0', '时钟仍是 T。若把序列绕回 0，会重发这个毫秒已经出现过的编号，所以本次请求等待，没有新编号。', 'now == last_time\nsequence == 4095\n结果：WAIT，未发号', '等待增加延迟。真实系统应设置等待上限与过载策略；不能在原时间戳下重复序列。', '本次请求等待；A 的 last、seq 和最近编号保持不变。', { bits: true, fields: ['sequence'], workers: ['a'] });
      state.clock = (baseTime + 1n).toString(); state.status = '时钟进入 T + 1，等待中的请求尚未返回';
      add('boundary', '时钟进入下一毫秒', '现在的时间严格大于 A 记录的 last。下一次处理可以在新时间戳下重新使用序列 0。', 'now = T + 1\nlast_time = T\n下一次处理可恢复发号', '本步只推进时钟，不把“具备条件”误画成已经返回编号。', '时间前进一毫秒；最近发出的编号仍未变化。', { bits: true, fields: ['timestamp'] });
      const recovered = generate(state, 'a');
      add('boundary', '新时间戳允许序列重新开始', '等待的请求继续处理。A 把序列设为 0，同时把 last 更新为 T + 1；时间高位不同，完整编号仍是新的。', `time = T + 1, sequence = 0\nid = ${recovered}`, '不能只看序列号是否重复；唯一性取决于时间、身份、序列组成的完整元组。', '等待结束，新编号返回；A 的序列回到 0。', { bits: true, fields: ['timestamp', 'sequence'], workers: ['a'] });
    } else if (mode === 'rollback') {
      state.clock = (baseTime - 1n).toString(); state.status = '时钟回到 T - 1；A 的已发号高水位仍为 T';
      add('boundary', '让时钟倒退一毫秒', 'A 之前已在 T 发出 seq = 1。现在时钟读数退到 T - 1，但历史发号状态不能随时钟一起倒退。', 'now = T - 1\nA.last_time = T\nA.sequence = 1', '本例选择拒绝回退期间的请求。其他策略也可行，但必须显式说明如何保护唯一性和延迟。', '只改变时钟读数，保留 A 的已发号状态。', { bits: true, fields: ['timestamp'], workers: ['a'] });
      generate(state, 'a');
      add('boundary', '发现回退就拒绝发号', 'now 小于 last_time。此时既不能重置序列，也不能覆盖高水位；直接返回时钟错误，没有生成编号。', 'if now < last_time:\n    reject CLOCK_ROLLBACK\n\nlast_time、sequence 均不变', '选择拒绝牺牲短时可用性，保护不重发旧编号。真实服务需要告警、恢复和调用方重试策略。', '请求被拒绝；A 最近一次的编号没有改变。', { bits: true, fields: ['timestamp'], workers: ['a'] });
      state.clock = baseTime.toString(); state.status = '时钟追平 T；历史序列仍为 1';
      add('boundary', '时钟追平，但序列不能清零', '时钟追平 last_time 后，系统回到同一毫秒分支。下一次请求应该继续递增到 2，不能再次使用 0。', 'now = last_time = T\n已使用：sequence 0、1\n下一个：sequence 2', '进程重启也有类似问题。丢失 last_time / sequence 后直接开始发号可能撞上旧编号。', '时钟恢复到 T；下一次重试仍需接着旧序列。', { bits: true, fields: ['timestamp', 'sequence'] });
      const recovered = generate(state, 'a');
      add('boundary', '重试成功，继续序列 2', '再次请求时，A 看到同一毫秒并把序列从 1 增至 2。旧编号没有被重复使用。', `time = T, sequence = 2\nid = ${recovered}`, '本例保留内存状态；部署时还必须解决进程崩溃后状态如何恢复，不能只处理运行中的时钟回退。', 'A 恢复发号，序列继续递增而非重置。', { bits: true, fields: ['sequence'], workers: ['a'] });
      const nextB = generate(state, 'b');
      add('boundary', '各机器保留各自的高水位', 'B 的 last 仍是 T、序列是 0；在相同时间再请求时，B 只递增自己的序列到 1，不读取 A 的序列。', `B: time = T, sequence = 1\nid = ${nextB}`, '共享的是身份分配规则和 epoch，不是运行时序列计数器。机器身份必须保持互斥。', 'B 继续使用自己的序列，两个实例的运行状态相互独立。', { bits: true, fields: ['machine', 'sequence'], workers: ['b'] });
    } else {
      state.status = '继续使用同一毫秒 T';
      add('boundary', '先观察正常的毫秒切换', '同一毫秒内 A 与 B 各自递增。时间进入新毫秒后，序列可从 0 重新开始，因为编号的时间高位已经改变。', '同一毫秒：sequence += 1\n更新毫秒：sequence = 0\n\n可切换下方的边界场景', '这套规则依赖时间不会倒退；序列用完和时钟回退需要单独的处理分支。', '保持时钟 T，先让 A 再处理一个请求。', { bits: true, fields: ['timestamp', 'sequence'] });
      const aThird = generate(state, 'a');
      add('boundary', 'A 的第三次请求使用序列 2', '没有新的时间戳，A 继续使用同一毫秒的下一个序列。B 的状态没有变化。', `A: time = T, sequence = 2\nid = ${aThird}`, '只有同一机器的序列在本次请求中改变。并发更新必须保持原子性。', 'A 的序列变为 2，B 仍停在自己的序列 0。', { bits: true, fields: ['sequence'], workers: ['a'] });
      state.clock = (baseTime + 1n).toString(); state.status = '时钟进入 T + 1；尚未生成新编号';
      add('boundary', '时钟进入下一毫秒', '时间高位已经有了新的取值。下一次请求可以重新使用低位序列 0，不会与 T 时刻的序列 0 冲突。', 'now = T + 1\nA.last_time = T\n下一次请求：sequence = 0', '不能把示例时钟推进当成真实的时间同步方案。真实时间来自配置好的 epoch 与本地时钟。', '只推进时钟，所有最近一次返回的编号保持不变。', { bits: true, fields: ['timestamp'] });
      const nextA = generate(state, 'a');
      add('boundary', 'A 在新毫秒从 0 开始', 'A 在 T + 1 的第一个请求把 last 更新为新时间，序列重置为 0。新的时间高位让编号区别于旧毫秒。', `A: time = T + 1, sequence = 0\nid = ${nextA}`, '本布局的时间字段用尽之后不能简单绕回零；必须规划 epoch 或编号格式迁移。', 'A 的时间高位更新，低位序列重新开始。', { bits: true, fields: ['timestamp', 'sequence'], workers: ['a'] });
      const nextB = generate(state, 'b');
      add('boundary', 'B 也在新毫秒从 0 开始', 'B 同样进入新毫秒。虽然它与 A 的时间、机房和序列相同，机器号仍然不同。', `B: time = T + 1, sequence = 0\nid = ${nextB}`, '机器标识重复时，两个实例可能生成完全相同的编号；发号算法本身不会发现部署配置错误。', 'B 发出新编号，机器身份继续保证实例之间的区分。', { bits: true, fields: ['machine'], workers: ['b'] });
    }
    add('review', '唯一性并不等于严格全局顺序', '时间在高位，使编号大致随时间增长。同一毫秒内机器字段决定跨实例的数值顺序；网络延迟和时钟偏差也会影响实际观察顺序。', '唯一：时间 + 身份 + 序列不重复\n近似时间序：时间放高位\n严格全局序：需要额外协议', '本布局用 12 位序列换取每机每毫秒 4096 个序号；增大序列位数会挤占时间或身份空间。', '回看取舍：本地发号更快，但时钟、身份和重启恢复都要有约束。', { bits: true, fields: ['timestamp', 'dc', 'machine', 'sequence'] });
    add('review', '连接到短链接，先检查位数', 'Base62 是整数的另一种表示。完整编码仍唯一，但本页这种较大的编号可能需要 11 个字符，不能直接套用七位短码。', `示例 ID：${state.a.output}\n最大 63 位正整数：2^63 - 1\nBase62 最多需要 11 位`, '如果产品要求最多七位，必须选择受范围约束的 ID 分配器，或重新讨论短码长度。截断编码会失去唯一性。', '完成一个发号设计起点；下一步是身份租约、故障恢复与编号格式选择。', { bits: true });
    return frames;
  }

  const timeLabel = value => value === null ? '尚未发号' : BigInt(value) === baseTime ? 'T' : BigInt(value) === baseTime + 1n ? 'T + 1' : BigInt(value) === baseTime - 1n ? 'T - 1' : value;
  const trace = window.AlgorithmVisualCore.createTrace({
    root, cloneState: clone, codeKeyAttribute: 'data-design-key', getCodeScroll: () => null,
    onRender: ({ frame, state }) => {
      const fields = {
        '#decision-title': frame.title, '#decision-why': frame.why, '#decision-evidence': frame.evidence,
        '#decision-tradeoff': frame.tradeoff, '#step-change': frame.change, '#architecture-description': frame.change,
        '#drawing-stage': ({scope:'需求与选择',layout:'字段布局',generate:'同一毫秒',boundary:'边界场景',review:'取舍与扩展'})[frame.key],
        '#clock-state': `时钟 ${timeLabel(state.clock)}；T = ${baseTime} ms（相对 epoch）`,
        '#state-a': state.a.last === null ? '尚未发号' : `last = ${timeLabel(state.a.last)} / seq = ${state.a.sequence}`,
        '#state-b': state.b.last === null ? '尚未发号' : `last = ${timeLabel(state.b.last)} / seq = ${state.b.sequence}`,
        '#field-time': state.fields.time, '#field-machine': state.fields.machine, '#field-sequence': state.fields.sequence,
        '#output-a': `A 最近一次：${state.a.output || '尚未生成'}`, '#output-b': `B 最近一次：${state.b.output || '尚未生成'}`,
        '#result-status': state.status
      };
      for (const [selector, value] of Object.entries(fields)) root.querySelector(selector).textContent = value;
      root.querySelector('#bit-fields').toggleAttribute('hidden', !frame.bits);
      root.querySelector('#architecture').dataset.status = state.status.startsWith('拒绝') ? 'rejected' : state.status.startsWith('等待：') ? 'waiting' : 'ready';
      for (const field of root.querySelectorAll('[data-field]')) field.classList.toggle('is-current', frame.fields.includes(field.dataset.field));
      for (const worker of root.querySelectorAll('[data-worker]')) worker.classList.toggle('is-current', frame.workers.includes(worker.dataset.worker));
      for (const flow of root.querySelectorAll('[data-worker-flow]')) flow.classList.toggle('is-current', frame.workers.includes(flow.dataset.workerFlow));
    }
  });
  for (const button of root.querySelectorAll('[data-design-key]')) button.addEventListener('click', () => trace.showStep(trace.frames.findIndex(frame => frame.key === button.dataset.designKey)));
  root.querySelector('#restart').addEventListener('click', () => trace.showStep(0));
  scenarioSelect.addEventListener('change', () => {
    scenario = scenarioSelect.value;
    const url = new URL(location.href); url.searchParams.set('scenario', scenario);
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    trace.setFrames(buildFrames(scenario), { initialStep: 8 });
  });
  root.querySelector('.design-roadmap').hidden = false;
  root.querySelector('.design-controls').hidden = false;
  trace.setFrames(buildFrames(scenario));
})();
