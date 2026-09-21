# Algorithm Visuals

Interactive bilingual explanations for algorithm practice, published at [Algo Visual](https://junjiearaoxiong.github.io/algorithm-visuals/). Each page pairs a step-by-step diagram with synchronized source code and keyboard controls.

## Repository layout

```text
src/
├── assets/                 shared browser code and styles
├── chapters/
│   ├── 01-two-pointers/
│   ├── 02-hash-maps-and-sets/
│   └── …                    numbered chapters and questions
├── index.html              catalog source
└── questions.json          ordered question registry
scripts/build-site.mjs      validates and creates _site/
tests/                      browser regression checks
```

Source folders are ordered for repository browsing. The build keeps the public URLs short and stable at `/<problem-slug>/`.

## Visuals

### 01 · Two Pointers / 双指针

- [Shift Zeros to the End / 移动零到末尾](https://junjiearaoxiong.github.io/algorithm-visuals/shift-zeros-to-the-end/)
- [Next Lexicographical Sequence / 下一字典序](https://junjiearaoxiong.github.io/algorithm-visuals/next-lexicographical-sequence/)

### 02 · Hash Maps and Sets / 哈希表与集合

- [Longest Chain of Consecutive Numbers / 最长连续数字链](https://junjiearaoxiong.github.io/algorithm-visuals/longest-chain-of-consecutive-numbers/)
- [Geometric Sequence Triplets / 等比数列三元组](https://junjiearaoxiong.github.io/algorithm-visuals/geometric-sequence-triplets/)

### 03 · Linked Lists / 链表

- [Reverse Linked List · Iterative / 反转链表](https://junjiearaoxiong.github.io/algorithm-visuals/reverse-linked-list/)
- [Reverse Linked List · Recursive / 递归反转链表](https://junjiearaoxiong.github.io/algorithm-visuals/recursive-reverse-linked-list/)
- [Remove the Kth Last Node / 删除倒数第 K 个节点](https://junjiearaoxiong.github.io/algorithm-visuals/remove-kth-last-node/)
- [Linked List Intersection / 链表相交](https://junjiearaoxiong.github.io/algorithm-visuals/linked-list-intersection/)
- [LRU Cache / 最近最少使用缓存](https://junjiearaoxiong.github.io/algorithm-visuals/lru-cache/)
- [Palindromic Linked List / 回文链表](https://junjiearaoxiong.github.io/algorithm-visuals/palindromic-linked-list/)
- [Flatten a Multi-Level Linked List / 展平多层链表](https://junjiearaoxiong.github.io/algorithm-visuals/flatten-multilevel-linked-list/)

### 04 · Fast and Slow Pointers / 快慢指针

- [Linked List Loop / 链表环检测](https://junjiearaoxiong.github.io/algorithm-visuals/linked-list-loop/)
- [Linked List Midpoint / 链表中点](https://junjiearaoxiong.github.io/algorithm-visuals/linked-list-midpoint/)
- [Happy Number / 快乐数](https://junjiearaoxiong.github.io/algorithm-visuals/happy-number/)

### 05 · Sliding Windows / 滑动窗口

- [Substring Anagrams / 字母异位子串](https://junjiearaoxiong.github.io/algorithm-visuals/substring-anagrams/)
- [Longest Substring With Unique Characters / 无重复字符的最长子串](https://junjiearaoxiong.github.io/algorithm-visuals/longest-unique-substring/)
- [Longest Uniform Substring After Replacements / 替换后的最长统一子串](https://junjiearaoxiong.github.io/algorithm-visuals/longest-uniform-substring-after-replacements/)

### 06 · Binary Search / 二分查找

- [Find the Insertion Index / 搜索插入位置](https://junjiearaoxiong.github.io/algorithm-visuals/find-the-insertion-index/)
- [First and Last Occurrences of a Number / 数字的首尾出现位置](https://junjiearaoxiong.github.io/algorithm-visuals/first-and-last-occurrences-of-a-number/)
- [Cutting Wood / 砍木头](https://junjiearaoxiong.github.io/algorithm-visuals/cutting-wood/)
- [Find the Target in a Rotated Sorted Array / 旋转排序数组中查找目标](https://junjiearaoxiong.github.io/algorithm-visuals/find-the-target-in-a-rotated-sorted-array/)

### 07 · Stacks / 栈

- [Valid Parenthesis Expression / 有效的括号](https://junjiearaoxiong.github.io/algorithm-visuals/valid-parenthesis-expression/)
- [Next Largest Number to the Right / 右侧下一个更大数](https://junjiearaoxiong.github.io/algorithm-visuals/next-largest-number-to-the-right/)
- [Evaluate Expression / 表达式求值](https://junjiearaoxiong.github.io/algorithm-visuals/evaluate-expression/)
- [Repeated Removal of Adjacent Duplicates / 反复移除相邻重复项](https://junjiearaoxiong.github.io/algorithm-visuals/repeated-removal-of-adjacent-duplicates/)
- [Implement a Queue Using Stacks / 用栈实现队列](https://junjiearaoxiong.github.io/algorithm-visuals/implement-a-queue-using-stacks/)
- [Maximums of Sliding Window / 滑动窗口最大值](https://junjiearaoxiong.github.io/algorithm-visuals/maximums-of-sliding-window/)

### 08 · Heaps / 堆

- [K Most Frequent Strings / 前 K 个高频字符串](https://junjiearaoxiong.github.io/algorithm-visuals/k-most-frequent-strings/)
- [Combine Sorted Linked Lists / 合并 K 个有序链表](https://junjiearaoxiong.github.io/algorithm-visuals/combine-sorted-linked-lists/)
- [Median of an Integer Stream / 整数流的中位数](https://junjiearaoxiong.github.io/algorithm-visuals/median-of-an-integer-stream/)
- [Sort a K-Sorted Array / K 有序数组排序](https://junjiearaoxiong.github.io/algorithm-visuals/sort-a-k-sorted-array/)

### 09 · Intervals / 区间

- [Merge Overlapping Intervals / 合并重叠区间](https://junjiearaoxiong.github.io/algorithm-visuals/merge-overlapping-intervals/)
- [Identify All Interval Overlaps / 找出所有区间重叠](https://junjiearaoxiong.github.io/algorithm-visuals/identify-all-interval-overlaps/)
- [Largest Overlap of Intervals / 区间最大重叠数](https://junjiearaoxiong.github.io/algorithm-visuals/largest-overlap-of-intervals/)

### 10 · Prefix Sums / 前缀和

- [Sum Between Range / 区间求和](https://junjiearaoxiong.github.io/algorithm-visuals/sum-between-range/)
- [K-Sum Subarrays / 和为 K 的子数组](https://junjiearaoxiong.github.io/algorithm-visuals/k-sum-subarrays/)
- [Product Array Without Current Element / 除自身以外数组的乘积](https://junjiearaoxiong.github.io/algorithm-visuals/product-array-without-current-element/)

### 11 · Graphs / 图

- [Shortest Path / 最短路径](https://junjiearaoxiong.github.io/algorithm-visuals/shortest-path/)
- [Connect the Dots / 连接所有点](https://junjiearaoxiong.github.io/algorithm-visuals/connect-the-dots/)

## Development

- `npm run build` validates the registry, catalog, README inventory, and internal links, then writes the ignored `_site/` directory.
- `npm test` builds the site and runs the Chromium audit for trace synchronization, keyboard controls, responsive layout, console errors, and scene snapshots.
- GitHub Actions publishes `_site/` from `main`; no framework runtime or network dependency is used by the site.

Contributor workflow details live in [AGENT.md](AGENT.md). A reusable task prompt is available at [docs/visual-task-prompt.md](docs/visual-task-prompt.md).

## Content rights

The visual diagrams and explanations are original content. See [LICENSE](LICENSE) for the repository's all-rights-reserved notice.
