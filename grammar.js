/**
 * @file Fluent grammar for tree-sitter
 * @author David Rios <david.rios.gomes@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'fluent',

  extras: () => [],
  externals: ($) => [
    $.pattern_start,
    $.pattern_pure_text,
    $.pattern_end,
    $.pattern_skip,
    $.blank_lines,
  ],

  rules: {
    // debug: ($) => repeat(choice($.blank_lines)),
    source: ($) =>
      repeat(
        choice(
          $.comment,
          $.group_comment,
          $.file_comment,
          $.message,
          $.message_with_doc_comment,
          $.term,
          $.term_with_doc_comment,
          $.blank_lines,
        ),
      ),

    whitespaces: () => / +/,

    comment_content: () => seq(/[^\n]+/, '\n'),
    comment: ($) => seq('# ', $.comment_content),
    group_comment: ($) => seq('## ', $.comment_content),
    file_comment: ($) => seq('### ', $.comment_content),

    message: ($) =>
      seq(
        field('id', $.identifier),
        optional($.whitespaces),
        $.assignment,
        seq(
          choice(field('value', $.pattern), prec(1, $.pattern_skip)),
          field('attribute', repeat($.attribute)),
        ),
      ),
    message_with_doc_comment: ($) =>
      seq(repeat1(prec(1, seq($.comment))), $.message),

    attribute: ($) =>
      seq(
        seq('.', field('id', $.identifier)),
        optional($.whitespaces),
        $.assignment,
        choice(field('value', $.pattern), prec(1, $.pattern_skip)),
      ),

    identifier: () => /[a-zA-Z][a-zA-Z0-9_-]*/,

    term: ($) =>
      seq(
        field('id', $.term_identifier),
        optional($.whitespaces),
        $.assignment,
        field('value', $.pattern),
      ),
    term_with_doc_comment: ($) => seq(repeat1(prec(1, seq($.comment))), $.term),

    term_identifier: ($) => seq('-', alias($.identifier, 'identifier')),

    assignment: () => '=',

    variable: ($) => seq('$', alias($.identifier, 'identifier')),

    pattern: ($) =>
      seq(
        $.pattern_start,
        repeat1(choice($.pattern_pure_text, $.placeable)),
        $.pattern_end,
      ),

    expression: ($) =>
      choice(
        $.number,
        $.quoted_text,
        alias($.identifier, $.message_id),
        alias($.term_identifier, $.term_id),
        $.variable,
      ),

    selector_key: ($) => choice($.identifier, $.number),

    selector_variant: ($) =>
      seq(
        /\*?\[[ \n]*/,
        field('key', $.selector_key),
        /[\n ]*\]/,
        field('value', $.pattern),
      ),

    selectors: ($) => seq(/ *-> *\n[ \n]*/, repeat1($.selector_variant), '}'),

    placeable: ($) =>
      seq(/\{[ \n]*/, $.expression, choice($.selectors, /[ \n]*\}/)),

    number: () => /\d\d*(\.\d+)?/,

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

    _hexdigit: () => /[0-9a-fA-F]/,
  },
})
