/**
 * @file Fluent grammar for tree-sitter
 * @author David Rios <david.rios.gomes@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const HEX_DIGITS = '[0-9a-fA-F]'

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
    $.end_positional_args,
  ],

  rules: {
    fluent_file: ($) =>
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

    positional_arguments: ($) =>
      seq(
        $.expression,
        repeat(seq(alias(token(prec(1, /[ \n]*,[ \n]*/)), ','), $.expression)),
      ),

    named_argument: ($) =>
      seq(
        field('id', $.identifier),
        alias(token(prec(1, /[ \n]*:[ \n]*/)), ':'),
        field('value', $.expression),
      ),

    named_arguments: ($) =>
      seq(
        $.named_argument,
        repeat(
          seq(alias(token(prec(1, /[ \n]*,[ \n]*/)), ','), $.named_argument),
        ),
      ),

    function_call: ($) =>
      seq(
        optional($.blank_lines),
        seq(
          alias(/[ \n]*\([ \n]*/, '('),
          optional(
            seq(
              optional(seq($.positional_arguments, $.end_positional_args)),
              optional($.named_arguments),
            ),
          ),
          alias(/[ \n]*\)[ \n]*/, ')'),
        ),
      ),

    function_reference: ($) =>
      seq(
        seq(
          alias(
            field('id', token(prec(1, /[A-Z][A-Z0-9_-]*/))),
            $.function_name,
          ),
          / */,
        ),
        $.function_call,
      ),

    message_reference: ($) =>
      seq(
        field('id', $.identifier),
        optional(seq('.', field('attribute', $.identifier))),
      ),

    term_reference: ($) =>
      seq(
        field('id', $.term_identifier),
        optional(seq('.', field('attribute', $.identifier))),
        optional($.function_call),
      ),

    expression: ($) =>
      choice(
        $.placeable,
        $.number,
        $.quoted_text,
        $.message_reference,
        $.term_reference,
        $.variable,
        prec(1, $.function_reference),
      ),

    selector_expression: ($) =>
      choice(
        $.number,
        $.quoted_text,
        $.variable,
        prec(1, $.function_reference),
      ),

    selector_key: ($) => choice($.identifier, $.number),

    selector_variant: ($) =>
      seq(
        alias(/\*?\[[ \n]*/, '['),
        field('key', $.selector_key),
        alias(/[\n ]*\]/, ']'),
        field('value', $.pattern),
      ),

    selectors: ($) => seq(/ *-> *\n[ \n]*/, repeat1($.selector_variant), '}'),

    placeable: ($) =>
      seq(
        alias(/\{[ \n]*/, '{'),
        choice(
          seq($.expression, alias(/[ \n]*\}/, '}')),
          seq($.selector_expression, $.selectors),
        ),
      ),

    number: () => /\d\d*(\.\d+)?/,

    quoted_text: ($) =>
      seq('"', alias(repeat(choice($.quoted_escaped, /[^\\"]+/)), $.text), '"'),

    quoted_escaped: ($) =>
      choice(
        new RegExp(`\\\\u${HEX_DIGITS}{4}`),
        new RegExp(`\\\\U${HEX_DIGITS}{6}`),
        '\\"',
        '\\\\',
      ),
  },
})
