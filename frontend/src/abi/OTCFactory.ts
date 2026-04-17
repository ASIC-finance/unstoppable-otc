export const OTCFactoryABI = [
  // ── Errors ─────────────────────────────────────────────────────
  { inputs: [], name: "IdenticalTokens", type: "error" },
  { inputs: [], name: "NotAContract", type: "error" },
  { inputs: [], name: "PairExists", type: "error" },
  { inputs: [], name: "ZeroAddress", type: "error" },

  // ── Events ─────────────────────────────────────────────────────
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "token0", type: "address" },
      { indexed: true, name: "token1", type: "address" },
      { indexed: false, name: "pair", type: "address" },
      { indexed: false, name: "pairCount", type: "uint256" },
    ],
    name: "PairCreated",
    type: "event",
  },

  // ── Reads ──────────────────────────────────────────────────────
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "allPairs",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "allPairsLength",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    name: "getPair",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    name: "getPairs",
    outputs: [{ name: "pairs", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },

  // ── Writes ─────────────────────────────────────────────────────
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    name: "createPair",
    outputs: [{ name: "pair", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const
