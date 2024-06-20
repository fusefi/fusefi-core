module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const volt = await ethers.getContract("VoltToken");
  // const feeDistributor = await ethers.getContract("FeeShare");
  const feeDistributor = deployer;
  const burnPercent  = 7000;

  const { address } = await deploy("PenaltyHandler", {
    from: deployer,
    args: [
        feeDistributor,
        burnPercent,
        volt.address
    ],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["PenaltyHandler", "chef"];
module.exports.dependencies = ["VoltToken"]
// module.exports.dependencies = ["VoltToken", "FeeShare"]
