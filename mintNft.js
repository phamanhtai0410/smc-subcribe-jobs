const Contract = require("web3-eth-contract");
const Web3 = require('web3')
const fs = require("fs");
const _ = require('lodash')

// set provider for all later instances to use
const RPC =
  "wss://magical-responsive-hexagon.base-goerli.discover.quiknode.pro/2429c05128e62e3250bfe4048b1115ce7b4f6ddc/";
const dappCreatorAddress = "0xB7557b1EF53a235a7f5e206CCF725dB1a2ceB030";
const PRIVATE_KEY = "3308e3e3a38a5d3a4ea2117ccbd144157a62f70994ddfa1809cb116b42609c58"

async function mintNft(web3, privateKey, gasPrice, contract) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey).address;
  console.log('account: ', account);
  const transaction = contract.methods.makeMintingAction(
    "0x0308c1849979066074c2b54ffcb5caa0007bdffa",
    1,
    2,
    0,
    false,
    [27, "0x5fe34db35618c924ffa1d11800d025ff68715060c9d4a175bee48c2bf01686b6", "0x61445cc49f02a98931dc698fd74de74e23207e4e39c59cfa572c42b7596e4777", 1681817544],
    "bc753c19-e802-441a-87d9-2c8acf11b725",
    "0x3F3450321D31cED280D7A79f93684d42a2791271"
  );
  const options = {
      to      : transaction._parent._address,
      data    : transaction.encodeABI(),
      gas     : await transaction.estimateGas({from: account}),
      gasPrice: gasPrice
  };
  const signed  = await web3.eth.accounts.signTransaction(options, privateKey);
  const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
  return receipt;
}

async function run() {
  Contract.setProvider(RPC);

  const jsonInterface = JSON.parse(fs.readFileSync("./abi.json", "utf-8"))

  const web3 = new Web3(RPC)

  const dappCreatorContract = new Contract(jsonInterface, dappCreatorAddress);

  const gasPrice = 200000000
  let count = 0
  while (count < 3000) {
    const receipt = await mintNft(web3, PRIVATE_KEY, gasPrice, dappCreatorContract);
    count += 1
    console.log(`${count} - ${_.get(receipt, 'transactionHash')}`);
  }



}


async function main() {
  try {
    await run()
  } catch (error) {
    console.log(error);
  }
}
main()