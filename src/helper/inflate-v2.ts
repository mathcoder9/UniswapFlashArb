import { Contract, Wallet, parseEther, parseUnits } from "ethers";
import { UNISWAP_V2_ROUTER, WETH } from "../constants";
import { UNISWAP_ROUTER02_ABI } from "../abi/uniswap-router-02-abi";

export async function inflateV2Pool(
  executor: Wallet,
  deadline: number,
  erc20TokenAddress: string
) {
  const routerContract = new Contract(
    UNISWAP_V2_ROUTER,
    UNISWAP_ROUTER02_ABI,
    executor
  );

  const gasLimit = await routerContract.swapExactETHForTokens.estimateGas(
    1,
    [WETH, erc20TokenAddress],
    executor.address,
    deadline,
    { from: executor.address, value: parseEther("500") }
  );

  // Prepare the transaction object
  const tx = await routerContract.swapExactETHForTokens.populateTransaction(
    1,
    [WETH, erc20TokenAddress],
    executor.address,
    deadline,
    {
      gasLimit: gasLimit,
      gasPrice: parseUnits("20", "gwei"),
      value: parseEther("500"),
    }
  );

  const txResponse = await executor.sendTransaction(tx);
  console.log(
    "Submitted V2 Pool inflation transaction, hash:",
    txResponse.hash
  );

  const receipt = await txResponse.wait();
  if (receipt.status == 1) {
    console.log("✅ Successfully inflated V2 Pool");
    console.log(
      "✅ V2 Pool inflation transaction was mined in block:",
      receipt.blockNumber
    );
  } else {
    console.log("❌ V2 Pool inflation transaction failed");
  }
}
