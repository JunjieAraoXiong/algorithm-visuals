(() => {
  'use strict';
  const root = document.querySelector('#design-lesson');
  const frames = [
    {
      key: 'scope', title: '先确认需求和边界', phase: '需求',
      why: '创建短链接，访问时跳转到原网址。沿用本章假设：目标网址不更新、不删除；短码允许 0-9、a-z、A-Z。还要考虑容量与故障。',
      evidence: 'https://example.com/article\n             ↓\nhttps://sho.rt/2crtgcg',
      tradeoff: '暂不做账号、自定义短码与到期功能。这是设计演示，示例请求不连接真实后端。',
      change: '先明确创建与跳转两个动作，再估算它们各有多少流量。',
      nodes: ['browser', 'destination'], flows: ['goal'], active: ['browser', 'destination']
    },
    {
      key: 'scope', title: '把每天的量换成每秒的量', phase: '容量估算 / 流量',
      why: '采用书中的面试假设：每天新增 1 亿条短链，跳转与创建之比为 10:1。先得到平均吞吐量，才知道读写各自的压力。',
      evidence: '写：100,000,000 ÷ 86,400\n  ≈ 1,160 次/秒\n读：写入量 × 10\n  ≈ 11,600 次/秒',
      tradeoff: '这些是平均值，不是峰值或实测。还要问突发流量、热门短链和延迟目标，不能直接据此购买机器。',
      change: '读请求约为写请求的十倍，后面优先讨论读取路径与缓存。',
      nodes: ['browser', 'destination'], flows: ['goal'], active: [], note: 'traffic'
    },
    {
      key: 'scope', title: '十年的记录，需要多大的短码空间', phase: '容量估算 / 存储与短码',
      why: '1 亿条/天 × 365 天 × 10 年 = 3650 亿条记录。每位有 62 种字符：六位容量不足，七位的编码空间足够。',
      evidence: '62^6 ≈ 568 亿 < 3650 亿\n62^7 ≈ 3.52 万亿 > 3650 亿\n\n3650 亿 × 100 bytes = 36.5 TB',
      tradeoff: '36.5 TB 只算网址正文，不含 ID、索引和副本。PDF 的 365 TB 重复乘了十年，此处更正。七位还要求分配的 ID 小于 62^7。',
      change: '先估容量，再选择短码上限；记录总数与 ID 的最大值是两个约束。',
      nodes: ['browser', 'destination'], flows: ['goal'], active: [], note: 'capacity'
    },
    {
      key: 'overview', title: '给两个动作定义接口', phase: '总体设计 / API',
      why: '创建用 POST 提交长网址，访问用 GET 携带短码。这里用简短的示例路径表达本章的两个接口。',
      evidence: 'POST /api/links\n{"long_url":"https://example.com/article"}\n\nGET /2crtgcg',
      tradeoff: '服务需校验 URL 格式，只接受 http/https；不必替用户抓取目标网页。',
      change: '新增 API：把创建和跳转变成两个明确的接口。',
      nodes: ['browser', 'destination', 'api'], flows: ['request'], active: ['api']
    },
    {
      key: 'overview', title: '301 还是 302，先说明取舍', phase: '总体设计 / HTTP 跳转',
      why: '301 表示永久跳转，响应可能被缓存，后续点击可能绕过短链服务。若希望每次导航都到服务端以便统计，可选 302 并明确缓存策略。',
      evidence: '301：永久跳转，可减轻回访流量\n302：临时跳转\n\n本例：302 + Cache-Control: no-store',
      tradeoff: '状态码本身不保证每次回源。本例禁止保存跳转响应；点击统计仍需额外记录逻辑，并未在图中实现。',
      change: '先约定响应行为：API 返回 Location，网页由浏览器另行请求。',
      nodes: ['browser', 'destination', 'api'], flows: ['redirect'], active: ['browser'], note: 'redirect-choice'
    },
    {
      key: 'write', title: '保存 ID、短码和原网址', phase: '深入设计 / 数据模型',
      why: '进程内哈希表无法独自承担长期持久化。用关系表保存映射；按 code 查跳转地址，按 long_url 查是否已有短链。',
      evidence: 'links\n  id        BIGINT PRIMARY KEY\n  code      TEXT UNIQUE NOT NULL\n  long_url  TEXT NOT NULL\n\n查询索引：code、long_url',
      tradeoff: '这是逻辑模型。长 URL 索引的大小、长度限制及分片成本仍需设计；索引不自动保证并发请求去重。',
      change: '新增数据库：保存三个字段，区分短码查询与原网址查询。',
      nodes: ['browser', 'destination', 'api', 'db'], flows: [], active: ['db'], db: 'id / code / long_url'
    },
    {
      key: 'write', title: '比较两种生成方式', phase: '深入设计 / 方案选择',
      why: '截短哈希可能让不同网址得到同一码，需要冲突处理。另一条路是先得到全局唯一 ID，再把数字编码成 Base62。本章采用后一种。',
      evidence: '长 URL → 哈希截短 → 检查冲突\n\n唯一 ID → Base62 → 短码\n本例选择第二条路径',
      tradeoff: 'Base62 不提供加密，也不把长网址压缩成可逆字符串。它依赖 ID 唯一性；连续 ID 还可能让短码容易被枚举。',
      change: '选定“唯一 ID → Base62”；唯一性由 ID 分配方案承担。',
      nodes: ['browser', 'destination', 'api', 'db'], flows: [], active: ['api'], note: 'approaches', db: 'id / code / long_url'
    },
    {
      key: 'write', title: '已有长网址，直接复用短链', phase: '创建 / 查重',
      why: '先按完整 long_url 查表。如果已有记录，返回已有 code 并结束；只有没找到时，才进入后面的 ID 分配与写入。下面跟随新网址分支。',
      evidence: 'SELECT code WHERE long_url = input\n\n找到 → 200 + 已有短链，结束\n未找到 → 分配新 ID（下一步）',
      tradeoff: '这里按完全相同的字符串复用。并发下两个请求可能同时查空；严格去重还需要原子唯一性约束或等价协调。',
      change: '先查询原网址。已有记录走复用分支，新记录才继续创建。',
      nodes: ['browser', 'destination', 'api', 'db'], flows: ['request', 'lookup'], active: ['db'], note: 'dedup', db: '按 long_url 查 code'
    },
    {
      key: 'write', title: '新网址先领取唯一 ID', phase: '创建 / 唯一 ID',
      why: '加入 ID 分配组件，代表所有创建实例共同遵守的全局唯一性规则。它可以用协调后的号段分配；这里不展开具体实现。',
      evidence: 'id = next_unique_id()\n→ 125000000000\n\n本例要求：0 ≤ id < 62^7',
      tradeoff: '普通 64 位 ID 编码后可能需要 11 位。若要短码最多七位，分配器必须控制 ID 范围，并处理耗尽、故障和号段浪费。',
      change: '新增 ID 分配组件：返回示例 ID 125000000000，尚未保存网址映射。',
      nodes: ['browser', 'destination', 'api', 'db', 'id'], flows: ['id-request', 'id-result'], active: ['id'], db: '新映射尚未写入'
    },
    {
      key: 'write', title: '把同一个 ID 写成 Base62', phase: '创建 / Base62',
      why: '使用 0-9、a-z、A-Z 对应 0-61。反复除以 62 取余数，再反向读取；得到的是同一个整数的另一种表示。',
      evidence: '125000000000 ÷ 62\n= 2016129032，余 16 → g\n\n依次取余：g c g t r c 2\n反向读取：2 c r t g c g',
      tradeoff: '不同唯一 ID 的完整编码不会冲突，不能再截断编码。要得到原网址，仍需数据库映射；较小 ID 的编码可以短于七位。',
      change: 'API 本地编码：125000000000 → 2crtgcg，没有额外的网络服务。',
      nodes: ['browser', 'destination', 'api', 'db', 'id'], flows: [], active: ['api'], note: 'encoding', db: '新映射尚未写入'
    },
    {
      key: 'write', title: '把映射原子写入数据库', phase: '创建 / 持久化',
      why: '将 id、code 与 long_url 一起写入并提交。数据库保留主键和短码唯一约束，作为实现出错时的最后一道防线。',
      evidence: 'INSERT links(id, code, long_url)\nVALUES (125000000000,\n        "2crtgcg",\n        "https://example.com/article")',
      tradeoff: '若 ID 或 code 冲突，应检查分配器与实现，不能覆盖旧映射。严格的原网址去重也必须在这一写入边界协调。',
      change: 'API → 数据库：提交 ID、短码、原网址三个字段。',
      nodes: ['browser', 'destination', 'api', 'db', 'id'], flows: ['write'], active: ['db'], db: '2crtgcg → /article'
    },
    {
      key: 'write', title: '写成功以后才返回短链', phase: '创建 / 响应',
      why: '确认新映射已经持久化后，API 才返回地址。若刚才查重时找到已有记录，则早已返回旧短链，不会经过这一写入分支。',
      evidence: 'HTTP/1.1 201 Created\n\n{"short_url":\n "https://sho.rt/2crtgcg"}',
      tradeoff: '201 表示本次新建；复用分支可返回 200。写入失败时要明确失败，不能返回没有映射的短链接。',
      change: 'API → 浏览器：新短链已保存，可以被访问。',
      nodes: ['browser', 'destination', 'api', 'db', 'id'], flows: ['created'], active: ['browser'], db: '2crtgcg → /article'
    },
    {
      key: 'read', title: '访问时按短码查表', phase: '跳转 / 查询',
      why: '浏览器请求 GET /2crtgcg。API 用 code 查数据库，拿到 long_url。这是还没有缓存时的最小读取路径。',
      evidence: 'GET /2crtgcg\n\nSELECT long_url FROM links\nWHERE code = \'2crtgcg\';',
      tradeoff: '找不到映射就返回 404；数据库故障不能伪装成“链接不存在”。',
      change: '浏览器 → API → 数据库：用短码查出原网址。',
      nodes: ['browser', 'destination', 'api', 'db', 'id'], flows: ['request', 'lookup'], active: ['db'], request: 'GET /2crtgcg', db: '2crtgcg → /article'
    },
    {
      key: 'read', title: '返回地址，不转发网页', phase: '跳转 / 响应',
      why: 'API 返回 302，Location 指向原网址。此时浏览器收到的是跳转指令，还没有从我们的 API 拿到目标网页。',
      evidence: 'HTTP/1.1 302 Found\nLocation: https://example.com/article\nCache-Control: no-store',
      tradeoff: '302 本身不等于“禁止缓存”。本例显式设置 no-store，让浏览器每次都请求短链服务。',
      change: 'API → 浏览器：302 响应携带原网址。',
      nodes: ['browser', 'destination', 'api', 'db', 'id'], flows: ['redirect'], active: ['browser'], db: '2crtgcg → /article'
    },
    {
      key: 'read', title: '浏览器另发一次请求', phase: '跳转 / 打开网页',
      why: '浏览器读取 Location，再向 example.com 发起新请求。目标网页的内容来自目标站点，短链 API 不代理这次下载。',
      evidence: 'Browser → example.com\nGET /article\n\n目标站点返回网页内容',
      tradeoff: '这是一轮额外的网络往返；短链服务也无法保证外部目标网页始终可用。',
      change: '浏览器 → 原网页：新请求绕过短链 API。最小功能已经跑通。',
      nodes: ['browser', 'destination', 'api', 'db', 'id'], flows: ['visit'], active: ['destination'], db: '2crtgcg → /article'
    },
    {
      key: 'read', title: '重复读取多了，再加缓存', phase: '设计扩展 / 缓存',
      why: '按前面的 10:1 读写比，跳转读取比创建频繁。若热点链接反复回源，增加共享缓存来保存映射；缓存收益还取决于命中率。',
      evidence: '缓存键：2crtgcg\n缓存值：long_url\n\n读取顺序：Cache → Database',
      tradeoff: '这里缓存的是服务端映射；HTTP no-store 控制的是浏览器等客户端的响应缓存，两者不冲突。',
      change: '新增 Cache。它保存可丢失的副本，数据库仍是权威存储。',
      nodes: ['browser', 'destination', 'api', 'db', 'id', 'cache'], flows: ['cache-get'], active: ['cache'], cache: '空 / 尚未加载', db: '2crtgcg → /article'
    },
    {
      key: 'read', title: '第一次读：缓存没有记录', phase: 'Cache-Aside / 未命中',
      why: 'API 先向缓存查询 code。缓存返回 MISS，只能说明副本里没有这条记录，不能说明数据库里也没有。',
      evidence: 'GET cache[2crtgcg]\n→ MISS\n\n下一步：查询 Database',
      tradeoff: '未命中时多了一次缓存查询，所以缓存不是让每一次请求都更快。',
      change: 'API 查询缓存；Cache → API：MISS。此刻还没有读取数据库。',
      nodes: ['browser', 'destination', 'api', 'db', 'id', 'cache'], flows: ['cache-get', 'cache-miss'], active: ['cache'], cache: 'MISS / 无副本', db: '2crtgcg → /article'
    },
    {
      key: 'read', title: '未命中后读取数据库', phase: 'Cache-Aside / 回源',
      why: '由 API 查询数据库并取回 long_url。这里是应用主动管理的 Cache-Aside，缓存本身不会替 API 去数据库取数据。',
      evidence: 'API → Database: SELECT\nDatabase → API: long_url\n\n本次数据库读取：1 次',
      tradeoff: '缓存大面积失效会把流量压回数据库，需要另行设计限流和保护。',
      change: 'API → 数据库 → API：得到持久化的原网址。',
      nodes: ['browser', 'destination', 'api', 'db', 'id', 'cache'], flows: ['lookup', 'db-result'], active: ['api', 'db'], cache: '尚未填充', db: '2crtgcg → /article'
    },
    {
      key: 'read', title: '把读到的映射放入缓存', phase: 'Cache-Aside / 填充',
      why: 'API 将刚查到的映射写入缓存并设置 TTL，随后仍按前面的 302 流程响应浏览器。下次访问就有机会直接命中。',
      evidence: 'SET cache[2crtgcg] = long_url\nTTL = 300s（演示选择）\n\n接着返回 302 + Location',
      tradeoff: 'TTL 是缓存副本的寿命，不是短链接的寿命；即使副本过期，数据库中的映射仍有效。',
      change: 'API → Cache：填充映射。完成后才能在下一次请求中命中。',
      nodes: ['browser', 'destination', 'api', 'db', 'id', 'cache'], flows: ['cache-fill'], active: ['cache'], cache: '2crtgcg 已缓存', db: '2crtgcg → /article'
    },
    {
      key: 'read', title: '再次访问：跳过数据库', phase: 'Cache-Aside / 命中',
      why: '同一短码在 TTL 内再次被访问，API 从缓存拿到 long_url，再返回同样的跳转响应。数据库不参与这一次读取。',
      evidence: 'GET cache[2crtgcg] → HIT\n\n本次数据库读取：0 次\n响应仍然是 302 + Location',
      tradeoff: '本例假设目标网址不修改。如果允许更新或删除，必须补上缓存失效方案。',
      change: 'Cache → API：HIT。数据库仍保留数据，但本次没有读取箭头。',
      nodes: ['browser', 'destination', 'api', 'db', 'id', 'cache'], flows: ['cache-get', 'cache-hit'], active: ['cache', 'api'], cache: 'HIT / 返回 long_url', db: '本次不读取'
    },
    {
      key: 'scale', title: 'API 忙了，再增加实例', phase: '设计扩展 / 服务容量',
      why: '当 API 的处理能力成为瓶颈，增加负载均衡和第二台无状态服务。任一实例都从共享缓存与数据库读取映射；创建时也必须遵守同一套唯一 ID 分配规则。',
      evidence: 'Browser → Load balancer\n               ↙    ↘\n             API A  API B\n\n共享 Cache 与 Database',
      tradeoff: '这只扩展 API 容量。数据库、缓存或负载均衡仍可能成为瓶颈或单点，不能据此宣称整套系统高可用。',
      change: '新增负载均衡和 API B：同一个短链接不依赖某一台 API 的本地内存。',
      nodes: ['browser', 'destination', 'api', 'db', 'id', 'cache', 'balancer', 'api2'], flows: ['balance-in', 'balance-a', 'balance-b', 'cache-get', 'lookup', 'shared-cache', 'shared-db', 'visit', 'id-result', 'shared-id'], active: ['balancer', 'api2'], cache: '共享映射副本', db: '共享权威数据'
    },
    {
      key: 'scale', title: '回到需求，检查没有解决的部分', phase: '回顾与扩展',
      why: '创建路径依赖唯一 ID 与数据库；读取路径先缓存、后数据库，再由浏览器跳转。现在逐个问：哪个组件故障会阻塞哪条路径？',
      evidence: '创建：复用 / 唯一 ID → Base62 → 落库\n读取：Cache → Database → 302\n\n后续：限流、复制、分片、点击统计',
      tradeoff: '3650 亿条记录不会靠一张草图自动获得扩展性。ID 分配、存储分片、容灾与监控需要继续深入设计。',
      change: '形成一个可解释的设计起点；新增组件都应对应容量、延迟或可靠性需求。',
      nodes: ['browser', 'destination', 'api', 'db', 'id', 'cache', 'balancer', 'api2'],
      flows: ['balance-in', 'balance-a', 'balance-b', 'cache-get', 'lookup', 'shared-cache', 'shared-db', 'visit', 'id-result', 'shared-id'],
      active: [], cache: '共享映射副本', db: '共享权威数据'
    }
  ].map((frame, index) => ({ ...frame, sourceKeys: [frame.key], stepLabel: `${index + 1}. ${frame.title}`, state: {} }));

  let previousNodes = new Set();
  const trace = window.AlgorithmVisualCore.createTrace({
    root, cloneState: state => ({ ...state }),
    codeKeyAttribute: 'data-design-key',
    getCodeScroll: () => null,
    onRender: ({ frame }) => {
      for (const node of root.querySelectorAll('[data-node]')) {
        const visible = frame.nodes.includes(node.dataset.node);
        node.toggleAttribute('hidden', !visible);
        node.classList.toggle('is-current', frame.active.includes(node.dataset.node));
        node.classList.toggle('is-new', visible && !previousNodes.has(node.dataset.node));
      }
      previousNodes = new Set(frame.nodes);
      for (const note of root.querySelectorAll('[data-note]')) {
        note.toggleAttribute('hidden', note.dataset.note !== frame.note);
      }
      for (const flow of root.querySelectorAll('[data-flow]')) {
        const visible = frame.flows.includes(flow.dataset.flow);
        flow.toggleAttribute('hidden', !visible);
        flow.classList.toggle('is-current', visible);
      }
      const fields = { '#decision-title': frame.title, '#decision-why': frame.why,
        '#decision-evidence': frame.evidence, '#decision-tradeoff': frame.tradeoff,
        '#step-change': frame.change, '#drawing-stage': frame.phase,
        '#architecture-description': frame.change,
        '#cache-state': frame.cache || '热点映射 / TTL', '#db-state': frame.db || 'code → long_url',
        '[data-flow-label]': frame.request || 'POST /api/links' };
      for (const [selector, value] of Object.entries(fields)) root.querySelector(selector).textContent = value;
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
