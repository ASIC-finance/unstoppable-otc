// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OTCPair} from "./OTCPair.sol";

/// @title OTCFactory - Deploys isolated OTCPair contracts per token pair
/// @notice Zero-fee, immutable, admin-free. Each pair isolates risk:
///         a malicious token can only affect its own pair.
contract OTCFactory {
    /// @dev Sorted mapping: getPair[tokenA][tokenB] where tokenA < tokenB
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(
        address indexed token0,
        address indexed token1,
        address pair,
        uint256 pairCount
    );

    error IdenticalTokens();
    error ZeroAddress();
    error PairExists();

    /// @notice Deploy a new isolated OTCPair for a token pair
    /// @param tokenA One of the two tokens
    /// @param tokenB The other token
    /// @return pair The address of the newly deployed pair
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        if (tokenA == tokenB) revert IdenticalTokens();
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        if (t0 == address(0)) revert ZeroAddress();
        if (getPair[t0][t1] != address(0)) revert PairExists();

        // Deploy with CREATE2 for deterministic addresses
        bytes32 salt = keccak256(abi.encodePacked(t0, t1));
        pair = address(new OTCPair{salt: salt}(t0, t1));

        getPair[t0][t1] = pair;
        getPair[t1][t0] = pair; // populate both directions
        allPairs.push(pair);

        emit PairCreated(t0, t1, pair, allPairs.length);
    }

    /// @notice Get the total number of pairs
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    /// @notice Get a page of pairs
    function getPairs(uint256 offset, uint256 limit)
        external view
        returns (address[] memory pairs)
    {
        uint256 total = allPairs.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        pairs = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            pairs[i] = allPairs[offset + i];
        }
    }
}
