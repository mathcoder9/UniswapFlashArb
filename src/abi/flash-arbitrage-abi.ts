export const FLASH_ARB_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "_swapRouter", type: "address", internalType: "address" },
      { name: "_factory", type: "address", internalType: "address" },
      { name: "_weth9", type: "address", internalType: "address" },
      { name: "_executor", type: "address", internalType: "address" },
    ],
    stateMutability: "nonpayable",
  },
  { type: "fallback", stateMutability: "payable" },
  { type: "receive", stateMutability: "payable" },
  {
    type: "function",
    name: "WETH9",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "factory",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "initFlash",
    inputs: [
      {
        name: "params",
        type: "tuple",
        internalType: "struct FlashArbitrage.FlashParams",
        components: [
          { name: "token0", type: "address", internalType: "address" },
          { name: "token1", type: "address", internalType: "address" },
          { name: "poolFee", type: "uint24", internalType: "uint24" },
          { name: "wethToBorrow", type: "uint256", internalType: "uint256" },
          {
            name: "amountToCoinbase",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setExecutor",
    inputs: [
      { name: "_newExecutor", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "swapRouter",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IUniswapV2Router02",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "uniswapV3SwapCallback",
    inputs: [
      { name: "amount0Delta", type: "int256", internalType: "int256" },
      { name: "amount1Delta", type: "int256", internalType: "int256" },
      { name: "data", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];
