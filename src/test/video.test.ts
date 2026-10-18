import { describe, expect, it } from "vitest";
import { createVideoTextDecoder, MAX_VIDEO_BYTES, videoUploadError } from "@/lib/video";

describe("saved video analysis", () => {
  it("accepts saved video files up to 25 MB", () => {
    expect(videoUploadError(25 * 1024 * 1024, "video/mp4")).toBeNull();
    expect(videoUploadError(MAX_VIDEO_BYTES + 1, "video/mp4")).not.toBeNull();
  });
  it("rejects empty and non-video uploads", () => {
    expect(videoUploadError(0, "video/mp4")).not.toBeNull();
    expect(videoUploadError(123, "image/png")).not.toBeNull();
  });
  it("retains text and narration from split events and an unterminated final line", () => {
    const decoder = createVideoTextDecoder();
    decoder.push('data: {"choices":[{"delta":{"content":"ON-SCREEN TEXT: 150 g');
    decoder.push(' noodles\\n"}}]}\n\n');
    decoder.push('data: {"choices":[{"delta":{"content":"NARRATION: Serves three"}}]}');
    expect(decoder.finish()).toBe("ON-SCREEN TEXT: 150 g noodles\nNARRATION: Serves three");
  });
  it("does not silently accept a failed stream as a partial recipe", () => {
    const decoder = createVideoTextDecoder();
    expect(() => decoder.push('data: {"error":{"message":"Video analysis denied"}}\n')).toThrow("Video analysis denied");
  });
});