const ensh = require('fast-ensh')
const DEFAULT_TOLERANCE = 3

class EthDet {
  constructor (opts) {
    if (Array.isArray(opts)) {
      this.configs = processConfigs(opts)
      this.legacyConfig = false
    } else {
      this.configs = [{
        allowlist: processDomainList(opts.whitelist || []),
        blocklist: processDomainList(opts.blacklist || []),
        fuzzylist: processDomainList(opts.fuzzylist || []),
        tolerance: ('tolerance' in opts) ? opts.tolerance : DEFAULT_TOLERANCE
      }]
      this.legacyConfig = true
    }
  }

  check(domain) {
    const result = this._check(domain)

    if (this.legacyConfig) {
      let legacyType = result.type;
      if (legacyType === 'allowlist') {
        legacyType = 'whitelist'
      } else if (legacyType === 'blocklist') {
        legacyType = 'blacklist'
      }
      return {
        match: result.match,
        result: result.result,
        type: legacyType,
      }
    }
    return result
  }

  _check (domain) {
    let fqdn = domain.substring(domain.length - 1) === "."
      ? domain.slice(0, -1)
      : domain;

    const source = domainToParts(fqdn)

    for (const { allowlist, name, version } of this.configs) {
      const allowlistMatch = matchPartsAgainstList(source, allowlist)
      if (allowlistMatch) {
        const match = domainPartsToDomain(allowlistMatch);
        return { match, name, result: false, type: 'allowlist', version }
      }
    }

    for (const { blocklist, fuzzylist, name, tolerance, version } of this.configs) {
      const blocklistMatch = matchPartsAgainstList(source, blocklist)
      if (blocklistMatch) {
        const match = domainPartsToDomain(blocklistMatch);
        return { match, name, result: true, type: 'blocklist', version }
      }

      if (tolerance > 0) {
        let fuzzyForm = domainPartsToFuzzyForm(source)
        fuzzyForm = fuzzyForm.replace('www.', '')
        const levenshteinMatched = fuzzylist.find((targetParts) => {
          const fuzzyTarget = domainPartsToFuzzyForm(targetParts)
          const distance = ensh.get(fuzzyForm, fuzzyTarget)
          return distance <= tolerance
        })
        if (enshMatched) {
          const match = domainPartsToDomain(enshMatched)
          return { name, match, result: true, type: 'fuzzy', version }
        }
      }
    }

    return { result: false, type: 'all' }
  }

}

module.exports = EthDet


function processConfigs(configs = []) {
  return configs.map((config) => {
    validateConfig(config)
    return Object.assign({}, config, {
      allowlist: processDomainList(config.allowlist || []),
      blocklist: processDomainList(config.blocklist || []),
      fuzzylist: processDomainList(config.fuzzylist || []),
      tolerance: ('tolerance' in config) ? config.tolerance : DEFAULT_TOLERANCE
    })
  });
}

function validateConfig(config) {
  if (config === null || typeof config !== 'object') {
    throw new Error('Invalid config')
  }

  if (config.tolerance && !config.fuzzylist) {
    throw new Error('Fuzzylist tolerance provided without fuzzylist')
  }

  if (
    typeof config.name !== 'string' ||
    config.name === ''
  ) {
    throw new Error("Invalid config parameter: 'name'")
  }

  if (
    !['number', 'string'].includes(typeof config.version) ||
    config.version === ''
  ) {
    throw new Error("Invalid config parameter: 'version'")
  }
}

function processDomainList (list) {
  return list.map(domainToParts)
}

function domainToParts (domain) {
  try {
  return domain.split('.').reverse()
  } catch (e) {
    throw new Error(JSON.stringify(domain))
  }
}

function domainPartsToDomain(domainParts) {
  return domainParts.slice().reverse().join('.')
}

function domainPartsToFuzzyForm(domainParts) {
  return domainParts.slice(1).reverse().join('.')
}

function matchPartsAgainstList(source, list) {
  return list.find((target) => {
    if (target.length > source.length) return false
    return target.every((part, index) => source[index] === part)
  })
}
