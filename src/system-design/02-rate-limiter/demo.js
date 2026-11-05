(() => {
  'use strict';
  const root = document.querySelector('#design-lesson');
  const capacityInput = root.querySelector('#capacity');
  const refillInput = root.querySelector('#refill-rate');
  const query = new URLSearchParams(location.search);
  const boundedInteger = (value, fallback, maximum) => /^\d+$/.test(value || '') && Number(value) >= 1 && Number(value) <= maximum ? Number(value) : fallback;
  let capacity = boundedInteger(query.get('capacity'), 3, 6);
  let refillRate = boundedInteger(query.get('refill'), 1, 3);
  capacityInput.value = String(capacity);
  refillInput.value = String(refillRate);

  const svg = (tag, attributes, text) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const tokenSlots = root.querySelector('#token-slots');
  for (let i = 0; i < 6; i++) {
    const slot = svg('g', { 'data-token': i });
    slot.append(svg('circle', { cx: 335 + i * 48, cy: 266, r: 17, class: 'token-slot' }), svg('text', { x: 335 + i * 48, y: 272, class: 'token-number' }, i + 1));
    tokenSlots.append(slot);
  }
  const requestHistory = root.querySelector('#request-history');
  requestHistory.append(svg('line', { x1: 90, x2: 790, y1: 366, y2: 366, class: 'history-line' }));
  for (let i = 0; i < 6; i++) {
    const x = 90 + i * 140;
    const event = svg('g', { 'data-event': i + 1, hidden: '' });
    event.append(svg('rect', { x: x - 36, y: 350, width: 72, height: 32, rx: 3, class: 'history-mark' }));
    event.append(svg('text', { x, y: 372, class: 'history-label' }, `R${i + 1}`));
    event.append(svg('text', { x, y: 405, class: 'node-detail', 'data-event-result': '' }));
    event.append(svg('text', { x, y: 425, class: 'node-detail', 'data-event-time': '' }));
    requestHistory.append(event);
  }

  function makeFrames() {
    const frames = [];
    const state = { time: 0, tokens: capacity, accepted: 0, rejected: 0, history: [] };
    const add = (key, title, why, evidence, tradeoff, change, scene = {}) => {
      frames.push({ key, title, why, evidence, tradeoff, change,
        state: structuredClone(state),
        nodes: ['client', 'gateway', 'service', 'bucket'], flows: [], active: [], ...scene,
        sourceKeys: [key], stepLabel: `${frames.length + 1}. ${title}` });
    };
    add('scope', '先限定一个用户的一种请求',
      '以 user:42 创建短链接为例。允许短时突发，但不能让一个用户持续占满服务；每个请求消耗一个令牌。',
      `key = user:42 + POST /api/links\ncapacity = ${capacity}\nrefill = ${refillRate} token / second`,
      '数值是演示选择。身份来自已验证的用户或密钥，不应直接信任客户端随意提交的 user ID。',
      '先确定按谁、按哪个接口限流，避免把所有人的请求混进同一个桶。',
      { nodes: ['client', 'service'], flows: ['direct'], active: ['client'] });
    add('scope', '把检查放在服务之前',
      '在服务端网关增加限流检查。所有创建请求先到网关，额度足够才转发，避免业务服务先做完昂贵工作再拒绝。',
      'Client → Gateway / Limiter → Service\n\n拒绝发生在进入业务服务之前',
      '客户端限流不能单独保护服务。网关本身也需要容量与故障策略；此处先演示一个逻辑限流实例。',
      '新增服务端限流器：它决定请求是否能继续前进。',
      { nodes: ['client', 'gateway', 'service'], flows: ['incoming', 'allowed'], active: ['gateway'] });
    add('bucket', '为这个 key 保存一个桶',
      '用令牌数表示当前可用额度。初始化为满桶；请求只消费令牌，完成后不归还。额度由时间补回，而不是由业务完成释放。',
      `tokens = ${capacity}\ncapacity = ${capacity}\nrefill = ${refillRate} / s\nlast_refill = 0 s`,
      '这里按整秒补充，使用模拟时钟。生产实现也可按经过时间计算小数令牌，但必须明确时间精度。',
      `初始化：桶中有 ${capacity} 个令牌，尚未处理请求。`,
      { flows: ['inspect'], active: ['gateway'] });

    function request(number) {
      const before = state.tokens;
      const allowed = before >= 1;
      if (allowed) { state.tokens--; state.accepted++; } else state.rejected++;
      state.history.push({ number, time: state.time, allowed, tokens: state.tokens });
      const key = number <= 4 ? 'burst' : 'refill';
      add(key, `R${number}：${allowed ? '有令牌，消费后放行' : '桶已空，返回 429'}`,
        allowed ? '检查到至少一个令牌，消费一个后再把请求交给服务。同一时刻的后续请求会看到已经减少的额度。' : '当前没有令牌。本例直接拒绝，不排队、不转发给业务服务，也不会把令牌数减成负数。',
        `t = ${state.time} s\ntokens: ${before} → ${state.tokens}\n${allowed ? 'consume 1 → forward' : 'HTTP/1.1 429 Too Many Requests\nRetry-After: 1'}`,
        allowed ? '放行表示通过限流检查，不保证业务本身成功。顺序演示假设检查与消费是一个原子动作。' : 'Retry-After 是本例给出的等待提示，不是预订名额；重试时可能又有其他请求消耗额度。',
        `R${number} 在 t=${state.time}s 到达：${allowed ? `消费 1 个令牌，服务累计收到 ${state.accepted} 次。` : '返回 429，本次请求没有进入服务。'}`,
        { flows: ['incoming', 'inspect', allowed ? 'allowed' : 'denied'], active: allowed ? ['service'] : ['gateway'], request: `R${number} / t=${state.time}s` });
    }
    for (let number = 1; number <= 4; number++) request(number);
    let before = state.tokens;
    state.time = 1;
    state.tokens = Math.min(capacity, before + refillRate);
    add('refill', '推进一秒，补回额度',
      '时间从 0 秒推进到 1 秒，按补充速率加入令牌，但不能超过桶容量。业务完成与否不影响这个补充过程。',
      `tokens = min(capacity, tokens + refill)\n       = min(${capacity}, ${before} + ${refillRate})\n       = ${state.tokens}`,
      '调大补充速率提高持续通过能力；调大容量主要增加空闲后可积攒的突发额度。',
      `t=1s：令牌从 ${before} 增加到 ${state.tokens}。这一步没有新请求。`,
      { flows: ['refill'], refill: `+${state.tokens - before} 令牌`, active: ['gateway'] });
    request(5);
    before = state.tokens;
    state.time = 11;
    state.tokens = Math.min(capacity, before + refillRate * 10);
    add('refill', '长时间空闲，也只能补到容量',
      '再等待十秒，没有请求消费令牌。虽然补充机会很多，桶满后额外额度不会累积，避免无限积攒后的巨大突发。',
      `tokens = min(${capacity}, ${before} + 10 × ${refillRate})\n       = ${state.tokens}\n\n多出的额度不保存`,
      '容量是突发上限，不是请求队列长度。这个设计没有保存被拒绝请求，客户端需要自己决定是否重试。',
      `t=11s：桶回到 ${capacity}/${capacity}；令牌数始终不超过容量。`,
      { flows: ['refill'], refill: `补满至 ${capacity}`, active: ['gateway'] });
    request(6);
    add('review', '回到系统：保护的是共享额度',
      '容量控制突发，补充速率控制持续流量。扩到多台网关时，同一个 key 的状态必须有统一归属，检查与消费必须原子执行。',
      `演示已放行 ${state.accepted} 次，拒绝 ${state.rejected} 次\n\nkey → 同一限流分区\n原子操作：补充 → 检查 → 消费`,
      '共享存储会引入延迟和故障。失联时放行还是拒绝、如何防止绕过网关，都应由业务风险和可用性目标决定。',
      '最小设计已跑通；下一步关注多实例共享额度、原子操作和限流器故障。',
      { flows: ['incoming', 'inspect', 'allowed'], active: ['gateway'] });
    return frames;
  }

  function persistParameters() {
    const url = new URL(location.href);
    url.searchParams.set('capacity', String(capacity));
    url.searchParams.set('refill', String(refillRate));
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }

  const trace = window.AlgorithmVisualCore.createTrace({
    root, cloneState: state => structuredClone(state),
    codeKeyAttribute: 'data-design-key', getCodeScroll: () => null,
    onRender: ({ frame, state }) => {
      for (const element of root.querySelectorAll('[data-node]')) {
        element.toggleAttribute('hidden', !frame.nodes.includes(element.dataset.node));
        element.classList.toggle('is-current', frame.active.includes(element.dataset.node));
      }
      for (const element of root.querySelectorAll('[data-flow]')) element.toggleAttribute('hidden', !frame.flows.includes(element.dataset.flow));
      for (const element of tokenSlots.children) {
        const index = Number(element.dataset.token);
        element.toggleAttribute('hidden', index >= capacity);
        element.querySelector('circle').classList.toggle('is-filled', index < state.tokens);
      }
      requestHistory.toggleAttribute('hidden', state.history.length === 0);
      for (const element of requestHistory.querySelectorAll('[data-event]')) {
        const event = state.history.find(item => item.number === Number(element.dataset.event));
        element.toggleAttribute('hidden', !event);
        if (!event) { element.removeAttribute('data-result'); continue; }
        element.dataset.result = event.allowed ? 'allowed' : 'rejected';
        const mark = element.querySelector('rect');
        mark.classList.toggle('is-allowed', event.allowed);
        mark.classList.toggle('is-rejected', !event.allowed);
        element.querySelector('[data-event-result]').textContent = event.allowed ? '通过' : '429';
        element.querySelector('[data-event-time]').textContent = `t=${event.time}s`;
      }
      const fields = {
        '#decision-title': frame.title, '#decision-why': frame.why,
        '#decision-evidence': frame.evidence, '#decision-tradeoff': frame.tradeoff,
        '#step-change': frame.change, '#architecture-description': frame.change,
        '#drawing-stage': frame.key === 'burst' ? '同一时刻的突发请求' : frame.key === 'refill' ? '时间与令牌' : frame.key === 'review' ? '扩展与取舍' : '最小设计',
        '#clock-state': `t = ${state.time} s`, '#policy-state': `容量 ${capacity}；每秒补充 ${refillRate}`,
        '#token-count': `令牌 ${state.tokens} / ${capacity}`, '#service-count': `已收到 ${state.accepted} 次`,
        '#request-label': frame.request || 'POST /api/links', '#refill-label': frame.refill || ''
      };
      for (const [selector, text] of Object.entries(fields)) root.querySelector(selector).textContent = text;
    }
  });
  for (const button of root.querySelectorAll('[data-jump]')) button.addEventListener('click', () => trace.showStep(Number(button.dataset.jump)));
  root.querySelector('#restart').addEventListener('click', () => trace.setFrames(makeFrames(), { initialStep: 0 }));
  function changeParameters() {
    capacity = Number(capacityInput.value);
    refillRate = Number(refillInput.value);
    persistParameters();
    trace.setFrames(makeFrames(), { initialStep: 0 });
  }
  capacityInput.addEventListener('change', changeParameters);
  refillInput.addEventListener('change', changeParameters);
  persistParameters();
  root.querySelector('.design-roadmap').hidden = false;
  root.querySelector('.design-controls').hidden = false;
  trace.setFrames(makeFrames());
})();
