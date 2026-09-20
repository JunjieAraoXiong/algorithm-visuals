# Algorithm Visuals

Interactive visual explanations for algorithm practice, published with GitHub Pages. The pages pair a step-by-step diagram with synchronized source code and keyboard controls.

Each question has a standalone page at `<problem-slug>/index.html`. The root `index.html` lists the available visuals. No build step or server code is required: shared browser code lives in `assets/core.js` and shared shell styles in `assets/visual.css`.

## Visuals

- [Shift Zeros to the End / 移动零到末尾](shift-zeros-to-the-end/index.html)
- [Next Lexicographical Sequence / 下一字典序](next-lexicographical-sequence/index.html)
- [Longest Chain of Consecutive Numbers / 最长连续数字链](longest-chain-of-consecutive-numbers/index.html)
- [Geometric Sequence Triplets / 等比数列三元组](geometric-sequence-triplets/index.html)
- [Reverse Linked List · Iterative / 反转链表](reverse-linked-list/index.html)
- [Reverse Linked List · Recursive / 递归反转链表](recursive-reverse-linked-list/index.html)
- [Remove the Kth Last Node / 删除倒数第 K 个节点](remove-kth-last-node/index.html)
- [Linked List Intersection / 链表相交](linked-list-intersection/index.html)
- [LRU Cache / 最近最少使用缓存](lru-cache/index.html)
- [Palindromic Linked List / 回文链表](palindromic-linked-list/index.html)
- [Flatten a Multi-Level Linked List / 展平多层链表](flatten-multilevel-linked-list/index.html)
- [Linked List Loop / 链表环检测](linked-list-loop/index.html)
- [Linked List Midpoint / 链表中点](linked-list-midpoint/index.html)
- [Happy Number / 快乐数](happy-number/index.html)
- [Substring Anagrams / 字母异位子串](substring-anagrams/index.html)
- [Longest Substring With Unique Characters / 无重复字符的最长子串](longest-unique-substring/index.html)
- [Longest Uniform Substring After Replacements / 替换后的最长统一子串](longest-uniform-substring-after-replacements/index.html)
- [Find the Insertion Index / 搜索插入位置](find-the-insertion-index/index.html)
- [First and Last Occurrences of a Number / 数字的首尾出现位置](first-and-last-occurrences-of-a-number/index.html)
- [Cutting Wood / 砍木头](cutting-wood/index.html)
- [Find the Target in a Rotated Sorted Array / 旋转排序数组中查找目标](find-the-target-in-a-rotated-sorted-array/index.html)

## Development

Run `npm test` to launch the headless Chromium audit. It checks the catalog and README inventory, console/page errors, scripted code-line synchronization, 390px page overflow, and the common keyboard contract. The test setup starts a local static server; there is still no production build step.

## Content rights

The visual diagrams and explanations are original content. See [LICENSE](LICENSE) for the repository's all-rights-reserved notice.

## Publishing

GitHub Pages serves the `main` branch from the repository root. An empty `.nojekyll` keeps the files as plain static pages.
