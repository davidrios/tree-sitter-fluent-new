/**
 * @file Fluent grammar for tree-sitter
 * @author David Rios <david.rios.gomes@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "fluent",

  rules: {
    // TODO: add the actual grammar rules
    source_file: $ => "hello"
  }
});
