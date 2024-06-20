module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const volt = await ethers.getContract("VoltToken");

  // const multiSig = '0x03709784c96aeaAa9Dd38Df14A23e996681b2C66'
  const multiSig = deployer

  const { address } = await deploy("MasterChefVoltV2", {
    from: deployer,
    args: [
      volt.address,
      multiSig,
      multiSig,
      multiSig,
      "19555097552900000000", // 30 JOE per sec
      "1646913600", // Mar 10 2:00pm +2
      "0", // 20%
      "0", // 20%
      "0", // 10%
    ],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["MasterChefVoltV2", "chef"];
