import { requireNativeComponent, ViewStyle } from 'react-native';

interface NativeOsmMapProps {
  style?: ViewStyle;
  initialLocation?: { lat: number; lng: number };
}

export default requireNativeComponent<NativeOsmMapProps>('OsmMapView');