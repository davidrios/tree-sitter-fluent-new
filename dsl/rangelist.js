/**
 * RangeList
 *
 * Subclass of Array.
 * Parse character ranges into a list of ranges, and can setdiff two
 * ranges, using Range.setdiff under the hood.
 */
const { Range } = require('./range')

class RangeList extends Array {
  static parseFromString(ranges, excludes = '') {
    const range_objects = []
    const range_re = /^.-./
    while (ranges) {
      if (range_re.test(ranges)) {
        range_objects.push(new Range(ranges[0], ranges[2]))
        ranges = ranges.substr(3)
      } else {
        range_objects.push(new Range(ranges[0]))
        ranges = ranges.substr(1)
      }
    }
    range_objects.sort((a, b) => a.start - b.start)
    let rangelist = new RangeList()
    while (range_objects.length) {
      const range = range_objects.shift()
      rangelist.push(range)
      if (!range_objects) {
        break
      }
      while (range_objects.length && range.end + 1 >= range_objects[0].start) {
        const other_range = range_objects.shift()
        range.end = Math.max(range.end, other_range.end)
      }
    }
    if (excludes) {
      rangelist = new RangeList(...rangelist.setdiff(RangeList.parseFromString(excludes)))
    }
    return rangelist
  }

  *setdiff(other_list) {
    if (!other_list) {
      for (const range of this) {
        yield range
      }
      return
    }
    const this_iter = this[Symbol.iterator]()
    const other_iter = other_list[Symbol.iterator]()
    let { value: range, done: range_done } = this_iter.next()
    let { value: other } = other_iter.next()
    // console.log(this.map(r => r+''),other_list.map(r => r+''))
    while (range && !range_done) {
      let value
      let done
      for ({ value, done } of range.setdiff(other)) {
        if (done && value) {
          yield value
        } else {
          break
        }
      }
      if (range && other && range.end + 1 >= other.end) {
        ;({ value: other } = other_iter.next())
      }
      if (done) {
        ;({ value: range, done: range_done } = this_iter.next())
      } else {
        range = value
      }
    }
  }

  get re() {
    return new RegExp('[' + this.join('') + ']')
  }

  getRe(addToEnd) {
    return new RegExp('[' + this.join('') + ']' + (addToEnd != null ? addToEnd : ''))
  }
}

module.exports = {
  RangeList: RangeList,
}
