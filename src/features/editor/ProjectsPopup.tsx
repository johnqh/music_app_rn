/**
 * The Projects sidebar, over the editor.
 *
 * An open project has the whole screen: the tab bar is gone and so is the
 * split view's sidebar, which is what a split view does when its detail is
 * given the full width — the master stays one press away, drawn over the
 * content from the leading edge, rather than beside it. Choosing an item
 * leaves the editor for the Projects tab with that pane showing; pressing
 * anywhere else puts the popup away and changes nothing.
 *
 * Drawn in the editor's own tree rather than in a `Modal`. A `Modal` is a
 * second native window with its own idea of which orientations it supports,
 * and this app is landscape-only on every device; an absolutely placed view
 * has no such opinion.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TOUCH_TARGET } from '@sudobility/components-rn';
import { useAuth } from '@/auth/AuthContext';
import { useDocuments } from '@/documents/DocumentsContext';
import { ProjectsSidebar } from '@/app/projects-window/ProjectsSidebar';
import { usePrimaryPanelWidth } from '@/components/layout/SplitViewContainer';
import type { PaneKey } from '@/app/projects-window/paneKey';

export type ProjectsPopupProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (pane: PaneKey) => void;
};

export function ProjectsPopup({ open, onClose, onSelect }: ProjectsPopupProps) {
  const { t } = useTranslation();
  // The split view's own list width, which is what this is a drawing of.
  const width = usePrimaryPanelWidth();
  const { user } = useAuth();
  const { documents } = useDocuments();
  if (!open) return null;

  return (
    <View style={StyleSheet.absoluteFill} className="flex-row">
      <View style={[styles.panel, { width }]} className="bg-background">
        <ProjectsSidebar
          selected={null}
          signedIn={user !== null}
          showOpen={documents.length > 0}
          onSelect={pane => {
            onClose();
            onSelect(pane);
          }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        onAccessibilityTap={onClose}
        className="flex-1 bg-black/30"
        // Everything the panel does not cover, so never small in practice;
        // stated for the width a very narrow screen would leave it.
        style={{ minWidth: MIN_TOUCH_TARGET }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Lifted off the score beneath it, so it reads as over the content and not
  // as a column of it.
  panel: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8,
    zIndex: 1,
  },
});
