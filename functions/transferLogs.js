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

  console.log(log, eventType);
  const parseData = web3.eth.abi.decodeParameters(
    eventType,
    _.get(log, "data")
  );
  // for (let type of eventType) {
  //   const name = _.get(type, "name");
  //   const valueType = _.get(type, "type");
  //   const value = parseSpecificValue({ parseData, name, valueType });
  //   _.set(args, name, value);
  // }

  console.log(_.get(parseData, 'token_id'))

  _.set(args, 'token_id', _.get(parseData, 'token_id'))


  const topics = _.get(log, 'topics')

  // Decode label
  const from = web3.eth.abi.decodeParameter(
    'bytes32',
    topics[2]
  );
  _.set(args, 'from', from)

  // Decode owner
  const to = web3.eth.abi.decodeParameter(
    'address',
    topics[3]
  )
  _.set(args, 'to', to)

  return {
    chain: this.chain,
    transactionHash: _.get(log, "transactionHash"),
    blockNumber: _.get(log, "blockNumber"),
    address: _.get(log, "address"),
    args: args,
  };
};
