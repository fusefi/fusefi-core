const { WAVAX } = require("@joe-defi/sdk");

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  let wavaxAddress;

  if (chainId === "31337") {
    wavaxAddress = (await deployments.get("WAVAX9Mock")).address;
  } else if (chainId in WAVAX) {
    wavaxAddress = WAVAX[chainId].address;
  } else {
    throw Error("No WAVAX!");
  }

  const pangolinFactoryAddress = {
    4: "0x5Aac695d3a63139ae64817049Df9230a82473f4B",
    43113: "0xc79A395cE054B9F3B73b82C4084417CA9291BC87",
    43114: "0xefa94DE7a4656D787667C749f7E1223D71E9FD88",
  };

  const chefAddress = (await deployments.get("MasterChef")).address;
  const makerAddress = (await deployments.get("JoeMaker")).address;
  const joeAddress = (await deployments.get("JoeToken")).address;
  const joeFactoryAddress = (await deployments.get("JoeFactory")).address;
  const barAddress = (await deployments.get("JoeBar")).address;

  await deploy("BoringHelperV1", {
    from: deployer,
    args: [
      chefAddress,
      makerAddress,
      joeAddress,
      wavaxAddress,
      joeFactoryAddress,
      pangolinFactoryAddress[chainId],
      barAddress,
    ],
    log: true,
    deterministicDeployment: false,
  });
};

module.exports.tags = ["BoringHelperV1"];
module.exports.dependencies = ["MasterChef", "JoeMaker", "JoeToken", "JoeFactory", "JoeBar"];
