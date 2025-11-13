/**
 * GitHub API Utility for committing changes to your repository
 * Requires GITHUB_TOKEN environment variable
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = "RCRSWEB";
const GITHUB_OWNER = "michaelmusercrs";
const GITHUB_BRANCH = "main"; // or your default branch

interface GitHubFile {
  path: string;
  content: string;
  message: string;
}

/**
 * Commit a file to GitHub
 */
export async function commitFileToGitHub(file: GitHubFile) {
  if (!GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN not configured. Please add it to your Vercel environment variables."
    );
  }

  try {
    // Get the current file SHA (needed for updates)
    let sha: string | undefined;
    try {
      const getResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${file.path}`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (getResponse.ok) {
        const data = (await getResponse.json()) as { sha: string };
        sha = data.sha;
      }
    } catch (error) {
      // File doesn't exist yet, that's okay
    }

    // Encode content to base64
    const encodedContent = Buffer.from(file.content).toString("base64");

    // Commit the file
    const commitResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${file.path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: file.message,
          content: encodedContent,
          branch: GITHUB_BRANCH,
          ...(sha && { sha }), // Include SHA if file exists
        }),
      }
    );

    if (!commitResponse.ok) {
      const errorData = await commitResponse.json();
      throw new Error(
        `GitHub API error: ${commitResponse.status} - ${JSON.stringify(errorData)}`
      );
    }

    return {
      success: true,
      message: `Successfully published: ${file.path}`,
    };
  } catch (error) {
    console.error("GitHub commit error:", error);
    throw error;
  }
}

/**
 * Commit multiple files in a single commit
 */
export async function commitMultipleFilesToGitHub(
  files: GitHubFile[],
  commitMessage: string
) {
  if (!GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN not configured. Please add it to your Vercel environment variables."
    );
  }

  try {
    // Get the current commit SHA
    const refResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!refResponse.ok) {
      throw new Error("Failed to get current branch reference");
    }

    const refData = (await refResponse.json()) as { object: { sha: string } };
    const latestCommitSha = refData.object.sha;

    // Get the tree SHA
    const commitResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${latestCommitSha}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const commitData = (await commitResponse.json()) as {
      tree: { sha: string };
    };
    const baseTreeSha = commitData.tree.sha;

    // Create tree with new files
    const treeItems = files.map((file) => ({
      path: file.path,
      mode: "100644",
      type: "blob",
      content: file.content,
    }));

    const treeResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeItems,
        }),
      }
    );

    const treeData = (await treeResponse.json()) as { sha: string };
    const newTreeSha = treeData.sha;

    // Create new commit
    const newCommitResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: commitMessage,
          tree: newTreeSha,
          parents: [latestCommitSha],
        }),
      }
    );

    const newCommitData = (await newCommitResponse.json()) as { sha: string };

    // Update reference
    const updateResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sha: newCommitData.sha,
          force: false,
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error("Failed to update branch reference");
    }

    return {
      success: true,
      message: `Successfully published ${files.length} file(s)`,
    };
  } catch (error) {
    console.error("GitHub batch commit error:", error);
    throw error;
  }
}
