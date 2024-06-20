// SPDX-License-Identifier: MIT
pragma solidity ^0.6.7; //^0.7.5;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PenaltyHandler is Ownable {
    address public BURN_ADDRESS = 0x0000000000000000000000000000000000000001; 
    uint256 public HUNDRED = 10000;

    address public feeDistributor;
    IERC20 public token;
    uint256 public burnPercent;

    constructor (address _feeDistributor, uint256 _burnPercent, address _token) public {
        require(burnPercent <= HUNDRED);
        require(_feeDistributor != address(0) && _token != address(0));
        feeDistributor = _feeDistributor;
        burnPercent = _burnPercent;
        token = IERC20(_token);
    }

    function setFeeDistributor(address _feeDistributor) public onlyOwner {
        feeDistributor = _feeDistributor;
    }

    function setBurnPercent(uint256 _burnPercent) public onlyOwner {
        require(_burnPercent <= HUNDRED);
        burnPercent = _burnPercent;
    }

    function donate(uint256 amount) public returns (bool) {
        uint256 toBurn = amount * burnPercent / 10000;
        uint256 toDonate = amount * (10000 - burnPercent) / 10000;
        require(token.transferFrom(msg.sender, BURN_ADDRESS, toBurn));
        require(token.transferFrom(msg.sender, feeDistributor, toDonate));
        return true;
    }

}