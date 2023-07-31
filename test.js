const Contract = require("web3-eth-contract");
const Web3 = require("web3");
const fs = require("fs");
const _ = require("lodash");

const RPC = "https://rpc.ankr.com/eth_goerli";

async function main() {
  try {
    const web3 = new Web3(RPC);

    console.log(web3.utils.fromWei("1017950000000000000", "ether"));

    const tx =
      "0x4e3ddf16074da47dd8a331b726c6192f45a501e8f17d93ab133ab8766c0fee69";

    // const logs = await web3.eth.getTransaction(tx)

    // console.log(logs);

    const logs = await web3.eth.getPastLogs({
      fromBlock: 9133705,
      toBlock: 9133710,
      // topics: ["0x6d3264fffeeecdff54c3f1a3462a813795a129e3bbdf25a0afdeacc8e543cb72"], // PosDeposit
      // topics: ["0xa175fc4e3e2aaab237604b6aaca5daacd407be7af531d7a1b536670b9f605eeb"], // PosWithdraw
      address: ["0x0b3b1b28846a9a716a8de5f7f198646ccc87ef72"],
    });

    console.log(logs);

    const eventType = [
      {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
      },
      {
          "indexed": false,
          "internalType": "uint256",
          "name": "baseCost",
          "type": "uint256"
      },
      {
          "indexed": false,
          "internalType": "uint256",
          "name": "premium",
          "type": "uint256"
      },
      {
          "indexed": false,
          "internalType": "uint256",
          "name": "expires",
          "type": "uint256"
      },
      {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
      },
      {
          "indexed": true,
          "internalType": "bytes32",
          "name": "label",
          "type": "bytes32"
      }
  ]
    for (let log of logs) {
      console.log(log);
      const parseData = web3.eth.abi.decodeParameters(
        eventType,
        _.get(log, "data")
      );
    }
  } catch (error) {
    console.log(error);
  }
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.log(error);
  }
}

run();
