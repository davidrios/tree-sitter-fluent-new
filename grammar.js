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
    debug: ($) => repeat(choice($.blank_lines, 'a', 'aaa')),
    blank_lines: ($) => prec.right(repeat1($._blank_line)),
    source_file: ($) => seq(repeat(/\s/), repeat($._definition)),

    _comment_content: ($) => /[^\n]+/,
    comment: ($) => seq('#', optional($._comment_content)),
    group_comment: ($) => seq('##', optional($._comment_content)),
    file_comment: ($) => seq('###', optional($._comment_content)),

    _definition: ($) =>
      choice(
        prec.left(1, $.comment),
        // prec.left(1, choice($.group_comment, '\n')),
        // prec.left(1, choice($.file_comment, '\n')),
        prec.left(2, $.message),
        prec.left(3, $.message_with_comment),
      ),

    message: ($) =>
      prec.left(
        seq(
          choice($.identifier, $.term),
          repeat($._space_tabs),
          '=',
          choice(seq($.text, repeat($._nl_or_indented)), repeat1($._nl_or_indented)),
        ),
      ),

    message_comment: ($) => seq('#', /[^#\n]+/),
    message_with_comment: ($) => seq(repeat1(seq($.message_comment, '\n')), $.message),

    _blank_line: ($) => '\n',

    _nl_or_indented: ($) =>
      choice(prec.left(repeat1($._blank_line)), seq($._blank_line, repeat1($._space_tabs), $.text)),

    _identifier: ($) => /[a-z_][a-z0-9_-]*/,
    identifier: ($) => $._identifier,
    term: ($) => seq('-', $._identifier),

    text: ($) => repeat1(choice(ranges_without(NT_Char, '\n{', '+'), $.placeable)),

    placeable: ($) =>
      seq('{', repeat($._space_tabs), choice($.quoted_text), repeat($._space_tabs), '}'),

    quoted_escaped: ($) =>
      choice(
        seq('\\u', $._hexdigit, $._hexdigit, $._hexdigit, $._hexdigit),
        seq('\\U', $._hexdigit, $._hexdigit, $._hexdigit, $._hexdigit, $._hexdigit, $._hexdigit),
        '\\"',
        '\\\\',
      ),

    quoted_text: ($) =>
      seq('"', repeat(choice($.quoted_escaped, ranges_without(NT_Char, '\\"', '+'))), '"'),

    _hexdigit: ($) => /[0-9a-fA-F]/,
    _space_tabs: ($) => /[ \t]/,
  },
})
