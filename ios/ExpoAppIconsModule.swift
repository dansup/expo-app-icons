import ExpoModulesCore

private let assetPrefix = "AppIcon-"

public class ExpoAppIconsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAppIcons")

    Function("isSupported") { () -> Bool in
      self.onMain { UIApplication.shared.supportsAlternateIcons }
    }

    Function("getAppIcon") { () -> String? in
      self.onMain { self.iconName(fromAsset: UIApplication.shared.alternateIconName) }
    }

    Function("getAvailableIcons") { () -> [String] in
      self.availableIcons()
    }

    AsyncFunction("setAppIcon") { (name: String?, promise: Promise) in
      guard UIApplication.shared.supportsAlternateIcons else {
        promise.reject(IconsNotSupportedException())
        return
      }

      if let name, !self.availableIcons().contains(name) {
        promise.reject(UnknownIconException(name))
        return
      }

      let asset = name.map { assetPrefix + $0 }
      if UIApplication.shared.alternateIconName == asset {
        promise.resolve(name)
        return
      }

      UIApplication.shared.setAlternateIconName(asset) { error in
        if let error {
          promise.reject(IconChangeFailedException(error.localizedDescription))
        } else {
          promise.resolve(name)
        }
      }
    }
    .runOnQueue(.main)
  }

  private func availableIcons() -> [String] {
    guard
      let icons = Bundle.main.object(forInfoDictionaryKey: "CFBundleIcons") as? [String: Any],
      let alternates = icons["CFBundleAlternateIcons"] as? [String: Any]
    else {
      return []
    }
    return alternates.keys.compactMap { iconName(fromAsset: $0) }.sorted()
  }

  private func iconName(fromAsset asset: String?) -> String? {
    guard let asset, asset.hasPrefix(assetPrefix) else {
      return nil
    }
    return String(asset.dropFirst(assetPrefix.count))
  }

  private func onMain<T>(_ work: () -> T) -> T {
    if Thread.isMainThread {
      return work()
    }
    return DispatchQueue.main.sync(execute: work)
  }
}

internal final class IconsNotSupportedException: Exception {
  override var reason: String {
    "Alternate app icons are not supported on this device"
  }
}

internal final class UnknownIconException: GenericException<String> {
  override var reason: String {
    "Unknown app icon \"\(param)\". Make sure it is listed in the expo-app-icons plugin config and the app was rebuilt."
  }
}

internal final class IconChangeFailedException: GenericException<String> {
  override var reason: String {
    "Failed to change the app icon: \(param)"
  }
}
