#include "tree_sitter/alloc.h"
#include "tree_sitter/parser.h"

#define FLUENT_IS_DEBUG

#ifdef FLUENT_IS_DEBUG
#define FLUENT_DEBUG(...) lexer->log(lexer, __VA_ARGS__);
#else
#define FLUENT_DEBUG(...)
#endif

// Avoid infinite loops with unfinished lines
#define FLUENT_MAX_NESTED_PATTERNS 10

enum TokenType {
  PATTERN_START,
  PATTERN_PURE_TEXT,
  PATTERN_END,
  PATTERN_SKIP,
  BLANK_LINES,
  UNFINISHED_LINE,
  CLOSE_COMMENT_BLOCK,
  END_POSITIONAL_ARGS,
};

typedef struct {
  uint8_t in_pattern;
  bool is_skip;
} Scanner;

void *tree_sitter_fluent_external_scanner_create() {
  Scanner *s = (Scanner *)ts_malloc(sizeof(Scanner));
  s->in_pattern = 0;
  s->is_skip = false;
  return s;
}

void tree_sitter_fluent_external_scanner_destroy(void *payload) {
  ts_free(payload);
}

unsigned tree_sitter_fluent_external_scanner_serialize(void *payload,
                                                       char *buffer) {
  Scanner *s = (Scanner *)payload;
  buffer[0] = s->in_pattern;
  buffer[1] = s->is_skip ? 1 : 0;
  return 2;
}

void tree_sitter_fluent_external_scanner_deserialize(void *payload,
                                                     const char *buffer,
                                                     unsigned length) {
  Scanner *s = (Scanner *)payload;
  if (length > 0) {
    s->in_pattern = buffer[0];
    s->is_skip = buffer[1];
  } else {
    s->in_pattern = 0;
    s->is_skip = false;
  }
}

// returns true if it stopped at a special stop char
static bool consume_spaces_and_newlines_count(TSLexer *lexer, int *count) {
  FLUENT_DEBUG("start consuming spaces and newlines")

  while (lexer->lookahead == ' ') {
    lexer->advance(lexer, false);
    *count = *count + 1;
    FLUENT_DEBUG("consumed initial space");
  }

  while (lexer->lookahead == '\n') {
    lexer->advance(lexer, false);
    *count = *count + 1;
    if (lexer->lookahead == '\n') {
      continue;
    }

    if (lexer->lookahead != ' ') {
      FLUENT_DEBUG("stop non space: '%c'", lexer->lookahead)
      return true;
    }

    while (lexer->lookahead == ' ') {
      lexer->advance(lexer, false);
      *count = *count + 1;
    }

    if (lexer->lookahead == '.' || lexer->lookahead == '}' ||
        lexer->lookahead == '[' || lexer->lookahead == '*') {
      FLUENT_DEBUG("stop special: '%c'", lexer->lookahead)
      return true;
    }
  }

  FLUENT_DEBUG("finished consuming")

  return false;
}

static bool consume_spaces_and_newlines(TSLexer *lexer) {
  int count = 0;
  return consume_spaces_and_newlines_count(lexer, &count);
}

static bool is_close_comment_block(TSLexer *lexer) {
  bool is_hash = lexer->lookahead == '#';

  if (lexer->lookahead != '\n' && !is_hash) {
    return false;
  }

  lexer->mark_end(lexer);
  lexer->advance(lexer, false);

  if (!is_hash && lexer->lookahead == '#') {
    lexer->advance(lexer, false);
  }

  if (lexer->lookahead != ' ') {
    return true;
  }

  return false;
}

