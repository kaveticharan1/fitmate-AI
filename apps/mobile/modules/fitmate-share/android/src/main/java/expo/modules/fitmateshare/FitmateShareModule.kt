package expo.modules.fitmateshare

import android.content.ClipData
import android.content.Intent
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Shares FitMate itself: copies the installed app (the same APK the user
 * installed) to a private cache folder and opens Android's share sheet with
 * the file attached plus a message, so friends get an installable file.
 */
class FitmateShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FitmateShare")

    /** Size of the installed app in bytes, or 0 if unknown. */
    Function("appSize") {
      val ctx = appContext.reactContext ?: return@Function 0.0
      File(ctx.applicationInfo.sourceDir).length().toDouble()
    }

    AsyncFunction("shareApp") { message: String, chooserTitle: String, promise: Promise ->
      val ctx = appContext.reactContext
      val activity = appContext.currentActivity
      if (ctx == null || activity == null) {
        promise.reject(CodedException("NO_ACTIVITY", "FitMate isn't in the foreground", null))
        return@AsyncFunction
      }
      try {
        val dir = File(ctx.cacheDir, "fitmate-share").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val out = File(dir, "FitMate.apk")
        File(ctx.applicationInfo.sourceDir).copyTo(out, overwrite = true)
        val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".fitmateshare", out)
        val send = Intent(Intent.ACTION_SEND).apply {
          type = "application/vnd.android.package-archive"
          putExtra(Intent.EXTRA_STREAM, uri)
          putExtra(Intent.EXTRA_TEXT, message)
          putExtra(Intent.EXTRA_SUBJECT, "FitMate")
          clipData = ClipData.newRawUri("FitMate.apk", uri)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(send, chooserTitle).apply { addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        activity.runOnUiThread {
          try {
            activity.startActivity(chooser)
            promise.resolve(true)
          } catch (e: Exception) {
            promise.reject(CodedException("SHARE_FAILED", e.message ?: "Couldn't open sharing", e))
          }
        }
      } catch (e: Exception) {
        promise.reject(CodedException("SHARE_FAILED", e.message ?: "Couldn't prepare the app file", e))
      }
    }
  }
}
