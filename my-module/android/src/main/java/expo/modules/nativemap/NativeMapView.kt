package expo.modules.nativemap

import android.content.Context
import android.util.Log
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import expo.modules.kotlin.viewevent.EventDispatcher

class NativeMapView(
    context: Context,
    appContext: AppContext
) : ExpoView(context, appContext) {

    val onOsmLocationSelected by EventDispatcher()

    internal val mapView: OsmMapView

    init {
        try {
            Log.e("NATIVEMAP", "VIEW CREATED")

            mapView = OsmMapView(context)

            Log.e("NATIVEMAP", "OSM CREATED")

            mapView.onLocationSelected = { lat, lng ->
                onOsmLocationSelected(
                    mapOf(
                        "lat" to lat,
                        "lng" to lng
                    )
                )
            }

            addView(
                mapView,
                LayoutParams(
                    LayoutParams.MATCH_PARENT,
                    LayoutParams.MATCH_PARENT
                )
            )

            Log.e("NATIVEMAP", "VIEW ADDED")

        } catch (e: Exception) {
            Log.e("NATIVEMAP", "ERROR", e)
            throw e
        }
    }

    fun setInitialLocation(lat: Double, lng: Double) {
        mapView.controller.setCenter(
            org.osmdroid.util.GeoPoint(lat, lng)
        )
    }
}