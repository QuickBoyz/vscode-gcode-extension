import sharp from 'sharp';

import { CropRegion } from './Scene';

/** Handles PNG cropping via sharp. */
export class Capture {
  /**
   * Crop rawBuffer to region and write the result to destPath.
   *
   * Clamps the requested region to the actual image bounds so a crop region
   * calibrated for a 1920x1080 canvas still yields a file when the window
   * came out smaller (e.g. on CI where window sizing is unreliable on older
   * Chromium-based Electron). Logs the clamp so drift is visible.
   */
  static async cropAndWrite(
    rawBuffer: Buffer,
    region: CropRegion,
    destPath: string
  ): Promise<void> {
    const metadata = await sharp(rawBuffer).metadata();
    const imageWidth = metadata.width ?? 0;
    const imageHeight = metadata.height ?? 0;

    const left = Math.max(0, Math.min(region.left, Math.max(0, imageWidth - 1)));
    const top = Math.max(0, Math.min(region.top, Math.max(0, imageHeight - 1)));
    const width = Math.max(1, Math.min(region.width, imageWidth - left));
    const height = Math.max(1, Math.min(region.height, imageHeight - top));

    if (
      left !== region.left ||
      top !== region.top ||
      width !== region.width ||
      height !== region.height
    ) {
      console.warn(
        `[screenshot] Crop region ${JSON.stringify(region)} exceeds image ${imageWidth}x${imageHeight}; ` +
          `clamped to {left:${left},top:${top},width:${width},height:${height}}`
      );
    }

    await sharp(rawBuffer).extract({ left, top, width, height }).toFile(destPath);
  }
}
