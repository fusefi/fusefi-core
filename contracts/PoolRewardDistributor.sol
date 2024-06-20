// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import './uniswap/interfaces/IWETH.sol';
import './interfaces/IMasterChef.sol';
import "./boringcrypto/BoringOwnable.sol";

/**
 * @title PoolRewardDistributor
 * @notice Distribute rewards to pools
 */
contract PoolRewardDistributor is BoringOwnable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    
    struct Pool {
        uint256 pid; // id of pool
        uint256 rewardAmount; // amount of rewards to distribue
    }

    address public immutable masterChef;
    address public immutable WETH;

    uint256 public totalRewardAmount;
    Pool[] public pools;

    constructor(address _masterChef, address _WETH) public {
        masterChef = _masterChef;
        WETH = _WETH;
    }

    function recoverFuse() public onlyOwner {
        uint256 fuseBalance = address(this).balance;
        (bool sent,) = payable(owner).call{value: fuseBalance}("");
        require(sent);
    }

    function recoverToken(address token) public onlyOwner {
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, tokenBalance);
    }

    function addPools(Pool[] memory _pools) external onlyOwner {
        for (uint256 i = 0; i < _pools.length; i++) {
            _addPool(_pools[i]);
        }
    }

    function addPool(Pool memory _pool) external onlyOwner {
        _addPool(_pool);
    }

    function removePool(uint256 _pid) external onlyOwner {
        _removePool(_pid);
    }

    function distributeRewards() external payable onlyOwner {
        IWETH(WETH).deposit{value: msg.value}();

        for (uint256 i = 0; i < pools.length; i++) {
            Pool memory pool = pools[i];
            IMasterChef.PoolInfo memory poolInfo = IMasterChef(masterChef).poolInfo(pool.pid);
            
            if (address(poolInfo.rewarder) != address(0)) {
                IWETH(WETH).transfer(address(poolInfo.rewarder), pool.rewardAmount);
            }
        }
    }

    function _addPool(Pool memory _pool) internal {
        pools.push(_pool);
        totalRewardAmount = totalRewardAmount.add(_pool.rewardAmount);
    }

    function _removePool(uint256 _pid) internal {
        uint256 index = _poolIndex(_pid);
        
        Pool memory pool = pools[index];
        totalRewardAmount = totalRewardAmount.sub(pool.rewardAmount);
        
        Pool[] storage poolsStorage = pools;
        
        for (uint256 i = index; i < poolsStorage.length - 1; i++) {
            poolsStorage[i] = poolsStorage[i + 1];
        }

        poolsStorage.pop();
    }

    function _poolIndex(uint256 _pid) internal view returns (uint256) {
        for (uint256 i = 0; i < pools.length; i++) {
            if (pools[i].pid == _pid) {
                return i;
            }
        }

        revert('pool not found');
    }
}
