// NOTE: Fully ai-generated
/// Collapse JSX whitespace exactly like React's classic transform.
/// Returns `None` if the text node should be dropped entirely
/// (i.e. it was all whitespace across lines).
pub fn collapse_jsx_whitespace(raw: &str) -> Option<String> {
    let lines: Vec<&str> = raw.split('\n').collect();
    let line_count = lines.len();

    // Find the last line that has non-whitespace content.
    let last_non_empty = lines
        .iter()
        .rposition(|l| l.chars().any(|c| c != ' ' && c != '\t' && c != '\r'));

    // If every line is pure whitespace, drop the node.
    let last_non_empty = last_non_empty?;

    let mut result = String::new();

    for (i, raw_line) in lines.iter().enumerate() {
        let is_first = i == 0;
        let is_last = i == line_count - 1;

        // Step 1: tabs → spaces, strip trailing \r from \r\n splits
        let line = raw_line
            .replace('\t', " ")
            .trim_end_matches('\r')
            .to_string();

        // Step 2: conditionally trim
        let trimmed = if !is_first && !is_last {
            // Middle line: trim both sides
            line.trim().to_string()
        } else if !is_first {
            // Last line: trim only leading
            line.trim_start().to_string()
        } else if !is_last {
            // First line: trim only trailing
            line.trim_end().to_string()
        } else {
            // Only line (first AND last): no trimming at all
            line
        };

        if trimmed.is_empty() {
            continue;
        }

        result.push_str(&trimmed);

        // If this isn't the last non-empty line, join with a single space
        if i != last_non_empty {
            result.push(' ');
        }
    }

    if result.is_empty() {
        None
    } else {
        Some(result)
    }
}
