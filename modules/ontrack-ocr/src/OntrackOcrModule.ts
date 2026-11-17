import { NativeModule, requireOptionalNativeModule } from 'expo'

/** One line of text read from a picture; the box is in 0…1 of the image, measured from the top left. */
export interface OcrLine {
  text: string
  x: number
  y: number
  w: number
  h: number
}

// Reading text in pictures on phones: Apple Vision on iPhone, ML Kit on Android. Unlike a plain list
// of strings, every line comes with where it is, so a row like "Netflix ⋯ $15.99" can be put back
// together (src/lib/importers.ts).
declare class OntrackOcrModule extends NativeModule {
  recognize(uri: string): Promise<OcrLine[]>
}

export default requireOptionalNativeModule<OntrackOcrModule>('OntrackOcr')
