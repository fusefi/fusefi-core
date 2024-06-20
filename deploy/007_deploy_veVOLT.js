const { ethers } = require("hardhat");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy } = deployments;
  
    const { deployer } = await getNamedAccounts();
  
    const volt = await ethers.getContract("VoltToken");
    const voltAddress = volt.address
    const penaltyHandler = await ethers.getContract("PenaltyHandler");
    const admin = deployer

    await deploy("VotingEscrow", {
      from: deployer,
      args: [voltAddress, "Vote Escrow Volt", "veVOLT", admin, penaltyHandler.address],
      log: true,
      deterministicDeployment: false,
    });
};
  
module.exports.tags = ["VoteEscrowVolt"];
module.exports.dependencies = ["VoltToken", "PenaltyHandler"]
