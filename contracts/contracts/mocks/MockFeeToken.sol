// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice ERC20 that takes a percentage fee on every transfer (for testing fee-on-transfer paths)
contract MockFeeToken is ERC20 {
    uint256 public feeBps; // fee in basis points (e.g., 100 = 1%)

    constructor(string memory name_, string memory symbol_, uint256 feeBps_) ERC20(name_, symbol_) {
        feeBps = feeBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            // Apply fee on regular transfers (not mint/burn)
            uint256 fee = (amount * feeBps) / 10000;
            uint256 afterFee = amount - fee;
            // Burn the fee
            super._update(from, address(0), fee);
            super._update(from, to, afterFee);
        } else {
            super._update(from, to, amount);
        }
    }
}
