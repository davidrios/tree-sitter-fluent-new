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

// returns true if it stopped at a special stop char
static bool consume_spaces_and_newlines_count(TSLexer *lexer, int *count) {
  lexer->log(lexer, "start consuming spaces and newlines");

  while (lexer->lookahead == ' ') {
    lexer->advance(lexer, false);
    *count = *count + 1;
    lexer->log(lexer, "consumed initial space");
  }

  while (lexer->lookahead == '\n') {
    lexer->advance(lexer, false);
    *count = *count + 1;
    if (lexer->lookahead == '\n') {
      continue;
    }

    if (lexer->lookahead != ' ') {
      lexer->log(lexer, "stop non space: '%c'", lexer->lookahead);
      return true;
    }

    while (lexer->lookahead == ' ') {
      lexer->advance(lexer, false);
      *count = *count + 1;
    }

    if (lexer->lookahead == '.' || lexer->lookahead == '}' ||
        lexer->lookahead == '[') {
      lexer->log(lexer, "stop special: '%c'", lexer->lookahead);
      return true;
    }
  }

  lexer->log(lexer, "finished consuming");

  return false;
}

static bool consume_spaces_and_newlines(TSLexer *lexer) {
  int count = 0;
  return consume_spaces_and_newlines_count(lexer, &count);
}

bool tree_sitter_fluent_external_scanner_scan(void *payload, TSLexer *lexer,
                                              const bool *valid_symbols) {
  Scanner *s = (Scanner *)payload;

  lexer->log(lexer, "starting scan");

  if (valid_symbols[PATTERN_SKIP]) {
    if (lexer->lookahead == '\n' || lexer->lookahead == ' ') {
      lexer->log(lexer, "testing pattern skip");
      if (consume_spaces_and_newlines(lexer)) {
        lexer->result_symbol = PATTERN_SKIP;
        lexer->log(lexer, "return pattern skip");
        return true;
      }
    }
    lexer->log(lexer, "no pattern skip");
  }

  if (valid_symbols[PATTERN_START]) {
    s->in_pattern = true;
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
      lexer->advance(lexer, false);
    }
    lexer->result_symbol = PATTERN_START;
    lexer->log(lexer, "return pattern start");
    return true;
  }

  bool encountered_special = false;

  if (valid_symbols[PATTERN_PURE_TEXT] && s->in_pattern) {
    lexer->log(lexer, "testing pure text");
    bool has_content = false;

    while (lexer->lookahead != 0) {
      bool started_with_space = false;
      if (lexer->lookahead == ' ') {
        lexer->log(lexer, "consuming spaces");
        lexer->mark_end(lexer);
        started_with_space = true;
        while (lexer->lookahead == ' ') {
          lexer->advance(lexer, false);
        }
      }

      if (lexer->lookahead == '\n') {
        lexer->log(lexer, "detected nl");
        if (!started_with_space) {
          lexer->log(lexer, "marking end");
          lexer->mark_end(lexer);
        }

        if (consume_spaces_and_newlines(lexer)) {
          encountered_special = true;
          lexer->log(lexer, "breaking special");
          break;
        }

        lexer->log(lexer, "mark has content");
        has_content = true;
        lexer->mark_end(lexer);
      }

      if (lexer->lookahead == '{') {
        if (started_with_space) {
          has_content = true;
          lexer->mark_end(lexer);
        }
        lexer->log(lexer, "break placeable start");
        break;
      }

      lexer->advance(lexer, false);
      lexer->log(lexer, "consumed non-zero");
      has_content = true;
      lexer->mark_end(lexer);
    }

    if (has_content) {
      lexer->log(lexer, "returning pure text");
      lexer->result_symbol = PATTERN_PURE_TEXT;
      return true;
    }

    lexer->log(lexer, "no pure text");
  }

  if (valid_symbols[PATTERN_END] && s->in_pattern) {
    lexer->log(lexer, "testing pattern end");
    int count = 0;
    bool stopped = false;
    if (!encountered_special) {
      bool stopped = consume_spaces_and_newlines_count(lexer, &count);
    }
    if (encountered_special || (count > 0 && stopped)) {
      s->in_pattern = false;
      lexer->result_symbol = PATTERN_END;
      lexer->mark_end(lexer);
      lexer->log(lexer, "return pattern end");
      return true;
    }
  }

  if (valid_symbols[BLANK_LINES] &&
      (lexer->lookahead == ' ' || lexer->lookahead == '\n')) {
    lexer->log(lexer, "start BLANK_LINES");
    consume_spaces_and_newlines(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = BLANK_LINES;
    lexer->log(lexer, "return BLANK_LINES");
    return true;
  }

  lexer->log(lexer, "scan ended with false");

  return false;
}
