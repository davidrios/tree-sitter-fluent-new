#include "tree_sitter/alloc.h"
#include "tree_sitter/parser.h"

enum TokenType {
  PATTERN_START,
  PATTERN_PURE_TEXT,
  PATTERN_END,
  PATTERN_SKIP,
  BLANK_LINES,
};

typedef struct {
  bool in_pattern;
} Scanner;

void *tree_sitter_fluent_external_scanner_create() {
  Scanner *s = (Scanner *)ts_malloc(sizeof(Scanner));
  s->in_pattern = false;
  return s;
}

void tree_sitter_fluent_external_scanner_destroy(void *payload) {
  ts_free(payload);
}

unsigned tree_sitter_fluent_external_scanner_serialize(void *payload,
                                                       char *buffer) {
  Scanner *s = (Scanner *)payload;
  buffer[0] = s->in_pattern ? 1 : 0;
  return 1;
}

void tree_sitter_fluent_external_scanner_deserialize(void *payload,
                                                     const char *buffer,
                                                     unsigned length) {
  Scanner *s = (Scanner *)payload;
  if (length > 0) {
    s->in_pattern = buffer[0] == 1;
  } else {
    s->in_pattern = false;
  }
}

static bool check_stop_line(TSLexer *lexer) {
  while (lexer->lookahead == '\n') {
    lexer->advance(lexer, false);

    if (lexer->lookahead != ' ') {
      return true;
    }

    while (lexer->lookahead == ' ') {
      lexer->advance(lexer, false);
    }

    if (lexer->lookahead == '.' || lexer->lookahead == '}' ||
        lexer->lookahead == '[') {
      return true;
    }
  }

  return false;
}

bool tree_sitter_fluent_external_scanner_scan(void *payload, TSLexer *lexer,
                                              const bool *valid_symbols) {
  Scanner *s = (Scanner *)payload;

  if (valid_symbols[PATTERN_SKIP]) {
    while (lexer->lookahead == ' ') {
      lexer->advance(lexer, false);
    }

    if (lexer->lookahead == '\n') {
      if (check_stop_line(lexer)) {
        lexer->result_symbol = PATTERN_SKIP;
        return true;
      }
    }
  }

  if (valid_symbols[PATTERN_START]) {
    s->in_pattern = true;
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
      lexer->advance(lexer, false);
    }
    lexer->result_symbol = PATTERN_START;
    return true;
  }

  if (valid_symbols[PATTERN_END] && s->in_pattern) {
    bool should_end = false;

    if (lexer->lookahead == '\n') {
      if (check_stop_line(lexer)) {
        should_end = true;
      }
    } else if (lexer->lookahead == 0) {
      should_end = true;
    }

    if (should_end) {
      s->in_pattern = false;
      lexer->result_symbol = PATTERN_END;
      return true;
    }
  }

  if (valid_symbols[PATTERN_PURE_TEXT] && s->in_pattern) {
    bool has_content = false;

    while (lexer->lookahead != 0) {
      if (lexer->lookahead == '{' || lexer->lookahead == '}') {
        break;
      }

      if (lexer->lookahead == '\n') {
        lexer->mark_end(lexer);
        if (check_stop_line(lexer)) {
          break;
        }
      } else {
        lexer->advance(lexer, false);
      }

      has_content = true;
      lexer->mark_end(lexer);
    }

    if (has_content) {
      lexer->result_symbol = PATTERN_PURE_TEXT;
      return true;
    }
  }

  if (valid_symbols[BLANK_LINES] && lexer->get_column(lexer) == 0 &&
      (lexer->lookahead == ' ' || lexer->lookahead == '\n')) {
    lexer->advance(lexer, false);
    while (lexer->lookahead == ' ' || lexer->lookahead == '\n') {
      lexer->advance(lexer, false);
    }

    lexer->result_symbol = BLANK_LINES;
    return true;
  }

  return false;
}
