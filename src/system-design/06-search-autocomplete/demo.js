(() => {
  'use strict';
  const root = document.querySelector('#design-lesson');
  const original = { can: 4, cap: 6, car: 20, cat: 12, dog: 10, dot: 8 };
  const query = new URLSearchParams(location.search);
  const validPrefix = value => /^[a-z]{0,3}$/i.test(value ?? '') ? (value ?? 'ca').toLowerCase() : 'ca';
  const integer = (value, fallback, max) => /^\d+$/.test(value || '') && Number(value) >= 1 && Number(value) <= max ? Number(value) : fallback;
  let prefix = query.has('prefix') ? validPrefix(query.get('prefix')) : 'ca';
  let k = integer(query.get('k'), 3, 3);
  let updateWord = Object.hasOwn(original, query.get('word')) ? query.get('word') : 'cap';
  let newFrequency = integer(query.get('frequency'), 30, 99);
  const fields = { prefix: root.querySelector('#prefix'), k: root.querySelector('#top-k'), word: root.querySelector('#update-word'), frequency: root.querySelector('#new-frequency') };
  const clone = value => structuredClone(value);
  const rank = items => items.sort((a, b) => b.frequency - a.frequency || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  const format = list => list.length ? list.map(item => `${item.word}:${item.frequency}`).join('，') : '无匹配结果';

  function snapshot(frequencies, version) {
    const nodes = { '': { children: [], word: null } };
    for (const word of Object.keys(frequencies)) {
      for (let length = 1; length <= word.length; length++) {
        const path = word.slice(0, length);
        if (!nodes[path]) {
          nodes[path] = { children: [], word: null };
          nodes[path.slice(0, -1)].children.push(path);
        }
      }
      nodes[word].word = word;
    }
    const caches = {};
    for (const path of Object.keys(nodes)) {
      caches[path] = rank(Object.entries(frequencies).filter(([word]) => word.startsWith(path)).map(([word, frequency]) => ({ word, frequency }))).slice(0, 3);
    }
    return { frequencies: clone(frequencies), version, nodes, caches };
  }

  function find(snapshotValue) {
    const path = [''];
    for (let length = 1; length <= prefix.length; length++) {
      const next = prefix.slice(0, length);
      if (!snapshotValue.nodes[next]) return { path, found: false, missing: next };
      path.push(next);
    }
    return { path, found: true };
  }

  function collect(snapshotValue) {
    const visited = [], matches = [];
    if (!snapshotValue.nodes[prefix]) return { visited, matches };
    const walk = path => {
      visited.push(path);
      const node = snapshotValue.nodes[path];
      if (node.word) matches.push({ word: node.word, frequency: snapshotValue.frequencies[node.word] });
      node.children.forEach(walk);
    };
    walk(prefix);
    return { visited, matches };
  }

  function makeFrames() {
    const frames = [];
    const state = { serving: snapshot(original, 1), source: clone(original), draft: null, result: null, path: [], visited: [], mode: '尚未查询', work: '词频保存在单词末端', status: '查询路径与词频更新路径相互独立', active: '' };
    const add = (key, title, why, evidence, tradeoff, change) => frames.push({ key, title, why, evidence, tradeoff, change, state: clone(state), sourceKeys: [key], stepLabel: `${frames.length + 1}. ${title}` });
    const queryText = `prefix = ${prefix || '空前缀'}，K = ${k}`;
    const lookup = find(state.serving);
    const collected = collect(state.serving);
    add('scope', '先确定补全规则', '六个英文词组成小词典。输入前缀，返回词频最高的 K 个匹配词；同频时按字母顺序决定先后。', `${queryText}\n词典：can、cap、car、cat、dog、dot`, '本例不做拼写纠错、个性化或语义搜索。词频是演示数据，不是生产排名指标。', '先限定：按前缀匹配，按词频降序返回最多 K 个词。');
    add('scope', '用共享前缀组织词典', '每条边延伸一个字符。沿根节点到末端的路径拼出单词，末端保存词频；car 和 cat 共享 c、a 两段路径。', 'root → c → a → r = car\ncar:20，cat:12，cap:6，can:4\ndog:10，dot:8', '这里只展示完整单词的频率。节点代表前缀，不代表每个前缀都是一个完整单词。', '建立 Trie；后续查询沿字符路径走，不改变节点位置。');
    state.path = lookup.path;
    state.mode = '定位前缀';
    state.work = lookup.found ? `读取 ${prefix.length} 个前缀字符` : `缺少路径：${lookup.missing}`;
    add('query', lookup.found ? '沿字符找到前缀节点' : '遇到缺失的字符路径', lookup.found ? `从根节点依次读取前缀 ${prefix || '（空）'}。${prefix ? '找到对应节点后，只搜索它下面的子树。' : '空前缀停在根节点，候选范围是整个词典。'}` : '某个字符没有对应的下一条边，说明词典中没有以这个前缀开头的词，可以直接返回空结果。', `${queryText}\n访问：${lookup.path.map(path => path || 'root').join(' → ')}${lookup.found ? '' : `\n缺失：${lookup.missing}`}`, '查找需要处理前缀的 p 个字符。字符集和字符串规范化也属于设计前提。', lookup.found ? `高亮 ${lookup.path.length} 个路径节点，定位查询起点。` : `路径停在 ${lookup.path.at(-1) || 'root'}；找不到 ${lookup.missing}。`);
    state.visited = collected.visited;
    state.mode = '遍历匹配子树';
    state.work = `子树访问 ${collected.visited.length} 节点；候选 ${collected.matches.length} 词`;
    add('query', '收集匹配子树的完整单词', '从前缀节点做深度优先遍历。经过中间节点还不算找到单词，只有带终止标记的节点才加入候选。', `访问节点数 = ${collected.visited.length}\n匹配单词数 = ${collected.matches.length}\n候选：${format(collected.matches)}`, '短前缀可能对应很大的子树。节点访问数不是匹配词数，二者不能直接混为一谈。', `本次遍历得到 ${collected.matches.length} 个候选，尚未按热度返回。`);
    state.result = rank(clone(collected.matches)).slice(0, k);
    state.mode = '遍历后排序';
    add('query', '按词频排序并截取 K 个', '把所有匹配词按词频降序排列，同频用字母顺序打破平局；只返回前 K 个，不足 K 个就全部返回。', `候选 C = ${collected.matches.length}\nK = ${k}\n返回：${format(state.result)}`, '此处使用完整排序，开销随候选数增长；也可以用大小为 K 的堆减少选取成本。', `返回 ${state.result.length} 个词：${format(state.result)}。`);
    state.visited = [];
    state.mode = '节点缓存已准备';
    state.work = '每个节点最多缓存 3 个词';
    add('cache', '在每个前缀节点预存 Top-3', '离线构建时，为每个前缀保存排好序的前三个候选。在线查询先找到前缀，再读取已有候选，不再遍历子树。', `本页缓存上限 = 3\n节点 ${prefix || 'root'}：${format(state.serving.caches[prefix] || [])}`, '把查询计算提前，会增加存储和构建成本。K 超过缓存上限时，需要更大的缓存或额外查询策略。', '把排序结果放入快照的节点缓存，作为后续查询的捷径。');
    state.result = (state.serving.caches[prefix] || []).slice(0, k);
    state.mode = '读取 v1 缓存';
    state.work = `前缀 ${prefix.length} 字符；返回 ${state.result.length} 词`;
    add('cache', '同样的请求直接读取缓存', '查询路径仍要读取前缀字符，随后复制缓存中的前 K 个词。结果与遍历排序相同，但省去在线扫描和排序。', `${queryText}\nv1 返回：${format(state.result)}`, '这是有界 Top-K 查询；读取前缀和输出字符串都需要工作，不能笼统称为无条件 O(1)。', `缓存查询返回 ${format(state.result)}，服务版本仍为 v1。`);
    state.source[updateWord] = newFrequency;
    state.active = 'source';
    state.status = `词频源已更新；v1 仍保存 ${updateWord}:${original[updateWord]}`;
    add('update', '先更新词频源', '日志汇总先改变词频源。正在服务的 Trie 和节点缓存属于旧快照，不会因为源数据改变就自动更新。', `词频源：${updateWord} ${original[updateWord]} → ${newFrequency}\n服务快照 v1：${updateWord} = ${original[updateWord]}`, '实时逐条更新所有祖先缓存也可行，但会增加写放大和并发控制；这里选择批量构建快照。', `源数据中的 ${updateWord} 变为 ${newFrequency}；右侧仍保留上一条查询结果。`);
    state.active = '';
    state.result = (state.serving.caches[prefix] || []).slice(0, k);
    state.mode = '更新后再次读取 v1';
    add('update', '新请求仍读到旧快照', '现在发起相同查询。查询进程仍指向 v1，因此读到旧词频和旧排序；源数据新鲜并不代表服务索引新鲜。', `词频源 ${updateWord} = ${newFrequency}\nv1 返回：${format(state.result)}`, '这里的旧结果是快照策略允许的滞后。产品必须决定可接受的延迟，而不是把这种状态误认为查询失败。', `重新查询仍返回 ${format(state.result)}；这次读取实际使用 v1。`);
    state.draft = snapshot(state.source, 2);
    state.active = 'build';
    state.status = 'v2 构建完成，尚未发布；查询仍读取 v1';
    add('update', '离线构建完整的 v2', '读取词频源，重新生成 Trie 和所有前缀的 Top-3。新版本在旁边构建，完成之前不影响在线查询。', `v2 节点 ${prefix || 'root'}：${format(state.draft.caches[prefix] || [])}\n服务指针 → v1`, '构建期间同时保存两个版本，需要额外空间。实际系统还要校验快照并保留失败回滚的版本。', 'v2 已准备好；服务版本和上一次查询结果仍未改变。');
    state.serving = state.draft;
    state.draft = null;
    state.active = 'publish';
    state.status = '服务指针切换到 v2；上一条响应仍来自 v1';
    add('update', '把服务指针切换到 v2', '以一次切换替换当前快照。树上的词频现在来自 v2，下一条请求才能使用新的节点缓存。', `服务指针：v1 → v2\n${updateWord} = ${newFrequency}\n上一条响应仍是 v1 的结果`, '本例只有一个查询进程；多实例分发不能靠这一个动作自动同步，需要版本发布协议。', '发布 v2；右侧保留上一条响应，避免把发布画成已经完成新查询。');
    state.active = '';
    state.result = (state.serving.caches[prefix] || []).slice(0, k);
    state.mode = '读取 v2 缓存';
    state.status = '新查询已经使用 v2';
    state.work = `前缀 ${prefix.length} 字符；返回 ${state.result.length} 词`;
    add('update', '新请求读取新版本结果', '再执行相同查询，这次读取 v2 的节点缓存。若更新词不匹配前缀，或它没有进入 Top-K，返回顺序也可能保持不变。', `v2 返回：${format(state.result)}\n更新词：${updateWord}:${newFrequency}`, '词频变化未必改变每个前缀的结果。缓存必须由数据计算，而不是把“更新”固定画成首位发生变化。', `v2 查询返回 ${format(state.result)}。`);
    add('review', '比较查询成本与更新成本', '遍历方案每次查找前缀、访问匹配子树，再选取热门词；缓存方案把子树扫描和排序移到构建阶段。', `遍历：O(p + V + C log C)\n缓存：O(p + K)，另计字符串输出\np=${prefix.length}，V=${collected.visited.length}，C=${collected.matches.length}，K=${k}`, '以上忽略同频字符串比较及字符复制成本。实际输出成本随返回词的总长度增长，缓存空间也随节点数增长。', '较快的查询来自预先计算，代价是更多存储、构建工作与更新滞后。');
    add('review', '把词典范围与发布约束说清楚', '这个小模型已连起前缀查询、Top-K 缓存和快照发布。扩展时再考虑更大词典、输入规范化、敏感词过滤和版本回滚。', `词典 = 6 个词\n前缀长度 ≤ 3，K ≤ 3\n当前服务版本 = v${state.serving.version}`, '本例不搭建真实服务。生产中的日志采集、隐私处理、分片与部署都需要单独设计。', '完成：同一条查询可以追踪到明确的词典版本和排序依据。');
    return frames;
  }

  function persist() {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ prefix, k, word: updateWord, frequency: newFrequency })) url.searchParams.set(key, String(value));
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    fields.prefix.value = prefix; fields.k.value = String(k); fields.word.value = updateWord; fields.frequency.value = String(newFrequency);
  }
  const trace = window.AlgorithmVisualCore.createTrace({ root, cloneState: clone, codeKeyAttribute: 'data-design-key', getCodeScroll: () => null,
    onRender: ({ frame, state }) => {
      const labels = { '#decision-title': frame.title, '#decision-why': frame.why, '#decision-evidence': frame.evidence, '#decision-tradeoff': frame.tradeoff, '#step-change': frame.change, '#architecture-description': frame.change,
        '#drawing-stage': ({ scope: '需求与词典', query: '在线遍历', cache: '缓存查询', update: '快照更新', review: '取舍与边界' })[frame.key],
        '#query-label': `查询 prefix = ${prefix || '空'}，K = ${k}`, '#snapshot-label': `服务快照 v${state.serving.version}`, '#result-mode': state.mode, '#work-count': state.work,
        '#source-frequency': `词频源 ${updateWord} = ${state.source[updateWord]}`, '#build-state': state.draft ? '离线构建：v2 已就绪' : state.serving.version === 2 ? '离线构建：v2 已发布' : '离线构建：无待发布版本',
        '#published-state': `查询读取 v${state.serving.version}`, '#pipeline-status': state.status };
      for (const [selector, value] of Object.entries(labels)) root.querySelector(selector).textContent = value;
      for (const node of root.querySelectorAll('[data-prefix]')) { node.classList.toggle('is-path', state.path.includes(node.dataset.prefix)); node.classList.toggle('is-visited', state.visited.includes(node.dataset.prefix)); }
      for (const edge of root.querySelectorAll('[data-edge]')) edge.classList.toggle('is-path', state.path.includes(edge.dataset.edge));
      for (const word of root.querySelectorAll('[data-word]')) word.textContent = `${word.dataset.word} ${state.serving.frequencies[word.dataset.word]}`;
      for (const row of root.querySelectorAll('[data-result]')) {
        const index = Number(row.dataset.result), item = state.result?.[index];
        row.textContent = item ? `${index + 1}. ${item.word}  ${item.frequency}` : index === 0 ? state.result ? '无匹配结果' : '尚未查询' : '';
      }
      for (const component of root.querySelectorAll('[data-pipeline]')) component.classList.toggle('is-current', component.dataset.pipeline === state.active);
      root.querySelector('#build-flow').classList.toggle('is-current', state.active === 'build');
      root.querySelector('#publish-flow').classList.toggle('is-current', state.active === 'publish');
    }
  });
  root.querySelector('#query-settings').addEventListener('submit', event => {
    event.preventDefault(); prefix = validPrefix(fields.prefix.value); k = integer(fields.k.value, 3, 3); updateWord = fields.word.value; newFrequency = integer(fields.frequency.value, 30, 99);
    persist(); trace.setFrames(makeFrames(), { initialStep: 0 });
  });
  for (const button of root.querySelectorAll('[data-design-key]')) button.addEventListener('click', () => trace.showStep(trace.frames.findIndex(frame => frame.key === button.dataset.designKey)));
  root.querySelector('#restart').addEventListener('click', () => trace.showStep(0));
  root.querySelector('.design-roadmap').hidden = false;
  root.querySelector('.design-controls').hidden = false;
  persist(); trace.setFrames(makeFrames());
})();
