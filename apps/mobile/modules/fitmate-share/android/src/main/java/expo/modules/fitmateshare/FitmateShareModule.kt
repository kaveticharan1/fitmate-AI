package expo.modules.fitmateshare

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.FileProvider
import androidx.core.content.pm.PackageInfoCompat
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

private class UpdateException(code: String, message: String) : CodedException(code, message, null)

/**
 * Shares FitMate itself, and updates it in place.
 *
 * Sharing: copies the installed app (the same APK the user
 * installed) to a private cache folder and opens Android's share sheet with
 * the file attached plus a message, so friends get an installable file.
 *
 * Updating: downloads the new APK into the same private cache folder, checks it
 * is FitMate, signed with the same key and newer, then opens Android's own
 * "Update" screen. Same package + same key means Android keeps all app data.
 */
class FitmateShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FitmateShare")

    Events("onUpdateProgress")

    /** Installed version, so the app can tell whether a release is newer. */
    Function("appInfo") {
      val ctx = appContext.reactContext ?: throw UpdateException("NO_CONTEXT", "No app context")
      val pi = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
      mapOf(
        "versionCode" to PackageInfoCompat.getLongVersionCode(pi).toDouble(),
        "versionName" to (pi.versionName ?: ""),
        "abis" to Build.SUPPORTED_ABIS.toList(),
      )
    }

    /** Whether the user has allowed FitMate to install updates ("Install unknown apps"). */
    Function("canInstall") {
      val ctx = appContext.reactContext ?: return@Function false
      ctx.packageManager.canRequestPackageInstalls()
    }

    /** Opens FitMate's own "Install unknown apps" switch in Settings. */
    Function("openInstallSettings") {
      val ctx = appContext.reactContext ?: return@Function false
      val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.packageName))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      true
    }

    /** A verified, newer update already downloaded earlier, or null. Removes stale ones. */
    Function("downloadedUpdate") {
      val ctx = appContext.reactContext ?: return@Function null
      val file = updateFile(ctx)
      if (!file.exists()) return@Function null
      try {
        describe(verify(ctx, file), file)
      } catch (e: Exception) {
        file.delete()
        null
      }
    }

    /** Downloads the update (with progress events), then verifies it. Runs off the UI thread. */
    AsyncFunction("downloadUpdate") { url: String, promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) {
        promise.reject(UpdateException("NO_CONTEXT", "No app context"))
        return@AsyncFunction
      }
      val file = updateFile(ctx)
      val part = File(file.parentFile, "FitMate.apk.part")
      try {
        file.parentFile?.mkdirs()
        file.delete()
        part.delete()
        var conn = URL(url).openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = true
        conn.connectTimeout = 20_000
        conn.readTimeout = 30_000
        conn.setRequestProperty("User-Agent", "FitMate-Updater")
        // GitHub sends release files from another host; follow up to 5 hops by hand to be safe.
        var hops = 0
        while (conn.responseCode in 300..399 && hops < 5) {
          val next = conn.getHeaderField("Location") ?: break
          conn.disconnect()
          conn = URL(URL(url), next).openConnection() as HttpURLConnection
          conn.connectTimeout = 20_000
          conn.readTimeout = 30_000
          conn.setRequestProperty("User-Agent", "FitMate-Updater")
          hops++
        }
        if (conn.responseCode !in 200..299) throw UpdateException("DOWNLOAD_FAILED", "Server said " + conn.responseCode)
        val total = conn.contentLengthLong
        var received = 0L
        var lastSent = 0L
        conn.inputStream.use { input ->
          part.outputStream().use { output ->
            val buf = ByteArray(64 * 1024)
            while (true) {
              val n = input.read(buf)
              if (n < 0) break
              output.write(buf, 0, n)
              received += n
              val now = SystemClock.elapsedRealtime()
              if (now - lastSent > 200) {
                lastSent = now
                sendEvent("onUpdateProgress", mapOf("received" to received.toDouble(), "total" to total.toDouble()))
              }
            }
          }
        }
        conn.disconnect()
        if (total > 0 && received != total) throw UpdateException("DOWNLOAD_FAILED", "Download stopped early")
        sendEvent("onUpdateProgress", mapOf("received" to received.toDouble(), "total" to received.toDouble()))
        if (!part.renameTo(file)) throw UpdateException("DOWNLOAD_FAILED", "Couldn't save the download")
        promise.resolve(describe(verify(ctx, file), file))
      } catch (e: CodedException) {
        part.delete(); file.delete()
        promise.reject(e)
      } catch (e: Exception) {
        part.delete(); file.delete()
        promise.reject(UpdateException("DOWNLOAD_FAILED", e.message ?: "Download failed"))
      }
    }

    /** Opens Android's "Update FitMate?" screen for the downloaded file. */
    AsyncFunction("installUpdate") { promise: Promise ->
      val ctx = appContext.reactContext
      val activity = appContext.currentActivity
      if (ctx == null || activity == null) {
        promise.reject(UpdateException("NO_ACTIVITY", "FitMate isn't in the foreground"))
        return@AsyncFunction
      }
      val file = updateFile(ctx)
      if (!file.exists()) {
        promise.reject(UpdateException("NO_DOWNLOAD", "Nothing downloaded yet"))
        return@AsyncFunction
      }
      if (!ctx.packageManager.canRequestPackageInstalls()) {
        promise.reject(UpdateException("NEEDS_PERMISSION", "Allow FitMate to install updates first"))
        return@AsyncFunction
      }
      val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".fitmateshare", file)
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      activity.runOnUiThread {
        try {
          activity.startActivity(intent)
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject(UpdateException("INSTALL_FAILED", e.message ?: "Couldn't open the installer"))
        }
      }
    }

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
        dir.listFiles()?.filter { it.isFile }?.forEach { it.delete() }
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

  private fun updateFile(ctx: Context) = File(File(ctx.cacheDir, "fitmate-share/update"), "FitMate.apk")

  private val signFlag: Int
    get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES else 0

  private fun signerDigests(pi: PackageInfo?): Set<String>? {
    // Android 8 (API 26-27) can't read the new signature format here; Android itself still checks on install.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return null
    val info = pi?.signingInfo ?: return null
    val signers = if (info.hasMultipleSigners()) info.apkContentsSigners else info.signingCertificateHistory
    if (signers.isNullOrEmpty()) return null
    val md = MessageDigest.getInstance("SHA-256")
    return signers.map { sig -> md.digest(sig.toByteArray()).joinToString("") { "%02x".format(it) } }.toSet()
  }

  /** Throws unless the file is a newer FitMate signed with the same key as this install. */
  private fun verify(ctx: Context, file: File): PackageInfo {
    val pm = ctx.packageManager
    val archive = pm.getPackageArchiveInfo(file.path, signFlag)
      ?: throw UpdateException("BAD_FILE", "The download isn't a valid app file")
    if (archive.packageName != ctx.packageName) throw UpdateException("WRONG_APP", "The download isn't FitMate")
    val installed = pm.getPackageInfo(ctx.packageName, signFlag)
    val mine = signerDigests(installed)
    val theirs = signerDigests(archive)
    // Same key = Android keeps your data. A different key would be refused by Android anyway.
    if (mine != null && theirs != null && mine.intersect(theirs).isEmpty()) {
      throw UpdateException("SIGNATURE_MISMATCH", "The download is signed with a different key")
    }
    if (PackageInfoCompat.getLongVersionCode(archive) <= PackageInfoCompat.getLongVersionCode(installed)) {
      throw UpdateException("NOT_NEWER", "You already have this version")
    }
    return archive
  }

  private fun describe(pi: PackageInfo, file: File) = mapOf(
    "versionCode" to PackageInfoCompat.getLongVersionCode(pi).toDouble(),
    "versionName" to (pi.versionName ?: ""),
    "bytes" to file.length().toDouble(),
  )
}
