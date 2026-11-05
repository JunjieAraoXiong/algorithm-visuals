(() => {
  'use strict';
  const root = document.querySelector('#design-lesson');
  const inputs = { strategy: root.querySelector('#strategy'), author: root.querySelector('#author'), followers: root.querySelector('#followers') };
  const params = new URLSearchParams(location.search);
  const strategies = { push: '推', pull: '拉', hybrid: '混合' };
  let strategy = Object.hasOwn(strategies, params.get('strategy')) ? params.get('strategy') : 'hybrid';
  let author = params.get('author') === 'a' ? 'a' : 'b';
  let followerCount = [6, 12, 24].includes(Number(params.get('followers'))) ? Number(params.get('followers')) : 12;
  const clone = value => structuredClone(value);
  const posts = { A1: { author: 'a', time: 1 }, B1: { author: 'b', time: 2 }, P3: { author: null, time: 3 } };
  const stamp = id => `${id} @ 10:00:0${posts[id].time}`;
  const sorted = ids => [...new Set(ids)].sort((a, b) => posts[b].time - posts[a].time || a.localeCompare(b));
  // Put the displayed reader last so a partial fanout has a visible boundary.
  const followersFor = count => [...Array.from({ length: count - 1 }, (_, i) => `u${i + 2}`), 'u1'];

  function makeFrames() {
    const followers = { a: followersFor(3), b: followersFor(followerCount) };
    const pushAuthor = name => strategy === 'push' || strategy === 'hybrid' && followers[name].length <= 5;
    const fanout = pushAuthor(author);
    const users = [...new Set([...followers.a, ...followers.b])];
    const inboxes = Object.fromEntries(users.map(user => [user, []]));
    for (const name of ['a', 'b']) {
      if (pushAuthor(name)) for (const user of followers[name]) inboxes[user].push(name === 'a' ? 'A1' : 'B1');
    }
    const sources = strategy === 'push' ? ['inbox'] : strategy === 'pull' ? ['a', 'b'] : ['inbox', 'b'];
    const sourceLabel = source => source === 'inbox' ? 'u1 收件箱' : `作者 ${source.toUpperCase()} 时间线`;
    const s = { timelines: { a: ['A1'], b: ['B1'] }, inboxes, queue: [], delivered: [], job: '尚未发布',
      authorWrites: 0, inboxWrites: 0, reads: 0, merged: 0, buffer: [], response: [], responseNumber: 0, request: 0,
      requestState: '等待 u1 打开信息流', sourceState: '按时间倒序合并', status: '只统计本次新帖及之后的两次读取，不计初始化。' };
    const frames = [];
    const add = (key, title, why, evidence, tradeoff, change, options = {}) => frames.push({ key, title, why, evidence, tradeoff, change,
      active: [], flows: [], ...options, state: clone(s), sourceKeys: [key], stepLabel: `${frames.length + 1}. ${title}` });
    const writeBatch = count => {
      for (const user of s.queue.splice(0, count)) {
        if (!s.inboxes[user].includes('P3')) { s.inboxes[user].push('P3'); s.inboxWrites++; }
        s.delivered.push(user);
      }
      s.job = s.queue.length ? `待分发 ${s.queue.length} / ${followers[author].length}` : '分发完成';
    };
    const openRequest = number => { s.request = number; s.buffer = []; s.requestState = `u1 第 ${number} 次读取`; s.sourceState = '尚未读取候选来源'; };
    const fetchSource = source => {
      const ids = source === 'inbox' ? s.inboxes.u1 : s.timelines[source];
      s.buffer.push(...ids); s.reads++; s.sourceState = `已读取：${sourceLabel(source)}`;
      return ids;
    };
    const mergeResponse = () => {
      s.merged += s.buffer.length; s.response = sorted(s.buffer); s.responseNumber = s.request;
      s.requestState = `第 ${s.request} 次响应已返回`; s.sourceState = `合并本次 ${s.buffer.length} 个候选`;
    };
    add('scope', '先限定时间顺序的信息流', 'u1 关注 A 和 B。保留两条旧帖，再发布一条 P3；三种策略最终应得到相同的时间倒序结果。',
      'A1 @ 10:00:01\nB1 @ 10:00:02\nP3 @ 10:00:03\n最终：P3 → B1 → A1',
      '这个小图不包含推荐排序、分页、权限或真实网络。计数衡量本次模拟操作，不是服务吞吐量。', '先固定同一位读者、同一组帖子与时间，才能比较不同设计。');
    add('scope', '选择把工作放在哪条路径',
      strategy === 'push' ? '每位作者发布时，把帖子 ID 分发到每个关注者的收件箱；读取时只查自己的收件箱。' : strategy === 'pull' ? '发布时只写作者时间线；读取时查询关注的两位作者，再合并结果。' : '本例以 5 位关注者为教学阈值：A 有 3 位，走推；B 有更多关注者，走拉。u1 读取自己的收件箱和 B 的时间线。',
      `策略：${strategies[strategy]}\nA：${followers.a.length} 位关注者 → ${pushAuthor('a') ? '推' : '拉'}\nB：${followers.b.length} 位关注者 → ${pushAuthor('b') ? '推' : '拉'}\n本次发布者：${author.toUpperCase()}`,
      '混合阈值不只由关注者数量决定；真实选型还要考虑读者活跃度与读写频率。阈值 5 不是生产建议。', '两条作者时间线始终保存正文，收件箱只保存帖子引用。', { active: ['job'] });
    s.timelines[author].push('P3'); s.authorWrites++;
    add('publish', '先把新帖存入作者时间线', '发布 P3，时间为 10:00:03。三种策略都先保存作者自己的帖子；分发只是后续建立读取索引的工作。',
      `作者 ${author.toUpperCase()}：${s.timelines[author].join(', ')}\n作者写入 = ${s.authorWrites}\n收件箱新引用 = 0`,
      '本例假设帖子写入成功。实际服务还要保证帖子与分发任务之间的可靠交接，例如事务发件箱。', '作者时间线已存在 P3；这不代表所有关注者收件箱已追平。', { active: [author] });
    if (fanout) { s.queue = [...followers[author]]; s.job = `待分发 ${s.queue.length} / ${followers[author].length}`; }
    else s.job = '本作者不做写时分发';
    add('publish', fanout ? '保存分发任务，准备逐个写引用' : '这位作者省去写时分发',
      fanout ? `任务包含 ${s.queue.length} 位关注者，u1 排在最后。后台逐个把 P3 的引用写入收件箱，避免发布请求等待全部完成。` : 'P3 留在作者时间线上，关注者收件箱不增加新引用。读取路径会把这个作者的帖子取回来。',
      fanout ? `目标：${s.queue.join(', ')}\n待分发 = ${s.queue.length}\n当前已写引用 = 0` : '分发队列 = 空\n作者时间线已保存 P3\n读取时查询作者时间线',
      '异步分发会产生可见延迟；省去分发则把更多查找和合并工作放到读取时。两种策略都没有消除成本。', fanout ? '分发任务已建立；暂时还没有关注者收到新引用。' : '本次不建立分发任务，作者写入保持为 1。', { active: ['job'], flows: fanout ? [`enqueue-${author}`] : [] });
    if (fanout) writeBatch(Math.floor(followers[author].length / 2));
    add('publish', fanout ? '先处理一批，u1 仍在队尾' : '没有分发任务，也没有收件箱写入',
      fanout ? '这一批只处理队列前半部分，每位关注者对应一次独立引用写入。u1 尚未处理，下一步立刻读取就能看见延迟的影响。' : '因为这位作者采用拉策略，后台不向每个关注者写 P3。此时作者时间线上已经能够查询到新帖。',
      `本次新引用写入 = ${s.inboxWrites}\n剩余目标 = ${s.queue.length}\nu1 收件箱 = ${s.inboxes.u1.join(', ') || '空'}`,
      '批次不是跨收件箱的原子事务。计数来自逐个目标的实际写入；此处不模拟并发、网络或重试时间。', fanout ? '部分关注者已收到 P3，u1 的收件箱尚未更新。' : '收件箱写入仍为 0；是否看到新帖由读取来源决定。', { active: ['others'], flows: fanout ? ['fanout-others'] : [] });
    openRequest(1);
    add('early', 'u1 打开信息流', '开始第一次读取，分发队列暂时保持当前进度。响应必须来自这次实际读取到的候选，而不是直接使用全局最新帖子。',
      `读取来源：${sources.map(sourceLabel).join(' + ')}\n未分发目标：${s.queue.length}`,
      '这个受控顺序专门展示一次早读。真实任务与请求并发运行，需要明确定义允许多长时间的可见延迟。', '第一次读取已开始，尚未访问任何数据源。', { active: ['feed'] });
    const earlyFirst = fetchSource(sources[0]);
    add('early', '读取第一个候选来源', `本次访问${sourceLabel(sources[0])}，实际读到 ${earlyFirst.length} 条帖子引用。`,
      `${sourceLabel(sources[0])} → ${earlyFirst.join(', ') || '空'}\n本轨迹累计读取 = ${s.reads}`,
      '这里把一次来源读取计为一个操作；一次读取的字节数、存储延迟和分页成本没有被当作相同常数。', '只读取一个来源，候选尚未合并成响应。', { active: ['feed', sources[0] === 'inbox' ? 'inbox' : sources[0]], flows: [`read-${sources[0]}`] });
    const earlySecond = sources[1] ? fetchSource(sources[1]) : [];
    add('early', sources[1] ? '再读取另一位作者的时间线' : '收件箱已经包含本策略的全部来源',
      sources[1] ? '拉策略需要补齐另一位关注作者；混合策略需要把 B 的时间线加入从收件箱取到的 A 帖子。' : '纯推策略只读收件箱，不会在后台分发尚未完成时偷偷再读作者时间线。',
      sources[1] ? `${sourceLabel(sources[1])} → ${earlySecond.join(', ')}\n本次候选：${s.buffer.join(', ')}` : `额外来源读取 = 0\n本次候选：${s.buffer.join(', ')}`,
      '混合策略要有明确的来源划分，避免漏取或重复。此例按帖子 ID 去重，并按时间倒序排列。', sources[1] ? '两个来源均已读取，下一步形成响应。' : '本次数据读取结束；若 P3 还未分发，候选里就没有它。', { active: sources[1] ? ['b', 'feed'] : ['feed'], flows: sources[1] ? ['read-b'] : [] });
    mergeResponse();
    add('early', '返回第一次按时间排序的结果', '合并这次已经读到的候选，按时间倒序返回。结果是否包含 P3，取决于本次使用的来源是否已具备它。',
      `本次候选数 = ${s.buffer.length}\n响应：${s.response.join(' → ')}\n包含 P3：${s.response.includes('P3') ? '是' : '否'}`,
      '新帖已成功保存，并不保证纯推读者立即看到。这里展示的是明确的异步可见边界，不是数据永久丢失。', s.response.includes('P3') ? '第一次响应已经包含 P3；读取来源直接提供了新帖。' : '第一次响应只有旧帖：u1 的分发还没有完成。', { active: ['result'], flows: ['result'] });
    if (fanout) writeBatch(s.queue.length);
    s.status = '分发进度已追平；已经返回的响应不会自动变化。';
    add('finish', fanout ? '后台继续完成剩余分发' : '保持作者存储，等待下一次读取',
      fanout ? '继续处理剩余目标，最后写入 u1 的 P3 引用。现在每个关注者都有新引用，但第一条已返回的响应仍保持原样。' : '本作者没有待分发任务，也没有新增收件箱写入。P3 继续保存在作者时间线上。',
      `剩余目标 = ${s.queue.length}\n收件箱写入总数 = ${s.inboxWrites}\nu1 收件箱 = ${s.inboxes.u1.join(', ') || '空'}\n旧响应：${s.response.join(' → ')}`,
      '分发完成不会自动重写客户端已显示的内容。推送刷新提示或客户端轮询属于另一层机制。', fanout ? 'u1 的引用已追平；右侧仍显示第一次读取的结果。' : '没有后台写入；右侧继续保留第一次响应。', { active: fanout ? ['inbox'] : [author], flows: fanout ? ['fanout-reader', 'fanout-others'] : [] });
    openRequest(2);
    add('finish', 'u1 刷新，发起第二次读取', '开始新的读取请求。保留旧响应直到新请求完成，避免把“数据已更新”和“页面已返回新结果”混为一谈。',
      `第 2 次请求\n来源：${sources.map(sourceLabel).join(' + ')}\n旧响应仍可见`,
      '实际产品还需决定分页游标、刷新策略与缓存有效期。这里仅保留所有三条帖子。', '第二次读取开始，尚未访问新请求的数据来源。', { active: ['feed'] });
    const lastFirst = fetchSource(sources[0]);
    add('finish', '重新读取第一个来源', '这次访问发生在分发追平之后。纯推和混合方案能够读到已写入的引用，拉方案读取作者自己的时间线。',
      `${sourceLabel(sources[0])} → ${lastFirst.join(', ') || '空'}\n累计来源读取 = ${s.reads}`,
      '数据是否新鲜仍受真实存储与缓存语义影响；本例的内存模型在写完后立即可读。', '第一份新候选已取回；上一次响应仍然保留。', { active: ['feed', sources[0] === 'inbox' ? 'inbox' : sources[0]], flows: [`read-${sources[0]}`] });
    if (sources[1]) fetchSource(sources[1]);
    add('finish', sources[1] ? '补齐第二个来源' : '本次只需要这一次收件箱读取',
      sources[1] ? '再取 B 的时间线，与第一份结果组成完整候选集合。两个作者都覆盖后才能形成信息流。' : '纯推方案的一次收件箱读取已拿到所有三条引用，无需再查询两个作者。',
      `本次候选：${s.buffer.join(', ')}\n累计来源读取 = ${s.reads}`,
      '关注作者更多时，纯拉的读取来源会增长。混合减少大作者的发布写入，也保留了读取合并的成本。', '本次候选已完整，下一步排序并返回。', { active: ['feed'], flows: sources[1] ? ['read-b'] : [] });
    mergeResponse();
    add('finish', '三种策略得到相同的最终信息流', '经过该策略要求的存储、分发与读取后，u1 得到同样的 P3、B1、A1。策略改变的是工作发生的位置和可见延迟。',
      `最终响应：${s.response.map(stamp).join('\n')}\n新帖发布者：${author.toUpperCase()}`,
      '这里只证明这组固定输入与顺序下的结果相同，不证明任意故障、并发、权限变更下的端到端一致性。', '第二次响应返回：P3 最新，随后是 B1 和 A1。', { active: ['result'], flows: ['result'] });
    add('review', '用本次实际操作比较代价', '计数只包含一次新帖和两次读取。每个关注者引用写入单独累加，来源读取按访问次数计，合并候选按实际输入条目数计。',
      `作者写入：${s.authorWrites}\n收件箱引用写入：${s.inboxWrites}\n来源读取：${s.reads}\n累计合并候选：${s.merged}`,
      '这些是不同种类的操作，不能直接相加当作耗时。增加 B 的关注者数只会放大推给 B 关注者的写入；更多活跃读者则会放大读取成本。', '推、拉和混合需要结合实际读写负载选择；本页不使用推荐排序模型。');
    return frames;
  }

  function persist() {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ strategy, author, followers: followerCount })) url.searchParams.set(key, String(value));
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    inputs.strategy.value = strategy; inputs.author.value = author; inputs.followers.value = String(followerCount);
  }
  const trace = window.AlgorithmVisualCore.createTrace({ root, cloneState: clone, codeKeyAttribute: 'data-design-key', getCodeScroll: () => null,
    onRender: ({ frame, state }) => {
      for (const node of root.querySelectorAll('[data-node]')) node.classList.toggle('is-current', frame.active.includes(node.dataset.node));
      for (const flow of root.querySelectorAll('[data-flow]')) flow.toggleAttribute('hidden', !frame.flows.includes(flow.dataset.flow));
      const totalFollowers = author === 'a' ? 3 : followerCount;
      const values = { '#decision-title': frame.title, '#decision-why': frame.why, '#decision-evidence': frame.evidence, '#decision-tradeoff': frame.tradeoff, '#step-change': frame.change, '#architecture-description': frame.change,
        '#drawing-stage': { scope: '需求与策略', publish: '发布路径', early: '第一次读取', finish: '追平与刷新', review: '设计取舍' }[frame.key],
        '#author-a': '3 位关注者', '#author-b': `${followerCount} 位关注者`, '#timeline-a': state.timelines.a.join(' + '), '#timeline-b': state.timelines.b.join(' + '), '#fanout-state': state.job,
        '#policy-state': strategy === 'hybrid' ? '混合：A 推，B 拉' : strategy === 'push' ? '推：A 与 B 都分发' : '拉：A 与 B 都不分发',
        '#reader-inbox': sorted(state.inboxes.u1).join(' / ') || '空', '#reader-status': state.inboxes.u1.includes('P3') ? '已有 P3 引用' : '没有 P3 引用',
        '#other-followers': `其余 ${totalFollowers - 1} 位关注者`, '#other-copies': `P3 引用：${state.delivered.filter(user => user !== 'u1').length} 份`,
        '#request-state': state.requestState, '#source-state': state.sourceState, '#result-title': state.responseNumber ? `第 ${state.responseNumber} 次响应` : '尚未返回响应',
        '#result-version': state.responseNumber ? `本次返回 ${state.response.length} 条帖子` : '无', '#selected-author': `本次由 ${author.toUpperCase()} 发布`,
        '#work-count': `作者写 ${state.authorWrites}；收件箱写 ${state.inboxWrites}；读取 ${state.reads}；合并候选 ${state.merged}`, '#status-line': state.status };
      for (const [selector, value] of Object.entries(values)) root.querySelector(selector).textContent = value;
      for (const row of root.querySelectorAll('[data-feed-row]')) row.textContent = state.response[Number(row.dataset.feedRow)] ? stamp(state.response[Number(row.dataset.feedRow)]) : Number(row.dataset.feedRow) === 0 ? '尚未查询' : '';
      Object.assign(root.querySelector('#architecture').dataset, { authorWrites: state.authorWrites, inboxWrites: state.inboxWrites, reads: state.reads, merged: state.merged, pending: state.queue.length, feed: state.response.join(','), inbox: sorted(state.inboxes.u1).join(',') });
    }
  });
  for (const button of root.querySelectorAll('[data-design-key]')) button.addEventListener('click', () => trace.showStep(trace.frames.findIndex(frame => frame.key === button.dataset.designKey)));
  root.querySelector('#restart').addEventListener('click', () => trace.showStep(0));
  for (const input of Object.values(inputs)) input.addEventListener('change', () => {
    strategy = inputs.strategy.value; author = inputs.author.value; followerCount = Number(inputs.followers.value);
    persist(); trace.setFrames(makeFrames(), { initialStep: 0 });
  });
  root.querySelector('.design-roadmap').hidden = false; root.querySelector('.design-controls').hidden = false;
  persist(); trace.setFrames(makeFrames());
})();
