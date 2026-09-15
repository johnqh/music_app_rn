/**
 * Makes a project on the server from a New Project submission, and returns its id.
 *
 * Shared by the dashboard and the macOS File menu, which both offer New Project
 * with "Generate for me": a generation job writes its result back to a project
 * row, so a generated piece always starts as a server project, whichever screen
 * asked for it.
 *
 * A generation creates the project up front rather than on completion, so it
 * appears in a list with its badge at once. If the job itself is refused — out
 * of credits, typically — the project it was made to hold is deleted again, or a
 * user with no credits collects an empty "Generated score" on every attempt.
 */
import { emptyScoreForRequest } from '@sudobility/music_lib';
import type { NewProjectSubmission } from '@sudobility/music_lib';
import type { MusicClient } from '@sudobility/music_client';

export async function createServerProject(
  client: MusicClient,
  token: string,
  submission: NewProjectSubmission,
): Promise<string> {
  if (submission.kind === 'blank') {
    const project = await client.createProject(
      { name: submission.title, score: submission.score },
      token,
    );
    return project.id;
  }
  // Not named after the prompt: prompts routinely begin "Create a ...", which
  // makes a list of near-identical names.
  const project = await client.createProject(
    {
      name: submission.request.title?.trim() || 'Generated score',
      score: emptyScoreForRequest(submission.request),
    },
    token,
  );
  try {
    await client.createJob(
      {
        projectId: project.id,
        kind: 'generate-score',
        request: submission.request,
      },
      token,
    );
  } catch (jobError) {
    await client.deleteProject(project.id, token).catch(() => {
      // Best effort: the refusal is what the user needs to hear about.
    });
    throw jobError;
  }
  return project.id;
}
