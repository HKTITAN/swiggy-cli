# Notes: "How to write good skills" — Emil Kowalski, aiforui.dev/learn/how-to-write-good-skills (read 2026-09-05)

- A skill narrows the agent's answer space so the same decision process runs every time; encode decision trees (e.g. an easing flowchart) rather than outcomes.
- **Write down the why** next to each rule so the agent can extend it to unlisted cases ("start scale animations from 0.95, not 0 — objects appearing from nothing feel unnatural").
- **Be strict**: "UI animations stay under 300 ms" beats "keep animations reasonably short". Words like "reasonably", "tasteful", "where appropriate" do not change behaviour; "never", "always" do.
- **Every line must earn its place**: delete anything the model already knows; it dilutes the lines that matter.
- **Keep skills focused**: one skill per aspect, even `/animate` vs `/review-animations`.
- **Test by running**: remove a line, compare outputs.
- Packaged as `/emil-writing-skills`; references Matt Pocock's talk on skills.
