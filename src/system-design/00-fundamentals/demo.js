(() => {
  'use strict';
  const root = document.querySelector('#design-lesson');
  const frames = [];
  const stages = { needs: '需求与量级', request: '一次请求', grow: '按需加组件', data: '数据增长', failure: '故障与取舍' };
  const add = (key, scene, title, why, evidence, tradeoff, change, active = [], flows = [], detail = null) => {
    frames.push({
      key, title, why, evidence, tradeoff, change,
      state: { scene, active, flows, detail },
      sourceKeys: [key], stepLabel: `${frames.length + 1}. ${title}`
    });
  };

  add('needs', 'scope', '先确定问题，再画系统',
    '例子是个人笔记：用户能保存并查看自己的笔记。先从 Client → API → Database 开始，再问高峰有多少请求、读取要多快、写入成功意味着什么。',
    '功能：保存、查看自己的笔记\n示例目标：读取 p95 ≤ 200 ms\n示例约定：保存成功 = 事务已提交\n范围：先不做搜索、协作编辑',
    '需求越宽，状态与故障组合越多。先明确范围；本页是概念演示，示例数值不是生产容量或性能承诺。',
    '先写下用户要做什么，再明确延迟、流量和故障目标；组件选择由这些要求驱动。',
    ['scope-client', 'scope-api', 'scope-db'], ['scope-read', 'scope-data']);

  add('needs', 'metrics', '延迟与吞吐量回答不同问题',
    '延迟是一次请求从发出到收到结果的时间；吞吐量是单位时间内完成的工作量。多个请求可以同时处理，所以系统吞吐量不能直接用单次延迟的倒数推算。',
    '示例观测（非性能目标）：\n一次请求延迟 = 100 ms\n一秒内完成 = 10 次请求\n\n还需观察慢请求分位数，如 p95',
    'QPS 常用来表示每秒查询 / 请求数，必须说明统计的是到达还是完成。若到达长期超过处理能力，队列会增长，延迟也会上升。',
    '把“一个用户要等多久”和“全系统每秒完成多少”分开衡量；平均延迟也不能代表所有用户。',
    [], ['latency'], 'latency');

  add('needs', 'metrics', '先估量级，再验证峰值',
    '用用户量与每人的操作频次估算平均读取流量，再单独假设峰值。这个计算帮助发现数量级；真实容量还受读写比例、数据大小与操作成本影响。',
    '示例假设：\n10,000 人 × 20 次读取 / 天\n= 200,000 次 / 天\n平均 QPS ≈ 200,000 / 86,400 ≈ 2.3\n假设高峰 × 10 → 约 23 QPS',
    '10 倍高峰只是演示假设，不是通用规律。不能根据平均 QPS 决定机器数；应测量实际峰值、单请求成本与资源饱和度。',
    '估算得出的是平均读取速率。高峰、写入、文件大小和存储增长需要各自估算。',
    [], [], 'estimate');

  add('request', 'request', 'DNS：先把域名解析成地址',
    '浏览器访问 notes.example，先检查浏览器或操作系统的 DNS 缓存。没有可用地址时，才向 DNS 解析器查询；解析器也可用自己的缓存，或继续向上游查找。',
    'URL: https://notes.example/notes/42\n本机缓存命中 → 直接用地址\n本机未命中 → 查询 DNS 解析器\n拿到地址 → 连接服务端口',
    '解析器缓存命中仍有客户端到解析器的查询，只是省去继续向上游查找。DNS 不转发笔记内容；地址也可能对应负载均衡器或 CDN。',
    'DNS 只解决“去哪里”。笔记正文不会经过 DNS 解析器。',
    ['browser', 'dns'], ['dns-lookup']);

  add('request', 'request', 'HTTPS：建立可安全传输的连接',
    '本图选用一个新建 HTTP/1.1 + TLS 连接：先建立 TCP 连接，再完成 TLS 握手与证书验证，然后传输 HTTP 请求。建立连接本身也会花时间。',
    '本例：新连接\nTCP 建连 → TLS 握手 → HTTP\n\n已有连接可复用，跳过重复建连',
    '这是一种具体路径，不是所有 HTTP 版本的统一流程；HTTP/3 使用 QUIC。HTTPS 保护传输，应用仍需检查谁能读写哪篇笔记。',
    '找到地址后建立连接；复用连接时，不必为每个请求重复 DNS 查询、TCP 与 TLS 握手。',
    ['browser', 'api'], ['connect']);

  add('request', 'request', 'Client → API：表达一次操作',
    '浏览器发送 GET /notes/42。API 根据方法与路径找到处理逻辑，验证登录身份与笔记访问权限，然后准备查询数据；API 是接口约定，服务端是运行实现的地方。',
    'GET /notes/42\n方法：读取\n路径：哪条资源\n身份：由服务端验证\n权限：这位用户能否查看？',
    '客户端不能绕过业务权限直接操作内部数据库。输入验证、限流与错误处理都属于服务端需要明确的边界。',
    '请求已到 API；尚未读出笔记。身份与权限检查先于返回私有内容。',
    ['api'], ['http-request']);

  add('request', 'request', 'API → Database：读取持久数据',
    'API 根据笔记 ID 和已验证用户查询记录。数据库负责保存与查找数据；合适的索引可以避免为了找到一篇笔记而扫描全部记录。',
    '已验证用户：user:7\n查询条件：id=42 且 owner_id=7\n数据库结果：笔记记录 / 不存在\n\n写入还要定义事务边界',
    'API 与数据库是不同的职责，也会独立变慢或失败。加更多 API 实例，不会让一个低效查询变得更便宜。',
    '请求沿 Client → API → Database 到达持久数据；优化前先看查询实际做了多少工作。',
    ['db'], ['http-request', 'db-query']);

  add('request', 'request', '把结果送回客户端',
    '数据库把记录交回 API，API 组织状态码与响应正文，再经已有连接返回浏览器。成功读取示例返回 200 OK 和 JSON；不存在或无权限应有明确的接口行为。',
    'Database → API：笔记记录\nAPI → Client：200 OK + JSON\n\n端到端延迟包含网络、排队与处理',
    'API 返回成功应有业务定义。保存笔记时，“已接收任务”与“已持久提交”不同，不能只看到一个成功状态码就认为所有后台工作都结束。',
    '一次读取闭环：请求去往数据，响应沿服务端回到浏览器；最小系统已经能工作。',
    ['db', 'api', 'browser'], ['db-return', 'http-response']);

  add('grow', 'cache', '重复读取多，再加缓存',
    '采用 cache-aside：API 先查缓存；未命中时查询数据库，把结果填入缓存再返回。后续命中可以省去这次数据库查询，但缓存值可能已过期。',
    '① API → Cache：查 notes:42\n② miss → API 查询 Database\n③ API 将结果填入 Cache\nhit → API 使用缓存值返回',
    '缓存增加失效与一致性问题。需决定过期时间和写入后的删除 / 更新策略；它不是唯一持久记录，也不保证每次都比数据库快。',
    '缓存是一份可重建的副本。图中是 miss 路径，数据库仍是这条记录的持久来源。',
    ['cache-api', 'cache-store'], ['cache-client', 'cache-check', 'cache-miss', 'cache-fill']);

  add('grow', 'cdn', '大文件：分开保存原件与分发副本',
    '笔记附件可按 key 放入对象存储，数据库保存文件 key、归属等元信息。需要减少远距离传输时，再让 CDN 缓存可公开或经授权的文件内容。',
    'Database：文件 key、归属、权限\nObject storage：原始文件字节\nCDN：靠近用户的缓存副本\n\n边缘未命中 → 回源取文件',
    'CDN 不替代原件，也不自动缓存任意私有 API 响应。文件授权、更新、缓存失效与流量成本需要单独设计。',
    '这张图只看文件交付：对象存储保存，CDN 分发；小系统不一定同时需要两者。',
    ['edge-cache', 'origin'], ['edge-read', 'origin-read']);

  add('grow', 'scale', '无状态 API 才容易增加实例',
    '当 API 计算或并发成为瓶颈，可先评估升级单机，再考虑增加实例。负载均衡器把请求分给健康实例；持久业务与会话状态放在共享存储，任一实例都能继续处理。',
    '纵向扩展：单机更强\n横向扩展：实例更多\nLB：为请求选择 API A 或 B\n持久 / 会话状态：外置共享',
    '无状态不表示没有变量，而是不依赖某台实例独有的跨请求状态，例如仅在本机内存的会话。LB 也需要故障策略；共享数据库仍可能成为瓶颈。',
    '增加的是 API 执行能力；负载均衡负责分发，不复制数据库，也不消除下游瓶颈。',
    ['lb', 'api-a', 'api-b'], ['lb-in', 'lb-a', 'lb-b', 'a-db', 'b-db']);

  add('grow', 'queue', '允许延后完成，再使用队列',
    '导出所有笔记可以先接收任务、返回 task_id，之后由 worker 领取并处理。用户稍后查询结果；耗时工作不必一直占用最初的请求连接。',
    'API → Queue：提交导出任务\nAPI → Client：已接收 + task_id\nWorker → 处理 → 保存结果 → 确认\nClient：稍后查询状态',
    '任务可能重复投递或处理失败。需要幂等、有限重试、失败任务处置与积压监控。队列缓冲短时突发，不能解决无限持续的超载。',
    '队列保存“待处理”，worker 执行工作；已入队与已完成是两个不同状态。',
    ['queue-store', 'queue-worker'], ['job-submit', 'job-consume']);

  add('data', 'replica', '复制：相同记录，多份数据',
    '把主库变化复制到副本，可以支持冗余或分担读取。图中使用异步复制：主库已到 v2，副本仍可能暂时是 v1；复制不是瞬间完成。',
    '主库：notes:42 = v2\n副本：notes:42 = v1 → v2\n\n同一条记录，出现在多份存储中',
    '读副本可能读到旧值；同步复制会增加写入等待与故障耦合。故障切换不自动发生，副本也不能替代可恢复历史的备份。',
    '复制增加同一数据的副本；“有两台数据库”不等于“每次读都一样新”。',
    ['primary', 'replica'], ['replicate']);

  add('data', 'partition', '分区：不同记录，分开承担',
    '当数据量或负载超出单个节点能力，可以按 key 把记录划分到不同分区。示例用 user_id 的奇偶路由，使某位用户的笔记有确定归属。',
    '示例分区规则：user_id % 2\n0 → Partition 0\n1 → Partition 1\n\n不同记录；每个分区还可有自己的副本',
    '分区不是复制。跨分区查询、事务、再平衡与热点会更复杂；奇偶只是演示规则，真实分区键必须匹配访问方式与负载分布。',
    '复制是“同样的数据多份”，分区是“不同的数据分摊”；两者可以组合，但解决的问题不同。',
    ['partition-router', 'partition-even', 'partition-odd'], ['route-even', 'route-odd']);

  add('failure', 'failure', '超时后，先承认结果未知',
    '保存笔记可能已经提交，但响应在途中丢失。客户端超时只说明没收到结果；直接重复创建可能产生两篇笔记。重试应沿用同一个幂等 key，让服务端识别同一操作。',
    'POST /notes，key=a7\n数据库：笔记与 a7 原子记录成功\n响应丢失 → 客户端超时\n有限重试：仍用 a7 → 返回已有结果',
    '去重记录须持久保存，并与业务副作用原子关联；同一 key 还应校验请求内容。只重试适合重试的错误，采用退避、抖动、次数与总时限，避免放大过载。',
    '时间向下：写入成功 → 响应丢失 → 同 key 重试。超时不是“没执行”，幂等也不是自动获得的保证。',
    ['retry-api', 'retry-db'], ['write', 'commit', 'lost', 'retry']);

  add('failure', 'consistency', '断连时，明确愿意放弃什么',
    '主库写入 v2 后与副本失联。此时访问隔离副本的请求，若立即返回本地 v1，就可能不是最新值；若必须保证最新值，就不能把 v1 当作成功的最新读取。',
    '已知：Primary = v2，Replica = v1\n故障：复制链路中断\n\n选择一：返回可能过期的本地值\n选择二：等待 / 拒绝，直到能确认',
    '这是网络分区中的具体取舍，不是任意情况下的“选两个”口号。可用性与一致性要求要按操作定义；支付确认与笔记列表可以有不同要求。',
    '从需求回到取舍：能否读旧值、多久必须响应、失败如何恢复，决定最后选择哪些组件与协议。',
    ['isolated-primary', 'isolated-replica'], ['primary-write', 'replica-read']);

  const trace = window.AlgorithmVisualCore.createTrace({
    root,
    cloneState: state => structuredClone(state),
    codeKeyAttribute: 'data-design-key',
    getCodeScroll: () => null,
    onRender: ({ frame, state }) => {
      for (const element of root.querySelectorAll('[data-scene]')) {
        element.toggleAttribute('hidden', element.dataset.scene !== state.scene);
      }
      for (const element of root.querySelectorAll('[data-node]')) {
        element.classList.toggle('is-current', state.active.includes(element.dataset.node));
      }
      for (const element of root.querySelectorAll('[data-flow]')) {
        const active = state.flows.includes(element.dataset.flow);
        element.toggleAttribute('hidden', !active);
        element.classList.toggle('is-current', active);
      }
      for (const element of root.querySelectorAll('[data-detail]')) {
        element.toggleAttribute('hidden', element.dataset.detail !== state.detail);
      }
      const fields = {
        '#decision-title': frame.title,
        '#decision-why': frame.why,
        '#decision-evidence': frame.evidence,
        '#decision-tradeoff': frame.tradeoff,
        '#step-change': frame.change,
        '#architecture-description': frame.change,
        '#drawing-title': frame.title,
        '#drawing-stage': stages[frame.key]
      };
      for (const [selector, text] of Object.entries(fields)) root.querySelector(selector).textContent = text;
    }
  });
  for (const button of root.querySelectorAll('[data-jump]')) {
    button.addEventListener('click', () => trace.showStep(Number(button.dataset.jump)));
  }
  root.querySelector('#restart').addEventListener('click', () => trace.showStep(0));
  root.querySelector('.design-roadmap').hidden = false;
  root.querySelector('.design-controls').hidden = false;
  trace.setFrames(frames);
})();
