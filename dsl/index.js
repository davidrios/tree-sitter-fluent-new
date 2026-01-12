const { RangeList } = require('./rangelist')

function ranges_without(ranges, excludes = '', addToEnd) {
  ranges = RangeList.parseFromString(ranges, excludes)
  return ranges.getRe(addToEnd)
}

module.exports = {
  ranges_without: ranges_without,
}
