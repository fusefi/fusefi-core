// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./libraries/SafeERC20.sol";
import "./libraries/SafeMath.sol";

import "./uniswap/interfaces/IUniswapV2Pair.sol";
import "./uniswap/interfaces/IUniswapV2Factory.sol";

import "./boringcrypto/BoringOwnable.sol";

// Swap is a simple token exchange contract built on top on voltage.finance
contract Swap is BoringOwnable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IUniswapV2Factory public immutable factory;

    constructor(address _factory) public {
        factory = IUniswapV2Factory(_factory);
    }

    function swapToken(
        address _fromToken,
        address _toToken,
        uint256 _amountIn,
        address _to
    ) external onlyOwner {
        IERC20(_fromToken).safeTransferFrom(msg.sender, _amountIn);
        _swap(_fromToken, _toToken, _amountIn, _to);
    }

    function getAmountOut(
        address _fromToken,
        address _toToken,
        uint256 _amountIn
    ) public view returns (uint256 amountOut) {
        IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(_fromToken, _toToken));
        if (address(pair) == address(0)) return 0;

        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();

        uint256 amountInWithFee = _amountIn.mul(997);
        if (_fromToken == pair.token0()) {
            amountOut = amountInWithFee.mul(reserve1) / reserve0.mul(1000).add(amountInWithFee);
        } else {
            amountOut = amountInWithFee.mul(reserve0) / reserve1.mul(1000).add(amountInWithFee);
        }
    }

    function _swap(
        address _fromToken,
        address _toToken,
        uint256 _amountIn,
        address _to
    ) internal returns (uint256 realAmountOut) {
        IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(_fromToken, _toToken));
        require(address(pair) != address(0), "VoltMakerV3: Cannot convert");

        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();

        IERC20(_fromToken).safeTransfer(address(pair), _amountIn);

        uint256 balanceBefore = IERC20(_toToken).balanceOf(_to);

        uint256 amountInWithFee = _amountIn.mul(997);
        if (_fromToken == pair.token0()) {
            uint256 amountOut = amountInWithFee.mul(reserve1) / reserve0.mul(1000).add(amountInWithFee);
            pair.swap(0, amountOut, _to, new bytes(0));
        } else {
            uint256 amountOut = amountInWithFee.mul(reserve0) / reserve1.mul(1000).add(amountInWithFee);
            pair.swap(amountOut, 0, _to, new bytes(0));
        }

        realAmountOut = IERC20(_toToken).balanceOf(_to) - balanceBefore;
    }
}