static bool consume_identifier(TSLexer *lexer) {
  if (!((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
        (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z'))) {
    return false;
  }

  lexer->advance(lexer, false);

  while ((lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
         (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
         lexer->lookahead == '_' || lexer->lookahead == '-') {
    lexer->advance(lexer, false);
  }

  return true;
}

static bool is_end_positional_args(TSLexer *lexer) {
  lexer->mark_end(lexer);
  consume_spaces_and_newlines(lexer);

  if (lexer->lookahead == ')') {
    return true;
  }

  if (lexer->lookahead != ',') {
    return false;
  }
  lexer->advance(lexer, false);

  consume_spaces_and_newlines(lexer);
  lexer->mark_end(lexer);

  if (!consume_identifier(lexer)) {
    return false;
  }

  consume_spaces_and_newlines(lexer);

  return lexer->lookahead == ':';
}

bool tree_sitter_fluent_external_scanner_scan(void *payload, TSLexer *lexer,
                                              const bool *valid_symbols) {
  Scanner *s = (Scanner *)payload;

  FLUENT_DEBUG("starting scan")

  if (lexer->lookahead == 0) {
    if (valid_symbols[PATTERN_END]) {
      lexer->result_symbol = PATTERN_END;
      FLUENT_DEBUG("return pattern end")
      return true;
    }
    if (valid_symbols[CLOSE_COMMENT_BLOCK]) {
      lexer->result_symbol = CLOSE_COMMENT_BLOCK;
      FLUENT_DEBUG("return CLOSE_COMMENT_BLOCK")
      return true;
    }
    if (valid_symbols[PATTERN_SKIP]) {
      lexer->result_symbol = PATTERN_SKIP;
      FLUENT_DEBUG("return pattern end")
      return true;
    }

    return false;
  }

  if (valid_symbols[PATTERN_SKIP]) {
    if (lexer->lookahead == '\n' || lexer->lookahead == ' ') {
      FLUENT_DEBUG("test pattern skip")
      if (consume_spaces_and_newlines(lexer)) {
        s->is_skip = true;
        lexer->result_symbol = PATTERN_SKIP;
        FLUENT_DEBUG("return pattern skip")
        return true;
      }
    }
    FLUENT_DEBUG("no pattern skip")
  }

  if (valid_symbols[PATTERN_START] &&
      s->in_pattern < FLUENT_MAX_NESTED_PATTERNS && lexer->lookahead != 0) {
    FLUENT_DEBUG("start pattern start")
    s->in_pattern += 1;
    s->is_skip = false;
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
      lexer->advance(lexer, false);
    }
    lexer->result_symbol = PATTERN_START;
    FLUENT_DEBUG("return pattern start")
    return true;
  }

  bool encountered_special = false;

  if (valid_symbols[PATTERN_PURE_TEXT] && s->in_pattern && !s->is_skip) {
    FLUENT_DEBUG("test pure text")
    bool has_content = false;

    while (lexer->lookahead != 0) {
      bool started_with_space = false;
      if (lexer->lookahead == ' ') {
        FLUENT_DEBUG("consuming spaces")
        lexer->mark_end(lexer);
        started_with_space = true;
        while (lexer->lookahead == ' ') {
          lexer->advance(lexer, false);
        }
      }

      if (lexer->lookahead == '\n') {
        FLUENT_DEBUG("detected nl")
        if (!started_with_space) {
          FLUENT_DEBUG("marking end")
          lexer->mark_end(lexer);
        }

        if (consume_spaces_and_newlines(lexer)) {
          encountered_special = true;
          FLUENT_DEBUG("breaking special")
          break;
        }

        FLUENT_DEBUG("mark has content")
        has_content = true;
        lexer->mark_end(lexer);
      }

      if (lexer->lookahead == '{') {
        if (started_with_space) {
          has_content = true;
          lexer->mark_end(lexer);
        }
        FLUENT_DEBUG("break placeable start")
        break;
      }

      lexer->advance(lexer, false);
      has_content = true;
      lexer->mark_end(lexer);
    }

    if (has_content) {
      FLUENT_DEBUG("returning pure text")
      lexer->result_symbol = PATTERN_PURE_TEXT;
      return true;
    }

    FLUENT_DEBUG("no pure text")
  }

  if (valid_symbols[PATTERN_END] && s->in_pattern) {
    FLUENT_DEBUG("test pattern end")
    int count = 0;
    bool stopped = false;
    if (!encountered_special) {
      bool stopped = consume_spaces_and_newlines_count(lexer, &count);
    }
    if (encountered_special || (count > 0 && stopped)) {
      s->in_pattern -= 1;
      lexer->mark_end(lexer);
      lexer->result_symbol = PATTERN_END;
      FLUENT_DEBUG("return pattern end")
      return true;
    }
    FLUENT_DEBUG("no pattern end")
  }

  if (valid_symbols[BLANK_LINES] &&
      (lexer->lookahead == ' ' || lexer->lookahead == '\n')) {
    FLUENT_DEBUG("start BLANK_LINES")
    consume_spaces_and_newlines(lexer);
    lexer->mark_end(lexer);
    lexer->result_symbol = BLANK_LINES;
    FLUENT_DEBUG("return BLANK_LINES")
    return true;
  }

  if (valid_symbols[UNFINISHED_LINE] &&
      s->in_pattern >= FLUENT_MAX_NESTED_PATTERNS) {
    FLUENT_DEBUG("start UNFINISHED_LINE")
    while (lexer->lookahead != '\n') {
      lexer->advance(lexer, false);
    }
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    lexer->result_symbol = UNFINISHED_LINE;
    s->is_skip = false;
    s->in_pattern = 0;
    FLUENT_DEBUG("return UNFINISHED_LINE")
    return true;
  }

  if (valid_symbols[CLOSE_COMMENT_BLOCK]) {
    FLUENT_DEBUG("test CLOSE_COMMENT_BLOCK")
    if (is_close_comment_block(lexer)) {
      lexer->result_symbol = CLOSE_COMMENT_BLOCK;
      FLUENT_DEBUG("return CLOSE_COMMENT_BLOCK")
      return true;
    }
    FLUENT_DEBUG("no CLOSE_COMMENT_BLOCK")
  }

  if (valid_symbols[END_POSITIONAL_ARGS]) {
    FLUENT_DEBUG("test END_POSITIONAL_ARGS")
    if (is_end_positional_args(lexer)) {
      lexer->result_symbol = END_POSITIONAL_ARGS;
      FLUENT_DEBUG("return END_POSITIONAL_ARGS")
      return true;
    }
    FLUENT_DEBUG("no END_POSITIONAL_ARGS")
  }

  FLUENT_DEBUG("scan ended with false")

  return false;
}
