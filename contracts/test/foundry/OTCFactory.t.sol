// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OTCTestBase} from "./Helpers.sol";
import {OTCFactory} from "../../contracts/OTCFactory.sol";
import {OTCPair} from "../../contracts/OTCPair.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";

contract OTCFactoryTest is OTCTestBase {
    // ── Create pair ────────────────────────────────────────────────

    function test_createPair_deploysAndEmits() public {
        (address t0, address t1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));

        vm.expectEmit(true, true, false, false);
        emit OTCFactory.PairCreated(t0, t1, address(0), 0);
        factory.createPair(address(tokenA), address(tokenB));

        address pairAddr = factory.getPair(address(tokenA), address(tokenB));
        assertNotEq(pairAddr, address(0), "pair should be deployed");

        // Both directions resolve to the same pair
        address reverse = factory.getPair(address(tokenB), address(tokenA));
        assertEq(reverse, pairAddr, "reverse lookup must match");

        assertEq(factory.allPairsLength(), 1);
    }

    function test_createPair_sortsTokens() public {
        factory.createPair(address(tokenA), address(tokenB));
        address pairAddr = factory.getPair(address(tokenA), address(tokenB));
        OTCPair pair = OTCPair(pairAddr);

        assertTrue(pair.token0() < pair.token1(), "token0 must be < token1");
    }

    function test_createPair_setsFactoryImmutable() public {
        factory.createPair(address(tokenA), address(tokenB));
        address pairAddr = factory.getPair(address(tokenA), address(tokenB));
        OTCPair pair = OTCPair(pairAddr);
        assertEq(pair.factory(), address(factory));
    }

    // ── Reverts ────────────────────────────────────────────────────

    function test_createPair_revertsIdenticalTokens() public {
        vm.expectRevert(OTCFactory.IdenticalTokens.selector);
        factory.createPair(address(tokenA), address(tokenA));
    }

    function test_createPair_revertsZeroAddress() public {
        vm.expectRevert(OTCFactory.ZeroAddress.selector);
        factory.createPair(address(0), address(tokenA));
    }

    function test_createPair_revertsWhenTokenIsEOA() public {
        // Plain EOA with no code — must be rejected, otherwise orders would
        // revert unhelpfully later.
        address eoa = makeAddr("not-a-contract");
        vm.expectRevert(OTCFactory.NotAContract.selector);
        factory.createPair(address(tokenA), eoa);

        // And the reversed-argument path (so sort order doesn't matter).
        vm.expectRevert(OTCFactory.NotAContract.selector);
        factory.createPair(eoa, address(tokenA));
    }

    function test_createPair_revertsDuplicate() public {
        factory.createPair(address(tokenA), address(tokenB));

        vm.expectRevert(OTCFactory.PairExists.selector);
        factory.createPair(address(tokenA), address(tokenB));

        // Reverse order also fails
        vm.expectRevert(OTCFactory.PairExists.selector);
        factory.createPair(address(tokenB), address(tokenA));
    }

    // ── Pagination ─────────────────────────────────────────────────

    function test_getPairs_pagination() public {
        MockERC20[] memory tokens = new MockERC20[](4);
        for (uint256 i = 0; i < 4; i++) {
            tokens[i] = new MockERC20("T", "T", 18);
        }

        factory.createPair(address(tokens[0]), address(tokens[1]));
        factory.createPair(address(tokens[0]), address(tokens[2]));
        factory.createPair(address(tokens[0]), address(tokens[3]));

        assertEq(factory.allPairsLength(), 3);

        address[] memory page1 = factory.getPairs(0, 2);
        assertEq(page1.length, 2);

        address[] memory page2 = factory.getPairs(2, 2);
        assertEq(page2.length, 1);

        // Beyond range returns empty
        address[] memory page3 = factory.getPairs(5, 2);
        assertEq(page3.length, 0);
    }

    // ── Fuzz ───────────────────────────────────────────────────────

    function testFuzz_createPair_alwaysSucceeds(
        string calldata nameA,
        string calldata nameB
    ) public {
        MockERC20 a = new MockERC20(nameA, "A", 18);
        MockERC20 b = new MockERC20(nameB, "B", 18);

        // Skip if addresses collide (same contract deployed at same address)
        vm.assume(address(a) != address(b));
        vm.assume(address(a) != address(0) && address(b) != address(0));

        factory.createPair(address(a), address(b));
        address pairAddr = factory.getPair(address(a), address(b));

        assertTrue(pairAddr != address(0), "pair must deploy");
        assertEq(factory.allPairsLength(), 1);
    }
}
