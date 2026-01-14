/**
 * @file Fluent grammar for tree-sitter
 * @author David Rios <david.rios.gomes@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const WHITESPACES = '[ \t]'
const WHITESPACES_RE = new RegExp(`${WHITESPACES}+`)

module.exports = grammar({
  name: 'fluent',

  extras: ($) => [],

  rules: {
    // debug: ($) => repeat(choice($.blank_lines)),
    source: ($) =>
      repeat(
        choice(
          $.blank_lines,
          $.comment,
          $.group_comment,
          $.file_comment,
          $.message,
          $.message_with_comment,
        ),
      ),

    whitespaces: ($) => WHITESPACES_RE,
    blank_lines: ($) => prec.right(repeat1(choice($.new_lines, $.whitespaces))),
    new_line: ($) => prec.left(1, '\n'),
    new_lines: ($) => /\n+/,

    comment_content: ($) => /.+/,
    comment: ($) => seq('#', $.comment_content),
    group_comment: ($) => seq('##', $.comment_content),
    file_comment: ($) => seq('###', $.comment_content),

    message_with_comment: ($) => seq(repeat1(seq($.comment, '\n')), $.message),

    prec_whitespaces: ($) => token(prec(10, WHITESPACES_RE)),

    message: ($) =>
      seq(
        choice($.identifier, $.term),
        optional($.prec_whitespaces),
        $.assignment,
        optional($.prec_whitespaces),
        $.message_value,
      ),

    _identifier: ($) => /[a-z_][a-z0-9_-]*/,
    identifier: ($) => $._identifier,
    term: ($) => seq('-', $._identifier),

    assignment: ($) => '=',

    message_value: ($) =>
      seq(
        choice($.pattern, $.message_continuation),
        repeat($.message_continuation),
      ),
    text: ($) => token(prec(1, /[^\n{}]+/)),
    pattern: ($) => repeat1(choice($.text, $.placeable)),
    message_continuation: ($) =>
      seq(new RegExp(`\n${WHITESPACES}+`), $.pattern),

    placeable: ($) =>
      seq(
        '{',
        optional($.whitespaces),
        $.quoted_text,
        optional($.whitespaces),
        '}',
      ),

    quoted_text: ($) =>
      seq('"', repeat(choice($.quoted_escaped, /[^\\"]+/)), '"'),

    quoted_escaped: ($) =>
      choice(
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
        '\\"',
        '\\\\',
      ),

    _hexdigit: ($) => /[0-9a-fA-F]/,
  },
})
