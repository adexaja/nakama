import type { ArtifactFile } from "@nakama/core/contract";
import { useArtifactAttachmentPreviewPanel } from "@/components/chat/use-artifact-attachment-preview-panel";
import { artifactBasename } from "@/pages/files/files-artifact-folders";
import { FileEntry } from "@/pages/files/files-artifact-list-view";
import { ArtifactRowMenu } from "@/pages/files/files-artifact-row-menu";
import { toChatArtifactRef } from "@/pages/files/files-shared";

export function ArtifactGridCard({
  profileId,
  artifact,
  deletePending,
  showFullPath,
  onDelete,
}: {
  profileId: string;
  artifact: ArtifactFile;
  deletePending: boolean;
  showFullPath: boolean;
  onDelete: () => void;
}) {
  const { openPanel } = useArtifactAttachmentPreviewPanel({
    artifact: toChatArtifactRef(artifact),
    id: `files-page-grid:${artifact.path || artifact.filename}`,
    profileId,
  });

  return (
    <FileEntry
      {...artifact}
      actions={
        <ArtifactRowMenu
          artifact={artifact}
          deletePending={deletePending}
          onDelete={onDelete}
          profileId={profileId}
        />
      }
      filename={
        showFullPath ? artifact.filename : artifactBasename(artifact.filename)
      }
      onOpen={openPanel}
      pinPath={`artifacts/${artifact.filename}`}
      viewMode="grid"
    />
  );
}
