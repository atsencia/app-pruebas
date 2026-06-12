package expo.modules.nativemap
import android.util.Log
import android.content.Context
import android.graphics.drawable.Drawable
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import android.view.MotionEvent

class OsmMapView(context: Context) : MapView(context) {
    var onLocationSelected: ((Double, Double) -> Unit)? = null
    private var lastTouchX = 0f
    private var lastTouchY = 0f
    private var marker: Marker? = null

    init {
            Log.e("NATIVEMAP", "OSM INIT START")

        Configuration.getInstance().load(
            context,
            context.getSharedPreferences("osmdroid", Context.MODE_PRIVATE)
        )
        Configuration.getInstance().userAgentValue = context.packageName
        setTileSource(TileSourceFactory.MAPNIK)
        setMultiTouchControls(true)
        setBuiltInZoomControls(true)
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        when (ev.action) {
            MotionEvent.ACTION_DOWN -> {
                lastTouchX = ev.x
                lastTouchY = ev.y
            }
            MotionEvent.ACTION_UP -> {
                val dx = Math.abs(ev.x - lastTouchX)
                val dy = Math.abs(ev.y - lastTouchY)
                if (dx < 10 && dy < 10) {
                    val geoPoint = projection.fromPixels(ev.x.toInt(), ev.y.toInt()) as GeoPoint
                    placeMarker(geoPoint)
                    onLocationSelected?.invoke(geoPoint.latitude, geoPoint.longitude)
                }
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun placeMarker(point: GeoPoint) {
        if (marker == null) {
            marker = Marker(this).apply {
                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
            }
            overlays.add(marker)
        }
        marker?.position = point
        invalidate()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        onResume()
        controller.setZoom(15.0)
        controller.setCenter(GeoPoint(4.677391, -74.062609))
    }

    override fun onDetachedFromWindow() {
        onPause()
        super.onDetachedFromWindow()
    }

    fun setCenter(lat: Double, lng: Double) {
        val point = GeoPoint(lat, lng)
        controller.setCenter(point)
        placeMarker(point)
    }


    

override fun onPause() {
    super.onPause()
    // osmdroid recomienda esto
}

override fun onResume() {
    super.onResume()
}
}