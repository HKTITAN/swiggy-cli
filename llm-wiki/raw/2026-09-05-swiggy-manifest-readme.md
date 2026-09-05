# Notes: github.com/Swiggy/swiggy-mcp-server-manifest README (read 2026-09-05; last commit 2026-04-24)

- Feature blurbs still say Food and Instamart ordering "currently supports COD only" and Dineout "supports free bookings only" — stale relative to the July 2026 UPI launch documented on mcp.swiggy.com.
- **Allowlisted OAuth redirect URIs**: `claude://claude.ai/settings/connectors`, `https://chatgpt.com/connector_platform_oauth_redirect`, `https://claude.ai/api/mcp/auth_callback`, `https://insiders.vscode.dev/redirect`, `https://oauth.pstmn.io/v1/callback`, `https://vscode.dev/redirect`, `http://localhost`, `http://localhost/callback`, `http://127.0.0.1`, `http://127.0.0.1/callback`. "Contact us if you need additional URIs whitelisted."
- Client setup: Cursor deep links and `~/.cursor/mcp.json` with `{"type":"http","url":"https://mcp.swiggy.com/im"}` etc.; VS Code install links; Claude Desktop Pro via Settings → Connectors → Add custom connector (URL only); generic `mcpServers` JSON.
- Sample prompts ("Late Night Cravings", "Team Lunch Order", "Bolt" fast delivery, "Budget Meals" under ₹150…).
- Recent commits: 2026-04-24 "fix/gptRedirectURL", 2026-01-29 "gpt exception removal", 2026-01-20 "claude config update".
