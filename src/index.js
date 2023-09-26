const EthDet = require('./detector')
const config = require('./config.json')

const detector = new EthDet(config)

module.exports = checkDomain


function checkDomain(domain) {
  return detector.check(domain).result
}
