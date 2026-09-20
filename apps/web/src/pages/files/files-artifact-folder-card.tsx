import type { ArtifactFolderEntry } from "@/pages/files/files-artifact-folders";
import { FileEntry } from "@/pages/files/files-artifact-list-view";

export function ArtifactFolderCard({
  folder,
  onOpen,
}: {
  folder: ArtifactFolderEntry;
  onOpen: (prefix: string) => void;
}) {
  return (
    <FileEntry
      directory
      fileCount={folder.fileCount}
      filename={folder.name}
      onOpen={() => onOpen(folder.prefix)}
      viewMode="grid"
    />
  );
}
