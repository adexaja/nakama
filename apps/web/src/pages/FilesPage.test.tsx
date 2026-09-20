import { expect, spyOn, test } from "bun:test";
import type { WorkspaceEntry } from "@nakama/core/contract";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  AuthContext,
  type AuthContextValue,
} from "@/context/auth-context-shared";
import { ThemeContext } from "@/context/theme-context-shared";
import { client } from "@/lib/client";
import { queryKeys } from "@/lib/query-keys";
import { FilesPage } from "./FilesPage";

test("Files starts at the workspace root and opens nested files read-only", async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  const auth: AuthContextValue = {
    activeOrg: {
      createdAt: "",
      id: "org-files",
      name: "Files",
      role: "admin",
      slug: "files",
      updatedAt: "",
    },
    archiveOrg: async () => {},
    createOrg: async () => {},
    isAuthenticated: true,
    isLoading: false,
    login: async () => {},
    logout: async () => {},
    orgs: [],
    refreshSession: async () => {},
    setup: async () => {},
    switchOrg: async () => {},
    updateOrg: async () => {},
    user: { email: "admin@example.com", id: "admin", isPlatformAdmin: true },
  };
  const folder: WorkspaceEntry = {
    filename: "notes",
    kind: "directory",
    mimeType: "application/octet-stream",
    path: "notes",
    sizeBytes: 0,
    updatedAt: "2026-09-20T00:00:00Z",
  };
  const file: WorkspaceEntry = {
    ...folder,
    filename: "notes/daily.md",
    kind: "file",
    mimeType: "text/markdown",
    path: "notes/daily.md",
    sizeBytes: 12,
  };
  queryClient.setQueryData(queryKeys.profiles.all, [{ id: "profile-files" }]);
  queryClient.setQueryData(
    ["workspace-files", "org-files", "profile-files", ""],
    { entries: [folder] }
  );
  queryClient.setQueryData(
    ["workspace-files", "org-files", "profile-files", "notes"],
    { entries: [file] }
  );
  queryClient.setQueryData(
    [
      "workspace-preview",
      "org-files",
      "profile-files",
      file.path,
      file.updatedAt,
    ],
    { blob: new Blob(["Daily notes"]), text: "Daily notes" }
  );
  const pinsKey = ["file-pins", "org-files", "admin", "profile-files"];
  queryClient.setQueryData(pinsKey, { entries: [] });
  let pinned = false;
  const pinRequest = spyOn(client, "setProfileFilePinned").mockImplementation(
    async (_profileId, body) => {
      pinned = body.pinned;
    }
  );
  const listPins = spyOn(client, "listProfileFilePins").mockImplementation(
    async () => ({ entries: pinned ? [file] : [] })
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={auth}>
            <ThemeContext.Provider
              value={{
                resolvedTheme: "light",
                setTheme: () => {},
                theme: "light",
                toggleTheme: () => {},
              }}
            >
              <MemoryRouter>
                <FilesPage />
              </MemoryRouter>
            </ThemeContext.Provider>
          </AuthContext.Provider>
        </QueryClientProvider>
      )
    );
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe(
      "All files"
    );
    const folderButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.startsWith("notes")
    );
    expect(folderButton).toBeDefined();
    await act(async () => folderButton!.click());
    expect(
      container.querySelector('nav[aria-label="Folder"]')?.textContent
    ).toContain("notes");
    await act(async () => {
      (
        container.querySelector('[aria-label="List view"]') as HTMLButtonElement
      ).click();
    });
    expect(
      [...container.querySelectorAll("th")].map((cell) => cell.textContent)
    ).toEqual(["Name", "Type", "Size", "Modified", "Actions"]);
    expect(container.querySelector("tbody")?.textContent).toContain("daily.md");
    expect(container.querySelector("tbody")?.textContent).toContain("12 B");
    const fileButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.startsWith("daily.md")
    );
    expect(fileButton).toBeDefined();
    await act(async () => {
      (
        container.querySelector(
          '[aria-label="Pin daily.md"]'
        ) as HTMLButtonElement
      ).click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(pinRequest).toHaveBeenCalledWith("profile-files", {
      path: "notes/daily.md",
      pinned: true,
    });
    expect(
      container.querySelector('[aria-label="Pinned files"]')?.textContent
    ).toContain("notes/daily.md");
    await act(async () => {
      (
        container.querySelector(
          '[aria-label="Unpin notes/daily.md"]'
        ) as HTMLButtonElement
      ).click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(pinRequest).toHaveBeenLastCalledWith("profile-files", {
      path: "notes/daily.md",
      pinned: false,
    });
    expect(container.querySelector('[aria-label="Pinned files"]')).toBeNull();
    pinRequest.mockRejectedValueOnce(new Error("Unable to save pin"));
    await act(async () => {
      (
        container.querySelector(
          '[aria-label="Pin daily.md"]'
        ) as HTMLButtonElement
      ).click();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Pinned files"]')).toBeNull();

    await act(async () => fileButton!.click());
    const panel = () =>
      container.querySelector('[data-slot="attachment-detail-panel"]');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(panel()?.textContent).toContain("Daily notes");
    expect(
      panel()!.querySelector('[aria-label="Resize panel"]')
    ).not.toBeNull();
    await act(async () =>
      (
        panel()!.querySelector(
          '[aria-label="Enter fullscreen"]'
        ) as HTMLButtonElement
      ).click()
    );
    expect(
      panel()!.querySelector('[aria-label="Exit fullscreen"]')
    ).not.toBeNull();
    expect(panel()!.querySelector('[aria-label="Resize panel"]')).toBeNull();
    await act(async () =>
      (
        panel()!.querySelector('[aria-label="Code"]') as HTMLButtonElement
      ).click()
    );
    expect(
      panel()
        ?.querySelector('[aria-label="Code"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
    await act(async () =>
      (
        panel()!.querySelector(
          '[aria-label="More artifact actions"]'
        ) as HTMLButtonElement
      ).click()
    );
    expect(document.querySelector('[role="menu"]')?.textContent).toContain(
      "Download"
    );
    expect(document.querySelector('[role="menu"]')?.textContent).not.toMatch(
      /Delete|Edit/
    );
    await act(async () =>
      (
        panel()!.querySelector(
          '[aria-label="Close attachment panel"]'
        ) as HTMLButtonElement
      ).click()
    );
    expect(panel()).toBeNull();
    await act(async () => fileButton!.click());
    expect(panel()?.textContent).toContain("Daily notes");
    expect(
      panel()!.querySelector('[aria-label="Enter fullscreen"]')
    ).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
    pinRequest.mockRestore();
    listPins.mockRestore();
  }
});

test("artifact pagination counts visible entries and stops at the last entry", async () => {
  const { FilesArtifactViews } = await import("./files/files-artifact-views");
  const { listArtifactsInFolder } = await import(
    "./files/files-artifact-folders"
  );
  const artifacts = Array.from({ length: 100 }, (_, index) => ({
    filename: `notes/${index}.txt`,
    mimeType: "text/plain",
    path: `notes/${index}.txt`,
    sizeBytes: 1,
    updatedAt: "2026-09-20T00:00:00Z",
  }));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = async (files: typeof artifacts) => {
    const listing = listArtifactsInFolder(files, "");
    await act(async () =>
      root.render(
        <FilesArtifactViews
          artifacts={files}
          deletePending={false}
          emptyFilterMessage=""
          error={null}
          folders={listing.folders}
          isLoading={false}
          listingFiles={listing.files}
          onDelete={() => {}}
          onOpenFolder={() => {}}
          profileId="profile-files"
          showFullPath={false}
          viewMode="grid"
        />
      )
    );
  };
  const showMore = () =>
    [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Show more")
    );
  try {
    await render(artifacts);
    expect(container.querySelectorAll("li").length).toBe(1);
    expect(showMore()).toBeUndefined();
    await render(
      artifacts.slice(0, 31).map((file, index) => ({
        ...file,
        filename: `folder-${index}/note.txt`,
      }))
    );
    expect(container.querySelectorAll("li").length).toBe(30);
    expect(showMore()).toBeDefined();
    await act(async () => showMore()!.click());
    expect(container.querySelectorAll("li").length).toBe(31);
    expect(showMore()).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
