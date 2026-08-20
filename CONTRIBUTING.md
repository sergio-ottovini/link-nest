## 🤝 Contributing

We believe that software improves when many hands shape it. Whether you are a seasoned developer or a curious user, your contribution helps keep this tool useful and secure for everyone.

We'd love to accept your patches and contributions to this project.

## Branches

Link Nest uses two long-lived branches:

-   **`main`** — the actively developed 2.x line. This is the default branch and
    the base for new pull requests.
-   **`v1`** — the maintenance branch for the 1.x line. Target this branch only
    for fixes that need to ship to 0.x.x.


There is no need to re-sync or rename anything locally:

```bash
git switch main
git pull            # fast-forwards onto the 2.x line
```

To work on a 0.1.x fix, base your branch on `v1`:

```bash
git switch -c my-fix origin/v1
```


### How to Help
*   **🐛 Report Bugs:** Found a glitch? Open an issue and describe the steps to reproduce.
*   **💡 Suggest Features:** Have an idea for a new view or export format? Let's discuss it in an Issue.
*   **🛠️ Submit Code:** We welcome Pull Requests! Please check our `CONTRIBUTING.md` (if available) or the Issues tab to see current needs.

> "If you would like to help improve the application, fix a bug, or suggest a new feature, please join us at [GitHub Repository]."

**[🔗 Go to Link Nest on GitHub](https://github.com/your-username/link-nest)** *(Replace with actual link)*

### Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose.


### Large or Complex Changes

For substantial features or architectural revisions:

-   Open an Issue First: Outline your proposal, including design considerations and impact.
-   Gather Feedback: Discuss with maintainers and the community to ensure alignment and avoid duplicate work.

*Disclaimer: Link Nest is an open-source project. While I have reviewed the code for general usability, please conduct your own research regarding specific local data storage permissions within your browser environment.*
