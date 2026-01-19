(comment_block) @comment
(file_comment) @comment.file
(group_comment) @comment.group

(doc_comment_block) @comment.documentation

(number_literal) @number
(string_literal) @string
(escaped_literal) @string.escape

(message
  id: (identifier) @label
  )

(message_reference
  id: (identifier) @tag
  attribute: (identifier) @tag.attribute
  )

(term_reference
  attribute: (identifier) @attribute
  )

(variable) @variable

(term_identifier) @type

(attribute
  id: (identifier) @attribute
  )

[
 "["
 "]"
 "("
 ")"
 "{"
 "}"
] @punctuation.bracket

(placeable
  "{" @punctuation.special
  "}" @punctuation.special
  )

[
 "="
 "->"
  ; "*"
] @operator

[
 "."
 ","
] @punctuation.delimiter
