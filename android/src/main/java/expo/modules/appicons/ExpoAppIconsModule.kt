package expo.modules.appicons

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val META_DATA_NAME = "expo.modules.appicons.icon"
private const val DEFAULT_ICON = "default"
private const val PREFS_NAME = "expo.modules.appicons"
private const val PREFS_KEY_ICON = "icon"

internal class IconsNotSupportedException : CodedException(
  "ERR_ICONS_NOT_SUPPORTED",
  "No app icons are configured. Add the expo-app-icons plugin to app.json and rebuild the app.",
  null
)

internal class UnknownIconException(name: String?) : CodedException(
  "ERR_UNKNOWN_ICON",
  "Unknown app icon \"$name\". Make sure it is listed in the expo-app-icons plugin config and the app was rebuilt.",
  null
)

private data class IconAlias(
  val icon: String,
  val component: ComponentName,
  val enabledInManifest: Boolean
)

class ExpoAppIconsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val packageManager: PackageManager
    get() = context.packageManager

  private val pendingDisable = mutableSetOf<ComponentName>()

  override fun definition() = ModuleDefinition {
    Name("ExpoAppIcons")

    OnCreate {
      runCatching { reconcile() }
    }

    Function("isSupported") {
      aliases().isNotEmpty()
    }

    Function("getAppIcon") {
      currentIcon()
    }

    Function("getAvailableIcons") {
      aliases().map { it.icon }.filter { it != DEFAULT_ICON }.sorted()
    }

    AsyncFunction("setAppIcon") { name: String? ->
      setIcon(name)
    }

    OnActivityEntersBackground {
      runCatching { flushPending() }
    }
  }

  private fun setIcon(name: String?): String? {
    val all = aliases()
    if (all.isEmpty()) {
      throw IconsNotSupportedException()
    }
    val wanted = name ?: DEFAULT_ICON
    val target = all.firstOrNull { it.icon == wanted } ?: throw UnknownIconException(name)

    val previouslyEnabled = all.filter { it.component != target.component && isEnabled(it) }
    packageManager.setComponentEnabledSetting(
      target.component,
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
      PackageManager.DONT_KILL_APP
    )
    pendingDisable.remove(target.component)
    pendingDisable.addAll(previouslyEnabled.map { it.component })
    prefs().edit().putString(PREFS_KEY_ICON, wanted).apply()
    return name
  }

  private fun flushPending() {
    if (pendingDisable.isEmpty()) {
      return
    }
    val keep = prefs().getString(PREFS_KEY_ICON, null)
    val keepComponent = aliases().firstOrNull { it.icon == keep }?.component
    pendingDisable
      .filter { it != keepComponent }
      .forEach {
        packageManager.setComponentEnabledSetting(
          it,
          PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
          PackageManager.DONT_KILL_APP
        )
      }
    pendingDisable.clear()
  }

  private fun reconcile() {
    val all = aliases()
    if (all.isEmpty()) {
      return
    }
    val enabled = all.filter { isEnabled(it) }
    when {
      enabled.isEmpty() -> {
        val fallback = all.firstOrNull { it.icon == DEFAULT_ICON } ?: all.first()
        packageManager.setComponentEnabledSetting(
          fallback.component,
          PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
          PackageManager.DONT_KILL_APP
        )
        prefs().edit().putString(PREFS_KEY_ICON, fallback.icon).apply()
      }
      enabled.size > 1 -> {
        val stored = prefs().getString(PREFS_KEY_ICON, null)
        val keep = enabled.firstOrNull { it.icon == stored } ?: enabled.first()
        pendingDisable.addAll(enabled.filter { it.component != keep.component }.map { it.component })
      }
    }
  }

  private fun currentIcon(): String? {
    val all = aliases()
    if (all.isEmpty()) {
      return null
    }
    val stored = prefs().getString(PREFS_KEY_ICON, null)
    val icon = if (stored != null && all.any { it.icon == stored }) {
      stored
    } else {
      all.firstOrNull { it.icon != DEFAULT_ICON && isEnabled(it) }?.icon ?: DEFAULT_ICON
    }
    return icon.takeUnless { it == DEFAULT_ICON }
  }

  private fun isEnabled(alias: IconAlias): Boolean =
    when (packageManager.getComponentEnabledSetting(alias.component)) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
      PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> alias.enabledInManifest
      else -> false
    }

  private fun aliases(): List<IconAlias> {
    val flags = PackageManager.GET_ACTIVITIES or
      PackageManager.GET_META_DATA or
      PackageManager.MATCH_DISABLED_COMPONENTS
    val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      packageManager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
    } else {
      @Suppress("DEPRECATION")
      packageManager.getPackageInfo(context.packageName, flags)
    }
    return packageInfo.activities.orEmpty()
      .filter { it.targetActivity != null }
      .mapNotNull { info ->
        val icon = info.metaData?.getString(META_DATA_NAME) ?: return@mapNotNull null
        IconAlias(icon, ComponentName(info.packageName, info.name), info.enabled)
      }
  }

  private fun prefs() = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
