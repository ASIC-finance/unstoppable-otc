// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice ERC20 that attempts reentrancy on transfer (for testing ReentrancyGuard)
contract MockReentrantToken is ERC20 {
    address public target;
    bytes public attackCalldata;
    bool public armed;

    constructor() ERC20("Reentrant", "REENTER") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Arm the reentrancy attack: next transfer TO this contract triggers a call
    function arm(address _target, bytes calldata _calldata) external {
        target = _target;
        attackCalldata = _calldata;
        armed = true;
    }

    function disarm() external {
        armed = false;
    }

    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);

        // Attempt reentrancy when tokens are transferred to the target
        if (armed && from != address(0) && to == target) {
            armed = false; // prevent infinite loop
            (bool success,) = target.call(attackCalldata);
            // We don't care if it succeeds — the test checks for revert
            (success); // silence unused warning
        }
    }
}
