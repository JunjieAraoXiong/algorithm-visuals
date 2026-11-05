(() => {
  'use strict';
  const root = document.querySelector('#design-lesson');
  const scenarioInput = root.querySelector('#scenario');
  const dedupInput = root.querySelector('#dedup');
  const params = new URLSearchParams(location.search);
  let scenario = ['lost', 'failure', 'normal'].includes(params.get('scenario')) ? params.get('scenario') : 'lost';
  let dedup = params.get('dedup') === 'provider' ? 'provider' : 'consumer';
  scenarioInput.value = scenario;
  dedupInput.value = dedup;
  const clone = value => structuredClone(value);

  function buildFrames() {
    const frames = [];
    const s = { api: '尚未接收', queue: '空', worker: '空闲', provider: '尚未调用', calls: 0, sent: 0,
      confirmed: false, completed: false, providerRecord: false, acked: false };
    const add = (key, title, why, evidence, tradeoff, change, options = {}) => frames.push({
      key, title, why, evidence, tradeoff, change, nodes: ['api', 'queue', 'worker', 'provider'],
      flows: [], active: [], response: '服务商响应', ...options, state: clone(s),
      sourceKeys: [key], stepLabel: (frames.length + 1) + '. ' + title
    });
    add('scope', '先明确“成功”指哪一步',
      '调用方需要快速提交通知；邮件服务可能变慢或失败。接收请求、保存待办、服务商发送和用户阅读是不同的事实。',
      'event_id: e42\nrecipient: user:7\nchannel: email',
      '这里只模拟一个渠道与一个事件，不连接真实服务。服务商发送成功也不等于最终送达或用户已经阅读。',
      '先限定一个渠道：把事件 e42 变成发给 user:7 的一封邮件。',
      { nodes: ['api', 'provider'], flows: ['direct'] });
    add('scope', '用持久化队列保存待办',
      'API 先保存通知事件，Worker 再独立调用服务商。慢服务不再占住 API 请求，但用户要接受异步完成。',
      'API → durable queue → Worker → Provider\n\n同一事件重试时保持 event_id = e42',
      '队列会积压，需要容量、监控和恢复策略。持久化承诺取决于队列本身的配置与故障模型。',
      '新增队列与 Worker，把快速接收和较慢发送分开。',
      { flows: ['enqueue', 'claim', 'send'], active: ['queue', 'worker'] });
    s.api = '已接收';
    add('enqueue', 'API 收到请求，尚未承诺成功',
      'API 已验证收件人和发送权限，构造事件 e42。内存里收到请求，并不意味着崩溃后仍能恢复这条通知。',
      'event = { id: "e42", recipient: "user:7" }\nqueue: empty\nAPI response: pending',
      'event ID 在首次创建后保持不变。调用方重试 API 时的去重是另一个边界，本例从已分配事件开始。',
      'API 已收到 e42；队列仍为空，尚未向调用方返回成功。',
      { active: ['api'] });
    s.queue = '待处理';
    add('enqueue', '等持久化确认，再承诺已接收',
      '队列确认事件已持久化。现在可以在服务商暂时不可用时保留待办，而不是丢弃这次发送需求。',
      'queue: [ e42 ]\npersisted = true\nprovider sends = 0',
      '如果存储失败，API 不能仍然返回已接受。队列持久化确认与消费者处理完成是两个不同的确认。',
      'e42 写入队列；此时服务商还没有发送邮件。',
      { flows: ['enqueue'], active: ['queue'] });
    s.api = '已返回 202';
    add('enqueue', '202 只表示异步任务已接受',
      'API 向调用方返回 202 Accepted，结束这一条请求。之后 Worker 继续处理，调用方可凭事件 ID 查询状态。',
      'HTTP 202 Accepted\nevent_id: e42\nstatus: queued',
      '202 不代表邮件已送达。若产品要报告最终送达，还需要服务商回执以及明确的状态定义。',
      '调用方得到 e42 的受理结果；队列中仍有一条待办。',
      { active: ['api'] });
    s.queue = '处理中'; s.worker = '已领取 e42';
    add('consume', 'Worker 领取，但消息尚未删除',
      'Worker 获得一次处理机会，消息在处理窗口内不可再次领取。只有处理结果记录妥当后，才确认队列消息。',
      'queue: e42 → in flight\nworker: processing e42\nqueue acknowledgement: no',
      '本例使用有超时的领取模型。超时、崩溃或至少一次投递都可能带来再次处理，不能依赖只被领取一次。',
      'e42 进入处理中；它仍然是队列负责恢复的未确认消息。',
      { flows: ['claim'], active: ['worker'] });
    add('consume', '先查本地完成记录',
      '消费者查询 e42 是否已完成。第一次处理没有记录，因此准备调用服务商；这里只保存已确认的成功结果。',
      'completed["e42"]: absent\n→ call provider',
      '如果在发送之前写“完成”，写完就崩溃可能漏发。把记录放在发送之后，又会留下结果未知的重复窗口。',
      '本地没有 e42 的完成记录，允许本次调用服务商。',
      { active: ['worker'] });
    s.calls++; s.worker = '等待响应'; s.provider = '处理调用 1';
    add('consume', '发送调用进入外部系统',
      dedup === 'provider' ? 'Worker 携带稳定的幂等键 e42。假设服务商能把这个键、请求内容和发送结果一起保护，后续同键请求可复用结果。' : '本例仅在消费者保存完成记录，服务商没有收到幂等键。相同事件再次调用时，服务商可能再次执行发送。',
      'call #1\nevent_id = e42\n' + (dedup === 'provider' ? 'idempotency_key = e42' : 'provider idempotency: disabled'),
      '幂等键不是通用魔法。支持范围、保留期限、同键内容变化和并发行为都需要服务商明确约定。',
      '发出第一次服务商调用；外部发送次数此时仍为 0。',
      { flows: ['send'], active: ['provider'] });

    if (scenario === 'failure') {
      s.provider = '发送前失败';
      add('consume', '服务商在执行发送前失败',
        '这一条受控轨迹中，服务商尚未执行发送就返回临时错误，所以实际发送数仍为 0。稍后重试有机会补上这次发送。',
        'call #1 → temporary failure\nprovider sends = 0\ncompleted["e42"]: absent',
        '只有明确的失败语义才能断言未执行。一般网络超时并没有这种信息；另一场景会展示这一点。',
        '首次调用失败，服务商没有执行发送，本地也没有完成记录。',
        { active: ['provider'] });
    } else {
      s.sent++; s.provider = '已执行发送'; s.providerRecord = dedup === 'provider';
      add('consume', '服务商实际执行一次发送',
        '服务商执行了邮件发送操作。我们能在演示中看见这个事实，但 Worker 还没有收到响应，不能据此更新自己的完成记录。',
        'provider sends = 1\nworker knows success = false\n' + (dedup === 'provider' ? 'provider: e42 → result p1' : 'provider idempotency record: absent'),
        '这里的计数是服务商发送操作次数，不是收件箱送达次数或阅读次数。实际业务还需处理退信和送达回执。',
        '服务商发送次数变为 1；Worker 仍在等待，两个位置掌握的信息不同。',
        { active: ['provider'] });
    }

    if (scenario === 'normal') {
      s.confirmed = true; s.worker = '收到成功响应';
      add('retry', '成功响应到达 Worker',
        'Worker 收到服务商成功结果，知道本次发送操作已执行。现在可以把这一结果写入自己的完成记录。',
        'provider result p1 → Worker\nworker knows success = true\ncompleted["e42"]: not written yet',
        '看到服务商响应、持久化完成记录、确认队列消息仍是三个动作，不能把它们画成一个原子事务。',
        'Worker 收到成功响应；下一步才写入本地完成记录。',
        { flows: ['response'], response: '成功结果 p1', active: ['worker'] });
    } else {
      s.worker = scenario === 'lost' ? '超时，结果未知' : '收到临时错误';
      add('retry', scenario === 'lost' ? '响应丢失，Worker 只能看到超时' : 'Worker 收到临时失败',
        scenario === 'lost' ? '服务商已经发送，但成功响应在途中丢失。Worker 不能区分“未执行”和“已执行但响应丢失”，因此没有写完成记录。' : 'Worker 知道本次没有完成。保持队列消息未确认，等重试窗口到来；不把失败写成完成。',
        'worker result: ' + (scenario === 'lost' ? 'UNKNOWN' : 'temporary failure') + '\ncompleted["e42"]: absent\nqueue acknowledgement: no',
        '重试是对不确定性的选择。盲目重试可能重复，直接放弃则可能漏发；需要把可接受语义说清楚。',
        scenario === 'lost' ? 'Worker 超时，但服务商发送数仍是 1；超时没有撤销外部副作用。' : 'Worker 收到失败；服务商发送数仍为 0。',
        { flows: ['response'], response: scenario === 'lost' ? '响应丢失 / Worker 超时' : '临时错误', lost: scenario === 'lost', active: ['worker'] });
      s.queue = '待处理'; s.worker = '等待重试';
      add('retry', '处理窗口到期，消息可再次领取',
        '由于没有收到队列处理确认，e42 重新变成可领取的待办。事件 ID 保持不变，新的只是一次处理尝试。',
        'in flight → ready\nevent_id remains e42\nqueue acknowledgement: no',
        '实际重试需要退避、抖动和上限。为了看清状态，本例只展示一次确定性的重试。',
        'e42 返回待处理状态；服务商已经发生的发送不会被回滚。',
        { flows: ['retry'], active: ['queue'] });
      s.queue = '处理中'; s.worker = '再次领取 e42';
      add('retry', '第二次领取同一事件',
        'Worker 再次得到 e42。这不是新的通知需求，而是对同一事件的又一次处理，必须继续使用相同的去重标识。',
        'delivery attempt: 2\nevent_id: e42\nprovider calls so far: 1',
        '不同 Worker 也可能接手重试，因此完成记录必须在需要的范围内共享并持久化，不能只依赖进程内变量。',
        'e42 再次进入处理中；尚未再次调用服务商。',
        { flows: ['claim'], active: ['worker'] });
      add('retry', '消费者去重没有找到成功记录',
        '上次没有收到成功结果，所以本地完成记录仍为空。单靠这个检查，无法发现服务商上次是否已经产生了副作用。',
        'completed["e42"]: absent\nlocal decision: call provider again',
        '“见过事件”和“处理已完成”不是一回事。仅凭先标记 seen 再发送，同样会引入崩溃后漏发的问题。',
        '本地检查再次通过；是否会重复发送，取决于外部服务的契约。',
        { active: ['worker'] });
      s.calls++; s.worker = '等待重试响应'; s.provider = '处理调用 2';
      add('retry', '重试保留同一个幂等身份',
        dedup === 'provider' ? '第二次请求继续携带 e42。服务商检查同一键是否已经绑定结果，而不是把重试当作新事件。' : '第二次请求没有服务商幂等保护。即使 event_id 在消费者里相同，外部服务仍会按一次新调用处理。',
        'call #2\nevent_id = e42\n' + (dedup === 'provider' ? 'idempotency_key = e42' : 'no provider idempotency key'),
        '每次重试生成新键会失去去重效果；复用旧键但改变请求内容也必须被明确处理。',
        '发出第二次服务商调用；调用次数变为 2，实际发送次数暂未变化。',
        { flows: ['send'], active: ['provider'] });
      const reused = dedup === 'provider' && s.providerRecord;
      if (!reused) s.sent++;
      s.providerRecord = dedup === 'provider';
      s.provider = reused ? '复用首次结果' : '已执行发送';
      add('retry', reused ? '服务商复用首次结果，跳过发送' : '服务商执行这次发送操作',
        reused ? '服务商发现 e42 已有结果 p1，返回这个结果而不再执行发送。保护副作用的位置在服务商，不是消费者的完成集合。' : scenario === 'lost' ? '消费者的完成记录无法阻止这次外部操作。服务商再次发送，同一事件最终产生两次发送。' : '第一次失败没有产生发送，因此这次重试补上一次操作。发送次数从 0 变为 1。',
        'provider calls = ' + s.calls + '\nprovider sends = ' + s.sent + '\n' + (reused ? 'reuse result p1; no new send' : 'execute send operation'),
        '幂等模式只在本例假设的服务商契约与保留期限内成立，不能推广为端到端“恰好一次送达”。',
        reused ? '第二次调用没有增加发送次数：仍为 1。' : '服务商发送次数变为 ' + s.sent + '；这与两次调用是不同的计数。',
        { active: ['provider'] });
      s.confirmed = true; s.worker = '收到成功响应';
      add('retry', '重试结果这次成功返回',
        'Worker 终于收到服务商成功结果。它知道发送已执行，但响应本身不能证明收件人已收到或阅读。',
        'provider success → Worker\nworker knows success = true\ncompleted["e42"]: not written yet',
        '若这次响应再次丢失，仍需遵守同一重试和幂等契约。本例把第二次响应设为成功到达。',
        'Worker 已确认服务商结果，接下来保存完成记录。',
        { flows: ['response'], response: '成功结果', active: ['worker'] });
    }
    s.completed = true; s.worker = '完成记录已保存';
    add('review', '先持久化消费者完成记录',
      '将 e42 和服务商结果保存为已完成。后续重复消费可以据此跳过服务商调用，而不是重新发送。',
      'completed["e42"] = provider_success\nqueue acknowledgement: not yet\nprovider sends = ' + s.sent,
      '这条记录表示已确认服务商结果，不是用户阅读证明。必须考虑共享范围、过期策略和并发检查。',
      '消费者完成记录现在包含 e42；队列消息暂时仍未确认。',
      { active: ['worker'] });
    s.acked = true; s.queue = '已确认移除'; s.worker = '空闲';
    add('review', '再确认队列消息',
      'Worker 告诉队列这次处理已经完成，队列可以移除待办。即便之后存在重复投递，本地完成记录也能跳过已知成功事件。',
      'queue acknowledgement: yes\nqueue: empty\ncompleted["e42"]: provider_success',
      '如果先确认再保存完成记录，崩溃会失去恢复依据。完成记录和队列确认也有各自的可靠性边界。',
      'e42 从待办移除；已发送次数保留为 ' + s.sent + '，不会因队列清空而归零。',
      { flows: ['ack'], active: ['queue'] });
    add('review', '把承诺限定在可观察的边界',
      '队列解决待办保存与异步处理，重试处理暂时失败；幂等保护重复副作用。这些机制分别回答不同的问题。',
      'API accepted: yes\nprovider calls: ' + s.calls + '\nprovider sends: ' + s.sent + '\nrecipient delivery/read: not modeled',
      '消费者去重不自动保证外部副作用恰好一次。上线前还需明确重试上限、死信处理、送达回执和服务商幂等期限。',
      '最终状态：待办已确认，服务商调用 ' + s.calls + ' 次、发送 ' + s.sent + ' 次；最终送达仍是另一个状态。',
      { active: [] });
    return frames;
  }

  const trace = window.AlgorithmVisualCore.createTrace({
    root, cloneState: clone, codeKeyAttribute: 'data-design-key', getCodeScroll: () => null,
    onRender: ({ frame, state }) => {
      for (const node of root.querySelectorAll('[data-node]')) {
        node.toggleAttribute('hidden', !frame.nodes.includes(node.dataset.node));
        node.classList.toggle('is-current', frame.active.includes(node.dataset.node));
      }
      for (const flow of root.querySelectorAll('[data-flow]')) flow.toggleAttribute('hidden', !frame.flows.includes(flow.dataset.flow));
      root.querySelector('[data-flow="response"]').classList.toggle('is-lost', Boolean(frame.lost));
      const slot = root.querySelector('#message-slot');
      slot.toggleAttribute('hidden', !['待处理', '处理中'].includes(state.queue));
      slot.dataset.queueState = state.queue;
      const values = {
        '#decision-title': frame.title, '#decision-why': frame.why, '#decision-evidence': frame.evidence,
        '#decision-tradeoff': frame.tradeoff, '#step-change': frame.change, '#architecture-description': frame.change,
        '#drawing-stage': { scope: '最小设计', enqueue: '接收与持久化', consume: '执行与外部状态', retry: '确认与重试', review: '完成与边界' }[frame.key],
        '#api-state': state.api, '#queue-state': state.queue, '#worker-state': state.worker,
        '#provider-state': state.provider, '#response-label': frame.response,
        '#delivery-count': '服务商发送：' + state.sent + ' 次',
        '#confirmation-state': 'Worker 确认：' + (state.confirmed ? '成功结果' : '无'),
        '#consumer-record': '消费者完成记录：' + (state.completed ? 'e42' : '无'),
        '#provider-record': '服务商幂等记录：' + (dedup === 'consumer' ? '未启用' : state.providerRecord ? 'e42 → p1' : '无'),
        '#attempt-count': '发送调用：' + state.calls + ' 次；队列消息' + (state.acked ? '已被确认' : '未被确认')
      };
      for (const [selector, value] of Object.entries(values)) root.querySelector(selector).textContent = value;
    }
  });
  for (const button of root.querySelectorAll('[data-design-key]')) button.addEventListener('click', () => trace.showStep(trace.frames.findIndex(frame => frame.key === button.dataset.designKey)));
  root.querySelector('#restart').addEventListener('click', () => trace.showStep(0));
  function setParameters() {
    scenario = scenarioInput.value; dedup = dedupInput.value;
    const url = new URL(location.href);
    url.searchParams.set('scenario', scenario); url.searchParams.set('dedup', dedup);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    trace.setFrames(buildFrames(), { initialStep: 5 });
  }
  scenarioInput.addEventListener('change', setParameters);
  dedupInput.addEventListener('change', setParameters);
  root.querySelector('.design-roadmap').hidden = false;
  root.querySelector('.design-controls').hidden = false;
  trace.setFrames(buildFrames());
})();
