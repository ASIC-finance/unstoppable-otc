// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title OTCPair - Isolated order book for a single token pair
/// @notice Each pair is deployed by OTCFactory and holds only two tokens.
///         A malicious token can only affect its own pair, not the platform.
/// @dev Not compatible with rebasing tokens (stETH, aTokens, etc.) or tokens
///      that block transfers after deposit. Use standard ERC20 tokens only.
contract OTCPair is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OrderStatus { Active, Filled, Cancelled }

    struct Order {
        address maker;
        bool sellToken0;        // true = selling token0 for token1
        uint256 sellAmount;
        uint256 buyAmount;
        uint256 filledSellAmount;
        OrderStatus status;
    }

    address public immutable factory;
    address public immutable token0;
    address public immutable token1;

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;

    // On-chain indices for scalable querying without an indexer
    mapping(address => uint256[]) private _makerOrderIds;
    uint256[] private _activeOrderIds;
    mapping(uint256 => uint256) private _activeIndex;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed maker,
        bool sellToken0,
        uint256 sellAmount,
        uint256 buyAmount
    );

    event OrderFilled(
        uint256 indexed orderId,
        address indexed taker,
        uint256 sellAmountOut,
        uint256 buyAmountIn
    );

    event OrderCancelled(uint256 indexed orderId);

    error ZeroAmount();
    error OrderNotActive();
    error NotMaker();
    error ExceedsRemaining();
    error ZeroCost();

    constructor(address _token0, address _token1) {
        factory = msg.sender;
        token0 = _token0;
        token1 = _token1;
    }

    // ── Helpers ─────────────────────────────────────────────────────

    function _sellToken(bool sellToken0_) private view returns (IERC20) {
        return IERC20(sellToken0_ ? token0 : token1);
    }

    function _buyToken(bool sellToken0_) private view returns (IERC20) {
        return IERC20(sellToken0_ ? token1 : token0);
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    function _removeFromActive(uint256 orderId) private {
        uint256 idx = _activeIndex[orderId];
        assert(_activeOrderIds[idx] == orderId);
        uint256 lastId = _activeOrderIds[_activeOrderIds.length - 1];
        _activeOrderIds[idx] = lastId;
        _activeIndex[lastId] = idx;
        _activeOrderIds.pop();
        delete _activeIndex[orderId];
    }

    // ── Mutations ───────────────────────────────────────────────────

    /// @notice Create a new order in this pair
    /// @param sellToken0_ true = sell token0 for token1, false = sell token1 for token0
    /// @param sellAmount Amount of the sell token to deposit
    /// @param buyAmount Amount of the buy token wanted for the full order
    function createOrder(
        bool sellToken0_,
        uint256 sellAmount,
        uint256 buyAmount
    ) external nonReentrant returns (uint256 orderId) {
        if (sellAmount == 0 || buyAmount == 0) revert ZeroAmount();

        IERC20 sell = _sellToken(sellToken0_);

        // Fee-on-transfer: record actual received
        uint256 balBefore = sell.balanceOf(address(this));
        sell.safeTransferFrom(msg.sender, address(this), sellAmount);
        uint256 actualReceived = sell.balanceOf(address(this)) - balBefore;
        if (actualReceived == 0) revert ZeroAmount();

        orderId = nextOrderId++;
        orders[orderId] = Order({
            maker: msg.sender,
            sellToken0: sellToken0_,
            sellAmount: actualReceived,
            buyAmount: buyAmount,
            filledSellAmount: 0,
            status: OrderStatus.Active
        });

        _makerOrderIds[msg.sender].push(orderId);
        _activeIndex[orderId] = _activeOrderIds.length;
        _activeOrderIds.push(orderId);

        emit OrderCreated(orderId, msg.sender, sellToken0_, actualReceived, buyAmount);
    }

    /// @notice Fill an order (fully or partially)
    /// @param orderId The order to fill
    /// @param sellAmountOut How much of the sell token the taker wants
    function fillOrder(uint256 orderId, uint256 sellAmountOut) external nonReentrant {
        Order storage order = orders[orderId];

        if (order.status != OrderStatus.Active) revert OrderNotActive();
        if (sellAmountOut == 0) revert ZeroAmount();

        uint256 remaining = order.sellAmount - order.filledSellAmount;
        if (sellAmountOut > remaining) revert ExceedsRemaining();

        // Round UP to protect maker's price
        uint256 buyAmountIn = _ceilDiv(order.buyAmount * sellAmountOut, order.sellAmount);
        if (buyAmountIn == 0) revert ZeroCost();

        // Effects before interactions
        order.filledSellAmount += sellAmountOut;
        if (order.filledSellAmount == order.sellAmount) {
            order.status = OrderStatus.Filled;
            _removeFromActive(orderId);
        }

        IERC20 buy = _buyToken(order.sellToken0);
        IERC20 sell = _sellToken(order.sellToken0);

        // Receive buy tokens from taker (fee-on-transfer safe)
        uint256 balBefore = buy.balanceOf(address(this));
        buy.safeTransferFrom(msg.sender, address(this), buyAmountIn);
        uint256 actualBuyReceived = buy.balanceOf(address(this)) - balBefore;

        // Settle: buy tokens → maker, sell tokens → taker
        buy.safeTransfer(order.maker, actualBuyReceived);
        sell.safeTransfer(msg.sender, sellAmountOut);

        emit OrderFilled(orderId, msg.sender, sellAmountOut, buyAmountIn);
    }

    /// @notice Cancel an active order and refund remaining tokens
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];

        if (order.status != OrderStatus.Active) revert OrderNotActive();
        if (msg.sender != order.maker) revert NotMaker();

        order.status = OrderStatus.Cancelled;
        _removeFromActive(orderId);

        uint256 refund = order.sellAmount - order.filledSellAmount;
        if (refund > 0) {
            _sellToken(order.sellToken0).safeTransfer(order.maker, refund);
        }

        emit OrderCancelled(orderId);
    }

    // ── Views ───────────────────────────────────────────────────────

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getOrderCount() external view returns (uint256) {
        return nextOrderId;
    }

    function getOrders(uint256 fromId, uint256 toId) external view returns (Order[] memory) {
        if (toId > nextOrderId) toId = nextOrderId;
        if (fromId >= toId) return new Order[](0);
        Order[] memory result = new Order[](toId - fromId);
        for (uint256 i = fromId; i < toId; i++) {
            result[i - fromId] = orders[i];
        }
        return result;
    }

    function getActiveOrderCount() external view returns (uint256) {
        return _activeOrderIds.length;
    }

    function getActiveOrders(uint256 offset, uint256 limit)
        external view
        returns (uint256[] memory ids, Order[] memory result)
    {
        uint256 total = _activeOrderIds.length;
        if (offset >= total) return (new uint256[](0), new Order[](0));
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        ids = new uint256[](count);
        result = new Order[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 oid = _activeOrderIds[offset + i];
            ids[i] = oid;
            result[i] = orders[oid];
        }
    }

    function getMakerOrderCount(address maker) external view returns (uint256) {
        return _makerOrderIds[maker].length;
    }

    function getMakerOrders(address maker, uint256 offset, uint256 limit)
        external view
        returns (uint256[] memory ids, Order[] memory result)
    {
        uint256 total = _makerOrderIds[maker].length;
        if (offset >= total) return (new uint256[](0), new Order[](0));
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        ids = new uint256[](count);
        result = new Order[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 oid = _makerOrderIds[maker][offset + i];
            ids[i] = oid;
            result[i] = orders[oid];
        }
    }
}
