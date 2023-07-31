const _ = require("lodash");

function parseSpecificValue({ parseData, name, valueType }) {
  const data = _.get(parseData, name);
  if (!/^uint*/.test(valueType)) {
    return data;
  }
  if (!Array.isArray(data)) {
    return _.toInteger(data);
  }

  const value = [];
  for (let item of data) {
    value.push(_.toInteger(item));
  }
  return value;
}

module.exports = function (web3, eventType, log) {
  let args = {}
  const parseData = web3.eth.abi.decodeParameters(
    eventType,
    _.get(log, "data")
  );
  for (let type of eventType) {
    const name = _.get(type, "name");
    const valueType = _.get(type, "type");
    const value = parseSpecificValue({ parseData, name, valueType });
    _.set(args, name, value);
  }

  const topics = _.get(log, 'topics')

  // Decode label
  const label = web3.eth.abi.decodeParameter(
    'bytes32',
    topics[2]
  );
  _.set(args, 'label', label)

  // Decode owner
  const owner = web3.eth.abi.decodeParameter(
    'address',
    topics[2]
  )
  _.set(args, 'owner', owner)

  return {
    chain: this.chain,
    transactionHash: _.get(log, "transactionHash"),
    blockNumber: _.get(log, "blockNumber"),
    address: _.get(log, "address"),
    args: args,
  };
};
