package expo.modules.nativemap

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeMapModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("NativeMap")

        View(NativeMapView::class) {
    Events("onOsmLocationSelected")

            Prop("initialLocation") { view: NativeMapView, location: Map<String, Double>? ->
                if (location != null) {
                    val lat = location["lat"] ?: return@Prop
                    val lng = location["lng"] ?: return@Prop
                    view.setInitialLocation(lat, lng)
                }
            }
        }
    }
}