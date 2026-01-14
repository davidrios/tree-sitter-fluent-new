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
          // $.comment,
          // $.group_comment,
          // $.file_comment,
          $.message,
          seq(token(prec(0, '\n')), $.message),
          // $.message_with_comment,
        ),
      ),

    whitespaces: ($) => WHITESPACES_RE,
    // indentation: ($) => token(prec(1, / +/)),
    just_spaces: ($) => /[ ]+/,
    blank_lines_: ($) => prec.right(repeat1(choice($.new_line, $.just_spaces))),
    blank_lines: ($) => prec.left(repeat1(/[ ]*\n/)),
    new_line: ($) => '\n',
    new_lines: ($) => /\n+/,

    comment_content: ($) => / .+/,
    comment: ($) => seq('#', $.comment_content),
    group_comment: ($) => seq('##', $.comment_content),
    file_comment: ($) => seq('###', $.comment_content),

    message_with_comment: ($) => seq(repeat1(seq($.comment, '\n')), $.message),

    prec_whitespaces: ($) => token(prec(100, /[ \t]+/)),

    message: ($) =>
      seq(
        field('id', $.identifier),
        optional($.prec_whitespaces),
        $.assignment,
        optional($.prec_whitespaces),
        field('value', $.pattern),
      ),

    _identifier: ($) => /[a-z_][a-z0-9_-]*/,
    identifier: ($) => $._identifier,
    term: ($) => seq('-', $._identifier),

    assignment: ($) => '=',

    // pattern_: ($) =>
    //   prec.right(
    //     0,
    //     seq(
    //       choice($.text, $.pattern_continuation),
    //       repeat($.pattern_continuation),
    //     ),
    //   ),

    pattern: ($) => repeat1(choice($.pure_text, $.placeable)),
    pure_text: ($) => token(prec(90, /[^{}]+/)),

    // pattern_continuation: ($) =>
    //   seq(repeat(choice('\n', ' ')), $.indented_text),
    //
    // blank_line: ($) => /[ ]*\n/,
    // indented_text: ($) => seq(/\n[ ]+/, $.text),

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
