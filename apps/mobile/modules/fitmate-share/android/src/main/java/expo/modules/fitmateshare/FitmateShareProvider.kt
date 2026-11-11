package expo.modules.fitmateshare

import androidx.core.content.FileProvider

/** Own subclass so it never clashes with other libraries' file providers. */
class FitmateShareProvider : FileProvider()
