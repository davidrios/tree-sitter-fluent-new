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
