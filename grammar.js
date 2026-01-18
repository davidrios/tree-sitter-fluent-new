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
    $.unfinished_line,
    $.close_comment_block,
  ],

  rules: {
    source: ($) =>
      repeat(
        choice(
          $.comment_block,
          $.group_comment,
          $.file_comment,
          $.message,
          $.term,
          $.with_doc_comment,
          $.blank_lines,
          $.unfinished_line,
        ),
      ),

    comment_content: () => /[^\n]+\n/,
    _base_comment: ($) => seq('# ', alias($.comment_content, $.content)),
    _comment_block: ($) => seq(repeat1($._base_comment)),
    comment_block: ($) => seq($._comment_block, $.close_comment_block),

    group_comment: ($) => seq('## ', $.comment_content),
    file_comment: ($) => seq('### ', $.comment_content),

    with_doc_comment: ($) =>
      seq(
        alias($._comment_block, $.doc_comment_block),
        choice($.message, $.term),
      ),

    message: ($) =>
      seq(
        field('id', $.identifier),
        / */,
        '=',
        seq(
          choice(field('value', $.pattern), $.pattern_skip),
          field('attributes', alias(repeat($.attribute), $.attributes)),
        ),
      ),

    attribute: ($) =>
      seq(
        seq('.', field('id', $.identifier)),
        / */,
        '=',
        choice(field('value', $.pattern), $.pattern_skip),
      ),

    identifier: () => /[a-zA-Z][a-zA-Z0-9_-]*/,

    term: ($) =>
      seq(field('id', $.term_identifier), / */, '=', field('value', $.pattern)),

    term_identifier: ($) => seq('-', alias($.identifier, 'identifier')),

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
