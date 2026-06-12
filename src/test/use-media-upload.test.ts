import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ChangeEvent } from "react";

// Spies for the four media server actions + the router refresh.
const assignMediaAction = vi.fn();
const requestUploadAction = vi.fn();
const confirmUploadAction = vi.fn();
const deleteMediaAction = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/actions/media.actions", () => ({
  assignMediaAction: (...a: unknown[]) => assignMediaAction(...a),
  requestUploadAction: (...a: unknown[]) => requestUploadAction(...a),
  confirmUploadAction: (...a: unknown[]) => confirmUploadAction(...a),
  deleteMediaAction: (...a: unknown[]) => deleteMediaAction(...a),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { useMediaUpload } from "@/hooks/use-media-upload";

function fakeFileEvent(): ChangeEvent<HTMLInputElement> {
  const file = new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" });
  // The hook only reads `target.files?.[0]` and writes `target.value = ""`.
  return { target: { files: [file], value: "" } } as unknown as ChangeEvent<HTMLInputElement>;
}

describe("useMediaUpload — assign entityId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestUploadAction.mockResolvedValue({
      success: true,
      data: { assetId: "asset_1", uploadUrl: "https://r2.example/put" },
    });
    confirmUploadAction.mockResolvedValue({ success: true });
    assignMediaAction.mockResolvedValue({ success: true, data: { assignmentId: "assign_1" } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
  });

  // Regression: the cover/upload pipeline used to pass `propertyId` as the
  // assign entityId for every surface. For a space that makes assignMediaAction
  // look up `space.findUnique({ id: propertyId })` → not found → "La entidad no
  // pertenece a esta propiedad", so no space photo could ever be uploaded.
  it("assigns to config.entityId when provided (space → spaceId, not propertyId)", async () => {
    const { result } = renderHook(() =>
      useMediaUpload({
        propertyId: "prop_1",
        entityType: "space",
        entityId: "space_42",
        usageKey: "space.space_42",
      }),
    );
    await act(async () => {
      await result.current.onFileChange(fakeFileEvent());
    });
    expect(assignMediaAction).toHaveBeenCalledWith("asset_1", "space", "space_42", "space.space_42");
    expect(result.current.error).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
  });

  // Surfaces whose entity IS the property (property / access_method) omit
  // entityId and must keep the historical behaviour: entityId === propertyId.
  it("falls back to propertyId as entityId when entityId is omitted", async () => {
    const { result } = renderHook(() =>
      useMediaUpload({
        propertyId: "prop_1",
        entityType: "access_method",
        usageKey: "access.parking",
      }),
    );
    await act(async () => {
      await result.current.onFileChange(fakeFileEvent());
    });
    expect(assignMediaAction).toHaveBeenCalledWith("asset_1", "access_method", "prop_1", "access.parking");
  });
});
