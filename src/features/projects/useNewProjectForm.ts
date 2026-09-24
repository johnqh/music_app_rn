/**
 * The New Project form's state and rules, shared by the sheet
 * (`NewProjectSheet.tsx`, phone/tablet and the macOS File menu) and the
 * desktop Projects window's inline New pane (`NewPane.tsx`) — extracted so
 * two surfaces asking "what should a new project be?" cannot answer it
 * differently. Over the same draft reducer and the same two music_lib
 * builders the web's `NewProjectDialog` uses, so all three apps agree.
 */
import { useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import {
  canCreateNewProject,
  initialNewProjectDraft,
  newProjectCreditEstimate,
  newProjectDefaultTitleKey,
  newProjectSubmission,
  reduceNewProjectDraft,
} from '@sudobility/music_lib';
import type {
  NewProjectDraftAction,
  NewProjectFormDraft,
  NewProjectSubmission,
} from '@sudobility/music_lib';

const reducer = (
  draft: NewProjectFormDraft,
  action: NewProjectDraftAction,
): NewProjectFormDraft => reduceNewProjectDraft(draft, action);

export type UseNewProjectFormOptions = {
  submitting?: boolean;
  /** See `NewProjectSheetProps.outOfCredits`. */
  outOfCredits?: boolean;
  /** See `NewProjectSheetProps.generationAvailable`. */
  generationAvailable?: boolean;
  onSubmit: (submission: NewProjectSubmission) => void;
};

export function useNewProjectForm({
  submitting = false,
  outOfCredits = false,
  generationAvailable = true,
  onSubmit,
}: UseNewProjectFormOptions) {
  const { t } = useTranslation();
  const [draft, dispatch] = useReducer(
    reducer,
    undefined,
    initialNewProjectDraft,
  );
  /*
    The draft's own `generating` is only ever set true through the toggle's
    handler, which refuses it with no server — so a disabled switch that is
    somehow toggled anyway still cannot produce a request there is nowhere to
    send. Read again here as a belt to that brace.
  */
  const generating = draft.generating && generationAvailable;
  const form: NewProjectFormDraft = generating
    ? draft
    : { ...draft, generating: false };

  const credits = newProjectCreditEstimate(form);
  /*
    One rule per mode, from music_lib, so this cannot offer a Create the
    builder would then refuse — and `outOfCredits` gates generation only.
  */
  const canCreate = canCreateNewProject(form, { submitting, outOfCredits });

  const setGenerating = (next: boolean): void =>
    dispatch({
      type: 'setGenerating',
      generating: next && generationAvailable,
    });

  const handleCreate = (): void => {
    if (!canCreate) return;
    /*
      The default title names the *project*: it rides on a generation
      request, and is a blank project's title while the score itself still
      says "Untitled" — the score's title and the project's name are
      different things.
    */
    const submission = newProjectSubmission(
      form,
      t(newProjectDefaultTitleKey(form)),
    );
    if (submission) onSubmit(submission);
  };

  return {
    form,
    dispatch,
    generating,
    setGenerating,
    credits,
    canCreate,
    handleCreate,
  };
}

export type NewProjectFormState = ReturnType<typeof useNewProjectForm>;
export type { NewProjectSubmission };
