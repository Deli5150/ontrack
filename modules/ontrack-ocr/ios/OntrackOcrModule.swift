import ExpoModulesCore
import UIKit
import Vision

// Reads the text in a picture (src/lib/importers.ts). Vision gives each line's box with the origin at
// the bottom left; it's turned around here so y grows downwards like everywhere else.
public class OntrackOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OntrackOcr")

    AsyncFunction("recognize") { (url: URL, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let data = try Data(contentsOf: url)
          guard let image = UIImage(data: data), let cgImage = image.cgImage else {
            return promise.reject("ERR_IMAGE", "Couldn't open this picture.")
          }
          let request = VNRecognizeTextRequest()
          request.recognitionLevel = .accurate
          request.usesLanguageCorrection = true
          let handler = VNImageRequestHandler(cgImage: cgImage, orientation: Self.orientation(image.imageOrientation))
          try handler.perform([request])
          let lines: [[String: Any]] = (request.results ?? []).compactMap { o in
            guard let text = o.topCandidates(1).first?.string else { return nil }
            let b = o.boundingBox
            return ["text": text, "x": b.minX, "y": 1 - b.maxY, "w": b.width, "h": b.height]
          }
          promise.resolve(lines)
        } catch {
          promise.reject("ERR_OCR", error.localizedDescription)
        }
      }
    }
  }

  private static func orientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
