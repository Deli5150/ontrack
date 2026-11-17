package expo.modules.ontrackocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

// Reads the text in a picture (src/lib/importers.ts) with ML Kit: every line with its box, in 0…1
// of the image, so rows can be put back together.
class OntrackOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OntrackOcr")

    AsyncFunction("recognize") { uriString: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("No context")
        val uri = when {
          uriString.startsWith("content://") || uriString.startsWith("file://") -> Uri.parse(uriString)
          else -> Uri.fromFile(File(uriString))
        }
        val image = InputImage.fromFilePath(context, uri)
        // ML Kit's boxes are in the upright image, which is the stored size turned by the EXIF rotation.
        val turned = image.rotationDegrees == 90 || image.rotationDegrees == 270
        val width = (if (turned) image.height else image.width).toDouble().coerceAtLeast(1.0)
        val height = (if (turned) image.width else image.height).toDouble().coerceAtLeast(1.0)
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
          .process(image)
          .addOnSuccessListener { result ->
            val lines = result.textBlocks.flatMap { it.lines }.mapNotNull { line ->
              val b = line.boundingBox ?: return@mapNotNull null
              mapOf(
                "text" to line.text,
                "x" to b.left / width,
                "y" to b.top / height,
                "w" to b.width() / width,
                "h" to b.height() / height
              )
            }
            promise.resolve(lines)
          }
          .addOnFailureListener { promise.reject(CodedException("ERR_OCR", it.message ?: "Couldn't read the picture", it)) }
      } catch (e: Exception) {
        promise.reject(CodedException("ERR_OCR", e.message ?: "Couldn't read the picture", e))
      }
    }
  }
}
