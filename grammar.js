/**
 * @file Fluent grammar for tree-sitter
 * @author David Rios <david.rios.gomes@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const { ranges_without } = require('./dsl')

const NT_Char = '\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD'

module.exports = grammar({
  name: 'fluent',

  extras: ($) => [],

  rules: {
    source_file: ($) =>
      seq(
        repeat($._blank_line),
        repeat(seq($._definition, $._line_break, repeat($._blank_line))),
        optional($._definition),
      ),

    _definition: ($) => choice($.message),

    _identifier: ($) => /[a-z_][a-z0-9_-]*/,
    identifier: ($) => $._identifier,
    term: ($) => seq('-', $._identifier),
    _line_break: ($) => /[\u000A\u000D]+/,
    _inline_space: ($) => /[\u0020\u0009]+/,
    _blank_line: ($) => seq(optional($._inline_space), $._line_break),
    _hexdigit: ($) => /[0-9a-fA-F]/,

    quoted_text: ($) =>
      seq(
        '"',
        optional($._inline_space),
        repeat(
          choice(
            '\\"',
            seq('\\u', $._hexdigit, $._hexdigit, $._hexdigit, $._hexdigit),
            seq(
              '\\U',
              $._hexdigit,
              $._hexdigit,
              $._hexdigit,
              $._hexdigit,
              $._hexdigit,
              $._hexdigit,
            ),
            '\\\\',
            /[^\\"]*/,
          ),
        ),
        optional($._inline_space),
        '"',
      ),

    placeable: ($) =>
      seq('{', optional($._inline_space), choice($.quoted_text), optional($._inline_space), '}'),

    text: ($) => repeat1(choice(ranges_without(NT_Char, '\r\n\\{', '+'), $.placeable)),

    message: ($) =>
      seq($.identifier, optional($._inline_space), '=', optional($._inline_space), $.text),
  },
})
