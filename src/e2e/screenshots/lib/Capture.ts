import sharp from 'sharp';

import { CropRegion } from './Scene';

/** Handles PNG cropping via sharp. */
export class Capture {
  /** Crop rawBuffer to region and write the result to destPath. */
  static async cropAndWrite(
    rawBuffer: Buffer,
    region: CropRegion,
    destPath: string
  ): Promise<void> {
    await sharp(rawBuffer)
      .extract({
        left: region.left,
        top: region.top,
        width: region.width,
        height: region.height,
      })
      .toFile(destPath);
  }
}
