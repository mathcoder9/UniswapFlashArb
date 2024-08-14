// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../FlashArbitrage.sol";
import {Address} from "../helper/Address.sol";

contract MyScript is Script {
    function run() external {
        string memory network = vm.envString("DEPLOYER_NETWORK");
        int chainId = vm.envInt("DEPLOYER_CHAIN_ID");

        uint256 deployerPrivateKey;
        address executorAddress;
        address weth9;
        address uniswapV2Router;
        address uniswapV3Factory;

        if (chainId == 1) {
            weth9 = Address.WETH9;
            uniswapV2Router = Address.UNIV2_ROUTER;
            uniswapV3Factory = Address.UNIV3_FACTORY;
        } else if (chainId == 11155111) {
            weth9 = Address.SEPOLIA_WETH9;
            uniswapV2Router = Address.SEPOLIA_UNIV2_ROUTER;
            uniswapV3Factory = Address.SEPOLIA_UNIV3_FACTORY;
        } else {
            revert("Unknown chain id");
        }

        if (
            keccak256(abi.encodePacked(network)) ==
            keccak256(abi.encodePacked("local"))
        ) {
            deployerPrivateKey = vm.envUint("LOCAL_PRIVATE_KEY");
            executorAddress = vm.envAddress("LOCAL_EXECUTOR_ADDRESS");
        } else if (
            keccak256(abi.encodePacked(network)) ==
            keccak256(abi.encodePacked("live"))
        ) {
            deployerPrivateKey = vm.envUint("LIVE_PRIVATE_KEY");
            executorAddress = vm.envAddress("LIVE_EXECUTOR_ADDRESS");
        } else {
            revert("Unknown network configuration");
        }

        vm.startBroadcast(deployerPrivateKey);

        new FlashArbitrage(
            uniswapV2Router,
            uniswapV3Factory,
            weth9,
            executorAddress
        );

        vm.stopBroadcast();
    }
}
